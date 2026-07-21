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
    // 3) 掃描所有啟用中球種的庫存彙總
    const { data: inventory, error: invError } = await admin
      .from('inventory_summary')
      .select('group_id, shuttlecock_type_id, brand, name, is_active, low_stock_threshold, current_stock')
      .eq('is_active', true)
      .returns<InventoryRow[]>()

    if (invError) throw invError

    // 目前低於門檻的球種
    const lowItems = (inventory ?? []).filter((row) => row.current_stock < row.low_stock_threshold)
    const lowIds = new Set(lowItems.map((it) => it.shuttlecock_type_id))

    // 4) 讀取已通知記錄，做去重與回補清除
    const { data: alerts, error: alertError } = await admin
      .from('low_stock_alerts')
      .select('shuttlecock_type_id')
      .returns<{ shuttlecock_type_id: string }[]>()

    if (alertError) throw alertError

    const alertedIds = new Set((alerts ?? []).map((a) => a.shuttlecock_type_id))

    // 4a) 已回補（不再低於門檻）者，清除其通知記錄，之後再度低於門檻才會重新寄信
    const recoveredIds = [...alertedIds].filter((id) => !lowIds.has(id))
    if (recoveredIds.length > 0) {
      await admin.from('low_stock_alerts').delete().in('shuttlecock_type_id', recoveredIds)
    }

    // 4b) 本次「新」低庫存（尚未通知過）者才需寄信
    const newLowItems = lowItems.filter((it) => !alertedIds.has(it.shuttlecock_type_id))
    if (newLowItems.length === 0) {
      return NextResponse.json({ ok: true, notified: 0, recovered: recoveredIds.length })
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
        console.error(`低庫存通知寄送失敗 group=${group.name}:`, e)
      }
    }

    // 7) 僅對「成功寄出」的球種寫入去重記錄
    if (notifiedTypeIds.length > 0) {
      const rows = newLowItems
        .filter((it) => notifiedTypeIds.includes(it.shuttlecock_type_id))
        .map((it) => ({ shuttlecock_type_id: it.shuttlecock_type_id, group_id: it.group_id }))
      await admin.from('low_stock_alerts').upsert(rows, { onConflict: 'shuttlecock_type_id' })
    }

    return NextResponse.json({
      ok: true,
      notifiedGroups,
      notifiedItems,
      recovered: recoveredIds.length,
      skippedNoEmail,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    console.error('低庫存掃描失敗:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
