import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'
import { verifyPin } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// POST /api/clubs/[id]/verify-pin — 驗證 club PIN
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { pin } = await request.json()

  if (!pin) return NextResponse.json({ error: '請輸入 PIN 碼' }, { status: 400 })

  const { data: club, error } = await supabase
    .from('clubs')
    .select('id, name, leader_name, pin_hash')
    .eq('id', id)
    .eq('group_id', groupId)
    .single()

  if (error || !club) return NextResponse.json({ error: '找不到此球團' }, { status: 404 })

  const valid = await verifyPin(pin, club.pin_hash)
  if (!valid) return NextResponse.json({ error: 'PIN 碼錯誤' }, { status: 401 })

  // 驗證成功，回傳 club 基本資訊（不含 pin_hash）
  return NextResponse.json({ id: club.id, name: club.name, leaderName: club.leader_name })
}
