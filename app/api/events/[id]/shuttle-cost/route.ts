import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'

export const dynamic = 'force-dynamic'

// POST /api/events/[id]/shuttle-cost
// FIFO 試算：以活動日為基準，計算指定球種與顆數的用球成本
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // 確認 event 屬於此 group 並取得活動日期
  const { data: event } = await supabase
    .from('badminton_events')
    .select('id, event_date, clubs!inner(group_id)')
    .eq('id', id)
    .eq('clubs.group_id', groupId)
    .single()

  if (!event) return NextResponse.json({ error: '找不到此活動' }, { status: 404 })

  const { shuttlecockTypeId, quantity } = await request.json()
  if (!shuttlecockTypeId) return NextResponse.json({ error: '請選擇球種' }, { status: 400 })
  if (!quantity || quantity <= 0) return NextResponse.json({ error: '顆數需大於 0' }, { status: 400 })

  // 取得活動日（含當天）前所有入庫批次，升冪排列以 FIFO 消耗
  const { data: restocks, error: restockError } = await supabase
    .from('restock_records')
    .select('quantity, unit_price')
    .eq('group_id', groupId)
    .eq('shuttlecock_type_id', shuttlecockTypeId)
    .lte('created_at', `${event.event_date}T23:59:59+00:00`)
    .order('created_at', { ascending: true })

  if (restockError) return NextResponse.json({ error: restockError.message }, { status: 500 })

  // 取得活動日前（含當天）所有已使用數量（其他 pickup records）
  const { data: pickups, error: pickupError } = await supabase
    .from('pickup_records')
    .select('quantity')
    .eq('group_id', groupId)
    .eq('shuttlecock_type_id', shuttlecockTypeId)
    .lte('created_at', `${event.event_date}T23:59:59+00:00`)
    .order('created_at', { ascending: true })

  if (pickupError) return NextResponse.json({ error: pickupError.message }, { status: 500 })

  // FIFO 試算
  const totalUsedBefore = pickups.reduce((sum, p) => sum + p.quantity, 0)
  let remaining = totalUsedBefore  // 先消耗掉已用掉的批次
  let toCalc = quantity            // 本次要計算的顆數
  let cost = 0

  for (const batch of restocks) {
    if (remaining >= batch.quantity) {
      remaining -= batch.quantity
      continue
    }
    const availableInBatch = batch.quantity - remaining
    remaining = 0
    const used = Math.min(availableInBatch, toCalc)
    cost += used * Number(batch.unit_price)
    toCalc -= used
    if (toCalc <= 0) break
  }

  if (toCalc > 0) {
    return NextResponse.json({ error: '庫存不足，無法完成 FIFO 試算' }, { status: 400 })
  }

  return NextResponse.json({ cost: Math.round(cost * 100) / 100 })
}
