import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'
import { hashPin } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/clubs — 列出 group 底下所有 clubs（不含 pin_hash）
export async function GET() {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, leader_name, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/clubs — 建立 club
export async function POST(request: Request) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, leaderName, pin } = await request.json()

  if (!name?.trim()) return NextResponse.json({ error: '請輸入球隊名稱' }, { status: 400 })
  if (!leaderName?.trim()) return NextResponse.json({ error: '請輸入隊長姓名' }, { status: 400 })
  if (!pin?.trim()) return NextResponse.json({ error: '請設定 PIN 碼' }, { status: 400 })

  const pinHash = await hashPin(pin)

  const { data, error } = await supabase
    .from('clubs')
    .insert({ group_id: groupId, name: name.trim(), leader_name: leaderName.trim(), pin_hash: pinHash })
    .select('id, name, leader_name, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
