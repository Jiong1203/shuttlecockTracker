import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'

export const dynamic = 'force-dynamic'

// 共用：確認 attendee 屬於此 group
async function getOwnedAttendee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  attendeeId: string,
  groupId: string
) {
  const { data } = await supabase
    .from('event_attendees')
    .select('id, event_id, badminton_events!inner(clubs!inner(group_id))')
    .eq('id', attendeeId)
    .eq('event_id', eventId)
    .eq('badminton_events.clubs.group_id', groupId)
    .single()
  return data
}

// PATCH /api/events/[id]/attendees/[aid] — 更新繳費狀態 / 金額 / 免費標記
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, aid } = await params
  const attendee = await getOwnedAttendee(supabase, id, aid, groupId)
  if (!attendee) return NextResponse.json({ error: '找不到此出席者' }, { status: 404 })

  const { displayName, fee, paid, isFree } = await request.json()

  const updates: Record<string, unknown> = {}
  if (displayName !== undefined) updates.display_name = displayName.trim()
  if (fee !== undefined) updates.fee = fee
  if (paid !== undefined) updates.paid = paid
  if (isFree !== undefined) updates.is_free = isFree

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('event_attendees')
    .update(updates)
    .eq('id', aid)
    .select('id, display_name, fee, paid, is_free, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/events/[id]/attendees/[aid] — 移除出席者
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, aid } = await params
  const attendee = await getOwnedAttendee(supabase, id, aid, groupId)
  if (!attendee) return NextResponse.json({ error: '找不到此出席者' }, { status: 404 })

  const { error } = await supabase.from('event_attendees').delete().eq('id', aid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: '出席者已移除' })
}
