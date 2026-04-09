import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'

export const dynamic = 'force-dynamic'

// GET /api/events?club_id=&start=&end= — 列出活動（含動態計算欄）
export async function GET(request: Request) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clubId = searchParams.get('club_id')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!clubId) return NextResponse.json({ error: '缺少 club_id 參數' }, { status: 400 })

  // 確認 club 屬於此 group
  const { data: club } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .eq('group_id', groupId)
    .single()

  if (!club) return NextResponse.json({ error: '找不到此球隊' }, { status: 404 })

  let query = supabase
    .from('badminton_events')
    .select(`
      id, event_date, venue_name, court_count, hours, hourly_rate,
      shuttle_cost_mode, shuttle_cost, is_settled, notes, created_at,
      event_attendees ( fee, paid, is_free )
    `)
    .eq('club_id', clubId)
    .order('event_date', { ascending: false })

  if (start) query = query.gte('event_date', start)
  if (end) query = query.lte('event_date', end)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const events = data.map(e => {
    const venueCost = e.court_count * e.hours * e.hourly_rate
    const totalRevenue = e.event_attendees
      .filter((a: { paid: boolean; is_free: boolean }) => a.paid && !a.is_free)
      .reduce((sum: number, a: { fee: number }) => sum + Number(a.fee), 0)
    const profit = totalRevenue - Number(e.shuttle_cost) - venueCost

    const { event_attendees, ...rest } = e
    void event_attendees
    return { ...rest, venue_cost: venueCost, total_revenue: totalRevenue, profit }
  })

  return NextResponse.json(events)
}

// POST /api/events — 建立活動
export async function POST(request: Request) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clubId, eventDate, venueName, courtCount, hours, hourlyRate, shuttleCostMode, shuttleCost, notes } = await request.json()

  if (!clubId) return NextResponse.json({ error: '缺少 club_id' }, { status: 400 })
  if (!eventDate) return NextResponse.json({ error: '請輸入活動日期' }, { status: 400 })
  if (!courtCount || courtCount < 1) return NextResponse.json({ error: '場地數需大於 0' }, { status: 400 })
  if (!hours || hours <= 0) return NextResponse.json({ error: '時數需大於 0' }, { status: 400 })
  if (hourlyRate === undefined || hourlyRate < 0) return NextResponse.json({ error: '每小時場租不得為負數' }, { status: 400 })

  // 確認 club 屬於此 group
  const { data: club } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .eq('group_id', groupId)
    .single()

  if (!club) return NextResponse.json({ error: '找不到此球隊' }, { status: 404 })

  const { data, error } = await supabase
    .from('badminton_events')
    .insert({
      club_id: clubId,
      event_date: eventDate,
      venue_name: venueName?.trim() || null,
      court_count: courtCount,
      hours,
      hourly_rate: hourlyRate,
      shuttle_cost_mode: shuttleCostMode ?? 'manual',
      shuttle_cost: shuttleCost ?? 0,
      notes: notes?.trim() || null,
    })
    .select('id, event_date, venue_name, court_count, hours, hourly_rate, shuttle_cost_mode, shuttle_cost, is_settled, notes, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
