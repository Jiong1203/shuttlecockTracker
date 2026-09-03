import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'

export const dynamic = 'force-dynamic'

// 共用：確認成員屬於此 group 底下的 club
async function ownsMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  memberId: string,
  groupId: string
) {
  const { data } = await supabase
    .from('club_members')
    .select('id, clubs!inner(group_id)')
    .eq('id', memberId)
    .eq('club_id', clubId)
    .eq('clubs.group_id', groupId)
    .single()
  return !!data
}

// PATCH /api/clubs/[id]/members/[mid] — 更新成員
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, mid } = await params
  if (!(await ownsMember(supabase, id, mid, groupId))) {
    return NextResponse.json({ error: '找不到此成員' }, { status: 404 })
  }

  const { displayName, defaultFee, isFree, isActive, note } = await request.json()

  const updates: Record<string, unknown> = {}
  if (displayName !== undefined) {
    if (!displayName?.trim()) return NextResponse.json({ error: '姓名不得為空' }, { status: 400 })
    updates.display_name = displayName.trim()
  }
  if (defaultFee !== undefined) updates.default_fee = defaultFee
  if (isFree !== undefined) updates.is_free = isFree
  if (isActive !== undefined) updates.is_active = isActive
  if (note !== undefined) updates.note = note?.trim() || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('club_members')
    .update(updates)
    .eq('id', mid)
    .select('id, display_name, default_fee, is_free, is_active, note, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '名冊中已有同名成員' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/clubs/[id]/members/[mid] — 刪除成員
// 歷史出席紀錄的 member_id 會被設為 NULL，姓名文字保留，不影響既有帳目。
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, mid } = await params
  if (!(await ownsMember(supabase, id, mid, groupId))) {
    return NextResponse.json({ error: '找不到此成員' }, { status: 404 })
  }

  const { error } = await supabase.from('club_members').delete().eq('id', mid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: '成員已刪除' })
}
