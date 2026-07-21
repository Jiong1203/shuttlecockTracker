import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, buildLowStockEmail } from '@/lib/email'

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

    // 4) 讀取已通知記錄，做去重與回補清除
    const { data: alerts, error: alertError } = await admin
      .from('low_stock_alerts')
      .select('shuttlecock_type_id')
      .returns<{ shuttlecock_type_id: string }[]>()

    if (alertError) throw alertError

    const alertedIds = new Set((alerts ?? []).map((a) => a.shuttlecock_type_id))
    const writeErrors: string[] = []

    // 4a) 回補判定：僅「顯示中且庫存已回到門檻以上」才視為回補並清除記錄。
    //     隱藏中的球種保留記錄（避免取消隱藏後重複通知）；已刪除的球種其記錄由 FK cascade 自動清除。
    const recoveredIds = [...alertedIds].filter((id) => {
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
      }
    }

    // 4b) 本次「新」低庫存（尚未通知過）者才需寄信
    const newLowItems = lowItems.filter((it) => !alertedIds.has(it.shuttlecock_type_id))
    if (newLowItems.length === 0) {
      const hasWriteError = writeErrors.length > 0
      return NextResponse.json(
        { ok: !hasWriteError, notifiedGroups: 0, notifiedItems: 0, recovered: recoveredIds.length, writeErrors },
        { status: hasWriteError ? 500 : 200 }
      )
    }

    // 5) 取得各 group 的聯絡信箱
    const groupIds = [...new Set(newLowItems.map((it) => it.group_id))]
    const { data: groups, error: groupError } = await admin
      .from('groups')
      .select('id, name, contact_email')
      .in('id', groupIds)
      .returns<GroupRow[]>()

    if (groupError) throw groupError

    const groupMap = new Map(groups?.map((g) => [g.id, g]))

    // 6) 依 group 彙整並寄信；未設定 contact_email 的 group 略過（不記錄，待其填信箱後再通知）
    let notifiedGroups = 0
    let notifiedItems = 0
    let attemptedGroups = 0 // 有聯絡信箱、實際嘗試寄送的 group 數
    let sendFailures = 0
    const skippedNoEmail: string[] = []
    const notifiedTypeIds: string[] = []

    for (const gid of groupIds) {
      const group = groupMap.get(gid)
      if (!group) continue

      const items = newLowItems.filter((it) => it.group_id === gid)

      if (!group.contact_email) {
        skippedNoEmail.push(group.name)
        continue
      }

      attemptedGroups++

      const { subject, html, text } = buildLowStockEmail(
        group.name,
        items.map((it) => ({
          brand: it.brand,
          name: it.name,
          currentStock: it.current_stock,
          threshold: it.low_stock_threshold,
        }))
      )

      try {
        await sendEmail({ to: group.contact_email, subject, html, text })
        notifiedGroups++
        notifiedItems += items.length
        notifiedTypeIds.push(...items.map((it) => it.shuttlecock_type_id))
      } catch (e) {
        // 單一 group 寄信失敗不影響其他 group；不記錄通知，下次 cron 會重試
        sendFailures++
        console.error(`低庫存通知寄送失敗 group=${group.name}:`, e)
      }
    }

    // 7) 僅對「成功寄出」的球種寫入去重記錄
    if (notifiedTypeIds.length > 0) {
      const rows = newLowItems
        .filter((it) => notifiedTypeIds.includes(it.shuttlecock_type_id))
        .map((it) => ({ shuttlecock_type_id: it.shuttlecock_type_id, group_id: it.group_id }))
      const { error: upsertError } = await admin
        .from('low_stock_alerts')
        .upsert(rows, { onConflict: 'shuttlecock_type_id' })
      if (upsertError) {
        // 去重記錄寫入失敗會導致下次 cron 對同一批球種重複寄信，需明確反映為失敗
        console.error('寫入低庫存通知去重記錄失敗:', upsertError)
        writeErrors.push(`去重記錄寫入失敗: ${upsertError.message}`)
      }
    }

    // 全數嘗試寄送卻無一成功（如 SMTP 設定錯誤），或有寫入錯誤 → 視為失敗，回非 200 讓 cron 顯示紅燈
    const allSendsFailed = attemptedGroups > 0 && notifiedGroups === 0
    const hasFailure = allSendsFailed || writeErrors.length > 0

    return NextResponse.json(
      {
        ok: !hasFailure,
        notifiedGroups,
        notifiedItems,
        recovered: recoveredIds.length,
        skippedNoEmail,
        sendFailures,
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
