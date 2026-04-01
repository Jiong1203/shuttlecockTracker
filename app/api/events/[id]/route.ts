import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'

export const dynamic = 'force-dynamic'

// 共用：確認 event 屬於此 group，回傳 event row
async function getOwnedEvent(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, groupId: string) {
  const { data } = await supabase
    .from('badminton_events')
    .select('id, is_settled, clubs!inner(group_id)')
    .eq('id', eventId)
    .eq('clubs.group_id', groupId)
    .single()
  return data
}

// GET /api/events/[id] — 取得活動詳情（含動態計算欄）
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('badminton_events')
    .select(`
      id, event_date, venue_name, court_count, hours, hourly_rate,
      shuttle_cost_mode, shuttle_cost, is_settled, notes, created_at,
      clubs!inner ( group_id ),
      event_attendees ( id, display_name, fee, paid, is_free, created_at )
    `)
    .eq('id', id)
    .eq('clubs.group_id', groupId)
    .single()

  if (error) return NextResponse.json({ error: '找不到此活動' }, { status: 404 })

  const venueCost = data.court_count * data.hours * data.hourly_rate
  const totalRevenue = data.event_attendees
    .filter((a: { paid: boolean; is_free: boolean }) => a.paid && !a.is_free)
    .reduce((sum: number, a: { fee: number }) => sum + Number(a.fee), 0)
  const profit = totalRevenue - Number(data.shuttle_cost) - venueCost

  const { clubs, ...rest } = data
  void clubs
  return NextResponse.json({ ...rest, venue_cost: venueCost, total_revenue: totalRevenue, profit })
}

// PATCH /api/events/[id] — 更新活動資訊或標記已結算
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const event = await getOwnedEvent(supabase, id, groupId)
  if (!event) return NextResponse.json({ error: '找不到此活動' }, { status: 404 })

  const body = await request.json()
  const { eventDate, venueName, courtCount, hours, hourlyRate, shuttleCostMode, shuttleCost, notes, isSettled } = body

  const updates: Record<string, unknown> = {}
  if (eventDate !== undefined) updates.event_date = eventDate
  if (venueName !== undefined) updates.venue_name = venueName?.trim() || null
  if (courtCount !== undefined) updates.court_count = courtCount
  if (hours !== undefined) updates.hours = hours
  if (hourlyRate !== undefined) updates.hourly_rate = hourlyRate
  if (shuttleCostMode !== undefined) updates.shuttle_cost_mode = shuttleCostMode
  if (shuttleCost !== undefined) updates.shuttle_cost = shuttleCost
  if (notes !== undefined) updates.notes = notes?.trim() || null
  if (isSettled !== undefined) updates.is_settled = isSettled

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('badminton_events')
    .update(updates)
    .eq('id', id)
    .select('id, event_date, venue_name, court_count, hours, hourly_rate, shuttle_cost_mode, shuttle_cost, is_settled, notes, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/events/[id] — 刪除活動（已結算時拒絕）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const event = await getOwnedEvent(supabase, id, groupId)
  if (!event) return NextResponse.json({ error: '找不到此活動' }, { status: 404 })

  if (event.is_settled) {
    return NextResponse.json({ error: '已結算的活動無法刪除' }, { status: 403 })
  }

  const { error } = await supabase.from('badminton_events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: '活動已刪除' })
}
