import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'

export const dynamic = 'force-dynamic'

// 共用：確認 club 屬於此 group
async function ownsClub(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  groupId: string
) {
  const { data } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .eq('group_id', groupId)
    .single()
  return !!data
}

// GET /api/clubs/[id]/members?all=true — 名冊列表
// 預設只回傳啟用中的成員；帶 all=true 則含已停用者（供名冊管理畫面使用）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await ownsClub(supabase, id, groupId))) {
    return NextResponse.json({ error: '找不到此球隊' }, { status: 404 })
  }

  const includeInactive = new URL(request.url).searchParams.get('all') === 'true'

  let query = supabase
    .from('club_members')
    .select('id, display_name, default_fee, is_free, is_active, note, created_at')
    .eq('club_id', id)
    .order('display_name', { ascending: true })

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/clubs/[id]/members — 新增成員，支援單筆與批次
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await ownsClub(supabase, id, groupId))) {
    return NextResponse.json({ error: '找不到此球隊' }, { status: 404 })
  }

  const body = await request.json()
  const isBatch = Array.isArray(body.members)
  const rows: { displayName?: string; defaultFee?: number; isFree?: boolean; note?: string }[] =
    isBatch ? body.members : [body]

  if (rows.length === 0) return NextResponse.json({ error: '沒有可新增的成員' }, { status: 400 })

  const names = rows.map(r => r.displayName?.trim())
  const blankAt = names.findIndex(n => !n)
  if (blankAt !== -1) {
    return NextResponse.json(
      { error: isBatch ? `第 ${blankAt + 1} 筆缺少姓名` : '請輸入姓名' },
      { status: 400 }
    )
  }

  const payload = rows.map((r, i) => ({
    club_id: id,
    display_name: names[i]!,
    default_fee: r.defaultFee ?? 0,
    is_free: r.isFree ?? false,
    note: r.note?.trim() || null,
  }))

  const { data, error } = await supabase
    .from('club_members')
    .insert(payload)
    .select('id, display_name, default_fee, is_free, is_active, note, created_at')

  if (error) {
    // 同隊不重名的唯一索引
    if (error.code === '23505') {
      return NextResponse.json({ error: '名冊中已有同名成員' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(isBatch ? data : data[0], { status: 201 })
}
