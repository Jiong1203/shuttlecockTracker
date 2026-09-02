import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'

export const dynamic = 'force-dynamic'

const PIECES_PER_TUBE = 12    // 1 桶 = 12 顆，與 event-detail-dialog.tsx 的 FifoCalculator 一致
const TAIPEI_OFFSET = '+08:00'

// 「活動日（含當天）」的嚴格上界＝活動日台北時間隔天 00:00。
// 不可用 `${event_date}T23:59:59+00:00`：UTC 午夜不是台北午夜，該界線實際落在
// 台北隔天 07:59，會把隔天凌晨的領用誤算成活動前就已用掉。
function taipeiDayAfter(eventDate: string) {
  const d = new Date(`${eventDate}T00:00:00${TAIPEI_OFFSET}`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

const fmtTubes = (n: number) => String(Math.round(n * 100) / 100)
const toPieces = (tubes: number) => Math.round(tubes * PIECES_PER_TUBE)

// POST /api/events/[id]/shuttle-cost
// 先進先出 試算：以活動日為基準，計算指定球種與顆數的用球成本
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

  const cutoff = taipeiDayAfter(event.event_date)

  // 取得活動日（含當天）前所有入庫批次，升冪排列以 先進先出 消耗
  const { data: restockRows, error: restockError } = await supabase
    .from('restock_records')
    .select('quantity, unit_price')
    .eq('group_id', groupId)
    .eq('shuttlecock_type_id', shuttlecockTypeId)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })

  if (restockError) return NextResponse.json({ error: restockError.message }, { status: 500 })

  // 取得活動日前（含當天）所有已使用數量（其他 pickup records）
  const { data: pickupRows, error: pickupError } = await supabase
    .from('pickup_records')
    .select('quantity')
    .eq('group_id', groupId)
    .eq('shuttlecock_type_id', shuttlecockTypeId)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })

  if (pickupError) return NextResponse.json({ error: pickupError.message }, { status: 500 })

  const restocks = restockRows ?? []
  const pickups = pickupRows ?? []

  // 先進先出 試算
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
    // 這裡算的是「活動日當下」的歷史庫存，不是首頁的現在庫存。
    // 最常見的落差來源是入庫紀錄的進貨日期晚於活動日，訊息要講清楚以免重複踩雷。
    const totalRestocked = restocks.reduce((sum, r) => sum + r.quantity, 0)
    const available = Math.max(0, totalRestocked - totalUsedBefore)
    return NextResponse.json(
      {
        error:
          `活動日（${event.event_date}）當下可用庫存僅 ${fmtTubes(available)} 桶（約 ${toPieces(available)} 顆），` +
          `本次需 ${fmtTubes(quantity)} 桶（${toPieces(quantity)} 顆），尚缺 ${fmtTubes(toCalc)} 桶。` +
          `若這批球是活動結束後才登記入庫，請到入庫登記修正進貨日期後再試算。`,
        available,
        required: quantity,
        shortage: toCalc,
      },
      { status: 400 }
    )
  }

  return NextResponse.json({ cost: Math.round(cost * 100) / 100 })
}
