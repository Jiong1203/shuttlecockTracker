import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'

export const dynamic = 'force-dynamic'

// 共用：確認 event 屬於此 group
async function verifyEventOwnership(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, groupId: string) {
  const { data } = await supabase
    .from('badminton_events')
    .select('id, clubs!inner(group_id)')
    .eq('id', eventId)
    .eq('clubs.group_id', groupId)
    .single()
  return !!data
}

// GET /api/events/[id]/attendees
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await verifyEventOwnership(supabase, id, groupId)
  if (!owned) return NextResponse.json({ error: '找不到此活動' }, { status: 404 })

  const { data, error } = await supabase
    .from('event_attendees')
    .select('id, display_name, fee, paid, is_free, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/events/[id]/attendees — 新增出席者
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await verifyEventOwnership(supabase, id, groupId)
  if (!owned) return NextResponse.json({ error: '找不到此活動' }, { status: 404 })

  const { displayName, fee, paid, isFree } = await request.json()
  if (!displayName?.trim()) return NextResponse.json({ error: '請輸入出席者姓名' }, { status: 400 })

  const { data, error } = await supabase
    .from('event_attendees')
    .insert({
      event_id: id,
      display_name: displayName.trim(),
      fee: fee ?? 0,
      paid: paid ?? false,
      is_free: isFree ?? false,
    })
    .select('id, display_name, fee, paid, is_free, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
