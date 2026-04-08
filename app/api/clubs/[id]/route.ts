import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'
import { hashPin, verifyPin } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/clubs/[id] — 取得單一 club 資訊
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, leader_name, created_at')
    .eq('id', id)
    .eq('group_id', groupId)
    .single()

  if (error || !data) return NextResponse.json({ error: '找不到此球團' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/clubs/[id] — 更新 club（名稱 / 負責人 / PIN）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const groupId = await getGroupId(supabase)
  if (!groupId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, leaderName, pin, currentPin } = await request.json()

  // 確認 club 屬於此 group
  const { data: club, error: fetchError } = await supabase
    .from('clubs')
    .select('id, pin_hash')
    .eq('id', id)
    .eq('group_id', groupId)
    .single()

  if (fetchError || !club) return NextResponse.json({ error: '找不到此球團' }, { status: 404 })

  // 若要更換 PIN，必須先驗證原 PIN
  if (pin?.trim()) {
    if (!currentPin?.trim()) {
      return NextResponse.json({ error: '請輸入目前的 PIN 碼' }, { status: 400 })
    }
    const valid = await verifyPin(currentPin, club.pin_hash)
    if (!valid) return NextResponse.json({ error: '目前 PIN 碼錯誤' }, { status: 401 })
  }

  const updates: Record<string, string> = {}
  if (name?.trim()) updates.name = name.trim()
  if (leaderName?.trim()) updates.leader_name = leaderName.trim()
  if (pin?.trim()) updates.pin_hash = await hashPin(pin)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clubs')
    .update(updates)
    .eq('id', id)
    .select('id, name, leader_name, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
