import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, buildLowStockEmail } from '@/lib/email'
import { pushLineMessage, buildLowStockLineText, buildOrderDraftLineText } from '@/lib/line'

// cron 觸發、需繞過 RLS 掃描全部 group，因此必須動態執行
export const dynamic = 'force-dynamic'

interface InventoryRow {
  group_id: string
  shuttlecock_type_id: string
  brand: string
  name: string
  is_active: boolean
  total_restocked: number
  low_stock_threshold: number
  current_stock: number
}

interface GroupRow {
  id: string
  name: string
  contact_email: string | null
  line_enabled: boolean
  line_user_id: string | null
}

interface AlertRow {
  shuttlecock_type_id: string
  email_notified_at: string | null
  line_notified_at: string | null
}

export async function GET(request: Request) {
  // 1) 驗證來源：Vercel Cron 會帶 Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: '系統配置錯誤：缺少 Service Role 設定' }, { status: 500 })
  }

  // 2) 以 service role 建立 admin client（繞過 RLS、跨所有 group 掃描）
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // 3) 掃描庫存彙總（含隱藏球種，以便區分「隱藏」與「已回補」兩種情況）
    const { data: inventory, error: invError } = await admin
      .from('inventory_summary')
      .select('group_id, shuttlecock_type_id, brand, name, is_active, total_restocked, low_stock_threshold, current_stock')
      .returns<InventoryRow[]>()

    if (invError) throw invError

    const allRows = inventory ?? []
    const rowById = new Map(allRows.map((r) => [r.shuttlecock_type_id, r]))

    // 低庫存候選：僅限「顯示中」且「曾經進貨過」的球種
    //  - 未曾進貨（total_restocked = 0）的新球種不算低庫存，避免剛建立就誤報缺貨
    //  - 隱藏中的球種不主動通知
    const lowItems = allRows.filter(
      (row) => row.is_active && row.total_restocked > 0 && row.current_stock < row.low_stock_threshold
    )

    // 4) 讀取已通知記錄（分通道時間戳），做去重與回補清除
    const { data: alerts, error: alertError } = await admin
      .from('low_stock_alerts')
      .select('shuttlecock_type_id, email_notified_at, line_notified_at')
      .returns<AlertRow[]>()

    if (alertError) throw alertError

    const alertById = new Map((alerts ?? []).map((a) => [a.shuttlecock_type_id, a]))
    const writeErrors: string[] = []

    // 4a) 回補判定：僅「顯示中且庫存已回到門檻以上」才視為回補並整列清除（等於兩通道一併重置）。
    //     隱藏中的球種保留記錄（避免取消隱藏後重複通知）；已刪除的球種其記錄由 FK cascade 自動清除。
    const recoveredIds = [...alertById.keys()].filter((id) => {
      const r = rowById.get(id)
      return r !== undefined && r.is_active && r.current_stock >= r.low_stock_threshold
    })
    if (recoveredIds.length > 0) {
      const { error: deleteError } = await admin
        .from('low_stock_alerts')
        .delete()
        .in('shuttlecock_type_id', recoveredIds)
      if (deleteError) {
        // 清除失敗會留下殘留記錄，日後該球種再度低於門檻時將被誤壓不通知
        console.error('清除已回補的低庫存通知記錄失敗:', deleteError)
        writeErrors.push(`回補記錄清除失敗: ${deleteError.message}`)
      } else {
        recoveredIds.forEach((id) => alertById.delete(id))
      }
    }

    // 分通道去重：該通道時間戳非 null 即代表「已於此通道通知過」
    const emailDone = (id: string) => !!alertById.get(id)?.email_notified_at
    const lineDone = (id: string) => !!alertById.get(id)?.line_notified_at

    const lowGroupIds = [...new Set(lowItems.map((it) => it.group_id))]
    if (lowGroupIds.length === 0) {
      const hasWriteError = writeErrors.length > 0
      return NextResponse.json(
        { ok: !hasWriteError, emailNotifiedGroups: 0, lineNotifiedGroups: 0, recovered: recoveredIds.length, writeErrors },
        { status: hasWriteError ? 500 : 200 }
      )
    }

    // 5) 取得各 group 的通知目標（email 與 LINE）
    const { data: groups, error: groupError } = await admin
      .from('groups')
      .select('id, name, contact_email, line_enabled, line_user_id')
      .in('id', lowGroupIds)
      .returns<GroupRow[]>()

    if (groupError) throw groupError

    const groupMap = new Map((groups ?? []).map((g) => [g.id, g]))

    // 6) 依 group、依通道發送。各通道獨立判斷「是否已通知」與「是否有目標」，互不影響。
    const nowIso = new Date().toISOString()
    const emailSuccessIds: string[] = []
    const lineSuccessIds: string[] = []
    let emailNotifiedGroups = 0
    let lineNotifiedGroups = 0
    let emailFailures = 0
    let lineFailures = 0
    const skippedNoTarget: string[] = [] // 兩通道皆未設定，略過（不寫記錄，待其設定後再通知）
    const groupIdById = new Map(lowItems.map((it) => [it.shuttlecock_type_id, it.group_id]))

    for (const gid of lowGroupIds) {
      const group = groupMap.get(gid)
      if (!group) continue

      const items = lowItems.filter((it) => it.group_id === gid)
      const hasEmail = !!group.contact_email
      const hasLine = !!(group.line_enabled && group.line_user_id)

      if (!hasEmail && !hasLine) {
        skippedNoTarget.push(group.name)
        continue
      }

      // Email 通道：只寄「此通道尚未通知過」的球種
      if (hasEmail) {
        const emailItems = items.filter((it) => !emailDone(it.shuttlecock_type_id))
        if (emailItems.length > 0) {
          const { subject, html, text } = buildLowStockEmail(
            group.name,
            emailItems.map((it) => ({ brand: it.brand, name: it.name, currentStock: it.current_stock, threshold: it.low_stock_threshold }))
          )
          try {
            await sendEmail({ to: group.contact_email!, subject, html, text })
            emailNotifiedGroups++
            emailSuccessIds.push(...emailItems.map((it) => it.shuttlecock_type_id))
          } catch (e) {
            emailFailures++
            console.error(`低庫存 email 寄送失敗 group=${group.name}:`, e)
          }
        }
      }

      // LINE 通道：只推「此通道尚未通知過」的球種
      if (hasLine) {
        const lineItems = items.filter((it) => !lineDone(it.shuttlecock_type_id))
        if (lineItems.length > 0) {
          const itemsPayload = lineItems.map((it) => ({ brand: it.brand, name: it.name, currentStock: it.current_stock, threshold: it.low_stock_threshold }))
          // 第 1 則：低庫存提醒；第 2 則：可長按轉傳給廠商的下訂訊息草稿（同一次 push）
          const lineText = buildLowStockLineText(group.name, itemsPayload)
          const orderDraft = buildOrderDraftLineText(itemsPayload)
          try {
            await pushLineMessage({ to: group.line_user_id!, text: [lineText, orderDraft] })
            lineNotifiedGroups++
            lineSuccessIds.push(...lineItems.map((it) => it.shuttlecock_type_id))
          } catch (e) {
            lineFailures++
            console.error(`低庫存 LINE 推播失敗 group=${group.name}:`, e)
          }
        }
      }
    }

    // 7) 分通道寫入去重時間戳（拆成兩次 upsert，各自欄位一致，避免 partial upsert 誤將另一通道欄位覆寫為 null）
    if (emailSuccessIds.length > 0) {
      const rows = [...new Set(emailSuccessIds)].map((id) => ({
        shuttlecock_type_id: id,
        group_id: groupIdById.get(id)!,
        email_notified_at: nowIso,
      }))
      const { error } = await admin.from('low_stock_alerts').upsert(rows, { onConflict: 'shuttlecock_type_id' })
      if (error) {
        console.error('寫入 email 去重記錄失敗:', error)
        writeErrors.push(`email 去重記錄寫入失敗: ${error.message}`)
      }
    }
    if (lineSuccessIds.length > 0) {
      const rows = [...new Set(lineSuccessIds)].map((id) => ({
        shuttlecock_type_id: id,
        group_id: groupIdById.get(id)!,
        line_notified_at: nowIso,
      }))
      const { error } = await admin.from('low_stock_alerts').upsert(rows, { onConflict: 'shuttlecock_type_id' })
      if (error) {
        console.error('寫入 LINE 去重記錄失敗:', error)
        writeErrors.push(`LINE 去重記錄寫入失敗: ${error.message}`)
      }
    }

    // 有實際嘗試寄送卻無一成功（如 SMTP/LINE 設定錯誤），或有寫入錯誤 → 視為失敗，回非 200 讓 cron 顯示紅燈
    const attempted = emailFailures + lineFailures + emailNotifiedGroups + lineNotifiedGroups
    const allSendsFailed = attempted > 0 && emailNotifiedGroups + lineNotifiedGroups === 0
    const hasFailure = allSendsFailed || writeErrors.length > 0

    return NextResponse.json(
      {
        ok: !hasFailure,
        emailNotifiedGroups,
        lineNotifiedGroups,
        emailFailures,
        lineFailures,
        recovered: recoveredIds.length,
        skippedNoTarget,
        writeErrors,
      },
      { status: hasFailure ? 500 : 200 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    console.error('低庫存掃描失敗:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
