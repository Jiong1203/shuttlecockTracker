import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'
import { verifyPin } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// 連錯這麼多次就鎖住。四位數 PIN 僅一萬種組合，沒有限制的話腳本幾秒就能窮舉。
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

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
    .select('id, name, leader_name, pin_hash, failed_pin_attempts, pin_locked_until')
    .eq('id', id)
    .eq('group_id', groupId)
    .single()

  if (error || !club) return NextResponse.json({ error: '找不到此球隊' }, { status: 404 })

  // 鎖定中：直接拒絕，不比對 PIN，也不累加次數
  if (club.pin_locked_until && new Date(club.pin_locked_until) > new Date()) {
    const remainMs = new Date(club.pin_locked_until).getTime() - Date.now()
    const remainMin = Math.max(1, Math.ceil(remainMs / 60000))
    return NextResponse.json(
      { error: `PIN 錯誤次數過多，請於 ${remainMin} 分鐘後再試`, lockedUntil: club.pin_locked_until },
      { status: 429 }
    )
  }

  const valid = await verifyPin(pin, club.pin_hash)

  if (!valid) {
    // 鎖定期已過的話，這次算重新起算的第一次
    const expired = club.pin_locked_until && new Date(club.pin_locked_until) <= new Date()
    const attempts = (expired ? 0 : club.failed_pin_attempts ?? 0) + 1
    const shouldLock = attempts >= MAX_ATTEMPTS

    await supabase
      .from('clubs')
      .update({
        failed_pin_attempts: shouldLock ? 0 : attempts,
        pin_locked_until: shouldLock
          ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
          : null,
      })
      .eq('id', id)

    if (shouldLock) {
      return NextResponse.json(
        { error: `PIN 錯誤次數過多，已鎖定 ${LOCK_MINUTES} 分鐘` },
        { status: 429 }
      )
    }

    const left = MAX_ATTEMPTS - attempts
    return NextResponse.json(
      { error: `PIN 碼錯誤，再錯 ${left} 次將鎖定 ${LOCK_MINUTES} 分鐘`, attemptsLeft: left },
      { status: 401 }
    )
  }

  // 驗證成功：清除累計次數與鎖定
  if (club.failed_pin_attempts > 0 || club.pin_locked_until) {
    await supabase
      .from('clubs')
      .update({ failed_pin_attempts: 0, pin_locked_until: null })
      .eq('id', id)
  }

  return NextResponse.json({ id: club.id, name: club.name, leaderName: club.leader_name })
}
