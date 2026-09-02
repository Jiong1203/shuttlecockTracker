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

  const body = await request.json()

  // 支援兩種形式：單筆物件，或 { attendees: [...] } 批次。
  // 批次是給 LINE 名單解析用的——一次貼上二十人時，逐筆 POST 會打出二十個往返，
  // 且中途失敗會留下半套資料。
  const isBatch = Array.isArray(body.attendees)
  const rows: { displayName?: string; fee?: number; paid?: boolean; isFree?: boolean }[] =
    isBatch ? body.attendees : [body]

  if (rows.length === 0) return NextResponse.json({ error: '沒有可新增的出席者' }, { status: 400 })

  const names = rows.map(r => r.displayName?.trim())
  const blankAt = names.findIndex(n => !n)
  if (blankAt !== -1) {
    return NextResponse.json(
      { error: isBatch ? `第 ${blankAt + 1} 筆缺少出席者姓名` : '請輸入出席者姓名' },
      { status: 400 }
    )
  }

  // created_at 決定出席順序（API 以它升冪排序）。同一批次寫入時資料庫的 now() 會完全相同，
  // 順序就會亂掉，所以這裡逐筆遞增 1 毫秒，保住 LINE 名單的原始順序。
  const base = Date.now()
  const payload = rows.map((r, i) => ({
    event_id: id,
    display_name: names[i]!,
    fee: r.fee ?? 0,
    paid: r.paid ?? false,
    is_free: r.isFree ?? false,
    created_at: new Date(base + i).toISOString(),
  }))

  const { data, error } = await supabase
    .from('event_attendees')
    .insert(payload)
    .select('id, display_name, fee, paid, is_free, created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 單筆呼叫維持原本的回應形狀，批次則回傳陣列
  return NextResponse.json(isBatch ? data : data[0], { status: 201 })
}
