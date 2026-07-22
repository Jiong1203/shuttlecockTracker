import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { replyLineMessage } from '@/lib/line'

// webhook 需讀原始 body 與 header、以 service role 跨 group 反查，必須動態執行
export const dynamic = 'force-dynamic'

// LINE 傳來的 webhook 事件（僅取用到的欄位）
interface LineMessageEvent {
  type: string
  replyToken?: string
  source?: { userId?: string }
  message?: { type: string; text?: string }
}

// 以 Channel Secret 對「原始 body 字串」做 HMAC-SHA256 → base64，與 x-line-signature 比對。
// 必須使用原始字串（不可先 JSON.parse 再 stringify，序列化差異會導致驗章失敗）。
async function verifySignature(secret: string, rawBody: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = Buffer.from(new Uint8Array(sig)).toString('base64')
  return timingSafeEqual(expected, signature)
}

// 等長逐位比較，避免 timing attack
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  if (!channelSecret) {
    console.error('LINE webhook 未設定 LINE_CHANNEL_SECRET')
    return NextResponse.json({ error: '系統配置錯誤' }, { status: 500 })
  }

  // 1) 取原始 body（簽章驗證用）
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature') ?? ''

  // 2) 驗簽：不符一律拒絕，避免偽造事件
  const valid = await verifySignature(channelSecret, rawBody, signature)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) {
    console.error('LINE webhook 缺少 Service Role 設定')
    return NextResponse.json({ error: '系統配置錯誤' }, { status: 500 })
  }

  // service role client：webhook 無 cookie session，需繞過 RLS 跨 group 反查與寫入
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const body = JSON.parse(rawBody) as { events?: LineMessageEvent[] }
    const events = body.events ?? []

    // LINE 在設定 webhook URL 時會送空 events 的驗證請求 → 直接回 200
    for (const event of events) {
      if (event.type !== 'message' || event.message?.type !== 'text') continue

      const userId = event.source?.userId
      const replyToken = event.replyToken
      const text = (event.message.text ?? '').trim()

      if (!userId || !replyToken) continue

      // 僅處理 6 碼數字驗證碼，其餘文字給固定說明
      if (!/^\d{6}$/.test(text)) {
        await replyLineMessage({
          replyToken,
          text: '請輸入設定頁顯示的 6 位數字驗證碼以完成綁定。',
        }).catch((e) => console.error('LINE reply 失敗:', e))
        continue
      }

      // 依驗證碼反查（不限時效，時效在 JS 端判斷以便給明確訊息）
      const { data: matches, error } = await admin
        .from('groups')
        .select('id, name, line_verify_expires_at')
        .eq('line_verify_code', text)
        .returns<{ id: string; name: string; line_verify_expires_at: string | null }[]>()

      if (error) throw error

      const now = Date.now()
      const activeMatches = (matches ?? []).filter(
        (g) => g.line_verify_expires_at !== null && new Date(g.line_verify_expires_at).getTime() > now
      )

      if (activeMatches.length === 0) {
        await replyLineMessage({
          replyToken,
          text: '驗證碼無效或已過期，請回設定頁重新產生後再輸入。',
        }).catch((e) => console.error('LINE reply 失敗:', e))
        continue
      }

      if (activeMatches.length > 1) {
        // 6 碼碰撞（機率極低，產碼時已排除，仍做防禦）
        await replyLineMessage({
          replyToken,
          text: '驗證碼發生衝突，請回設定頁重新產生一組新的驗證碼。',
        }).catch((e) => console.error('LINE reply 失敗:', e))
        continue
      }

      const group = activeMatches[0]

      // 綁定：寫入 userId、開啟通知、清除一次性驗證碼
      const { error: updateError } = await admin
        .from('groups')
        .update({
          line_user_id: userId,
          line_enabled: true,
          line_verify_code: null,
          line_verify_expires_at: null,
        })
        .eq('id', group.id)

      if (updateError) throw updateError

      await replyLineMessage({
        replyToken,
        text: `✅ 已成功綁定「${group.name}」的低庫存通知，之後庫存偏低時會在這裡提醒您。`,
      }).catch((e) => console.error('LINE reply 失敗:', e))
    }

    // 一律回 200，避免 LINE 重送
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    // 記錄錯誤但仍回 200，避免 LINE 對非 2xx 反覆重試造成風暴
    console.error('LINE webhook 處理失敗:', error)
    return NextResponse.json({ ok: false })
  }
}
