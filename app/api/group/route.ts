import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hashPin, verifyPin } from '@/lib/crypto'

export const dynamic = "force-dynamic";

const VERIFY_CODE_TTL_MS = 10 * 60 * 1000 // 驗證碼有效 10 分鐘

interface GroupUpdates {
  name?: string;
  contact_email?: string;
  restock_password?: string | null;
}

// 建立 service role client（跨 group 檢查驗證碼碰撞需繞過 RLS）
async function createAdminClient(): Promise<SupabaseClient> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) {
    throw new Error('系統配置錯誤：缺少 Service Role 設定')
  }
  const { createClient: create } = await import('@supabase/supabase-js')
  return create(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// 產生一組未與其他 group「未過期驗證碼」碰撞的 6 碼
async function generateUniqueVerifyCode(admin: SupabaseClient): Promise<string> {
  const nowIso = new Date().toISOString()
  for (let attempt = 0; attempt < 5; attempt++) {
    const buf = crypto.getRandomValues(new Uint32Array(1))
    const code = String(buf[0] % 1000000).padStart(6, '0')
    const { data } = await admin
      .from('groups')
      .select('id')
      .eq('line_verify_code', code)
      .gt('line_verify_expires_at', nowIso)
      .limit(1)
    if (!data || data.length === 0) return code
  }
  throw new Error('驗證碼產生失敗，請稍後再試')
}

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', user.id)
      .single()

    if (!profile?.group_id) {
      return NextResponse.json({ error: 'No group assigned' }, { status: 404 })
    }

    const { data: group, error } = await supabase
      .from('groups')
      .select('name, contact_email, restock_password, line_enabled, line_user_id')
      .eq('id', profile.group_id)
      .single()

    if (error) throw error

    return NextResponse.json({
      name: group.name,
      contactEmail: group.contact_email || "",
      hasRestockPassword: !!group.restock_password,
      lineEnabled: !!group.line_enabled,
      lineBound: !!group.line_user_id,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, contactEmail, restockPassword, currentRestockPassword, lineAction } = await request.json()

    // --- LINE 通知綁定相關操作（獨立分支，處理完即回傳）---
    if (lineAction !== undefined) {
      const { data: lineProfile } = await supabase
        .from('profiles')
        .select('group_id')
        .eq('id', user.id)
        .single()

      if (!lineProfile?.group_id) {
        return NextResponse.json({ error: 'No group assigned' }, { status: 404 })
      }

      const admin = await createAdminClient()

      if (lineAction === 'enable' || lineAction === 'regenerate') {
        const code = await generateUniqueVerifyCode(admin)
        const expiresAt = new Date(Date.now() + VERIFY_CODE_TTL_MS).toISOString()
        const { error: codeError } = await admin
          .from('groups')
          .update({ line_enabled: true, line_verify_code: code, line_verify_expires_at: expiresAt })
          .eq('id', lineProfile.group_id)
        if (codeError) throw codeError
        return NextResponse.json({ code, expiresAt })
      }

      if (lineAction === 'unbind') {
        const { error: unbindError } = await admin
          .from('groups')
          .update({
            line_enabled: false,
            line_user_id: null,
            line_verify_code: null,
            line_verify_expires_at: null,
          })
          .eq('id', lineProfile.group_id)
        if (unbindError) throw unbindError
        return NextResponse.json({ message: '已解除 LINE 綁定' })
      }

      return NextResponse.json({ error: '未知的 LINE 操作' }, { status: 400 })
    }

    if (contactEmail !== undefined && contactEmail !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(contactEmail)) {
        return NextResponse.json({ error: '無效的電子信箱格式' }, { status: 400 })
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', user.id)
      .single()

    if (!profile?.group_id) {
      return NextResponse.json({ error: 'No group assigned' }, { status: 404 })
    }

    const { data: group, error: fetchError } = await supabase
      .from('groups')
      .select('restock_password')
      .eq('id', profile.group_id)
      .single()
    
    if (fetchError) throw fetchError

    const updates: GroupUpdates = {}
    if (name !== undefined) updates.name = name
    if (contactEmail !== undefined) updates.contact_email = contactEmail
    
    if (restockPassword !== undefined || currentRestockPassword !== undefined) {
      const isValid = await verifyPin(currentRestockPassword, group.restock_password)
      if (!isValid) {
        return NextResponse.json({ error: '入庫密碼驗證失敗' }, { status: 401 })
      }

      if (restockPassword !== undefined) {
        updates.restock_password = restockPassword === "" ? null : await hashPin(restockPassword)
      }
    }

    const { error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', profile.group_id)

    if (error) throw error

    return NextResponse.json({ message: 'Settings updated successfully' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  // 使用 Service Role Key 初始化管理級用戶端 (僅限後端使用)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("Missing Service Role Key or Supabase URL")
    return NextResponse.json({ error: '系統配置錯誤，請聯繫管理員' }, { status: 500 })
  }

  // 建立高權限用戶端以執行連鎖刪除與 Auth 管理
  const { createClient: createAdminClient } = await import('@supabase/supabase-js')
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // 一般用戶端用於驗證當前身份
  const userSupabase = await createClient()

  try {
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { confirmName } = await request.json()

    // 取得當前球團資訊以進行校驗
    const { data: profile } = await userSupabase
      .from('profiles')
      .select('group_id')
      .eq('id', user.id)
      .single()

    if (!profile?.group_id) {
      return NextResponse.json({ error: '找不到對應的球團紀錄' }, { status: 404 })
    }

    const { data: group } = await adminClient
      .from('groups')
      .select('name')
      .eq('id', profile.group_id)
      .single()

    if (!group || group.name !== confirmName) {
      return NextResponse.json({ error: '球團名稱輸入錯誤，驗證失敗' }, { status: 400 })
    }

    // --- 開始執行連鎖刪除 (使用 AdminClient 確保能清理所有內容) ---

    // 1. 先移除 Auth User：若此步驟失敗則中止，業務資料保持完整
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.id)
    if (authDeleteError) {
      console.error("Auth delete error:", authDeleteError)
      return NextResponse.json({ error: '帳號刪除失敗，請稍後再試' }, { status: 500 })
    }

    // 2. Auth 已刪除，清理業務資料（使用者已無法登入）
    await adminClient.from('pickup_records').delete().eq('group_id', profile.group_id)
    await adminClient.from('restock_records').delete().eq('group_id', profile.group_id)
    await adminClient.from('shuttlecock_types').delete().eq('group_id', profile.group_id)
    await adminClient.from('profiles').delete().eq('group_id', profile.group_id)
    await adminClient.from('groups').delete().eq('id', profile.group_id)

    // 3. 清除 Session Cookie
    const response = NextResponse.json({ message: '帳號與資料已永久移除' })
    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    console.error("Delete Group Error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
