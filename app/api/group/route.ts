import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = "force-dynamic";

interface GroupUpdates {
  name?: string;
  contact_email?: string;
  restock_password?: string | null;
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
      .select('name, contact_email, restock_password')
      .eq('id', profile.group_id)
      .single()

    if (error) throw error

    return NextResponse.json({
      name: group.name,
      contactEmail: group.contact_email || "",
      hasRestockPassword: !!group.restock_password
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

    const { name, contactEmail, restockPassword, currentRestockPassword } = await request.json()

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
      // 驗證原密碼
      const effectiveOldPassword = group.restock_password || '1111'
      if (currentRestockPassword !== effectiveOldPassword) {
        return NextResponse.json({ error: '入庫密碼驗證失敗' }, { status: 401 })
      }
      
      if (restockPassword !== undefined) {
        updates.restock_password = restockPassword === "" ? null : restockPassword
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

    // 1. 刪除相關業務資料 (因 RLS 可能限制 DELETE，使用 adminClient)
    await adminClient.from('pickup_records').delete().eq('group_id', profile.group_id)
    await adminClient.from('restock_records').delete().eq('group_id', profile.group_id)
    await adminClient.from('shuttlecock_types').delete().eq('group_id', profile.group_id)

    
    // 2. 刪除 Profiles 與 Groups
    await adminClient.from('profiles').delete().eq('group_id', profile.group_id)
    const { error: groupDeleteError } = await adminClient.from('groups').delete().eq('id', profile.group_id)
    
    if (groupDeleteError) throw groupDeleteError

    // 3. 核心動作：移除 Auth User
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.id)
    if (authDeleteError) {
        console.error("Auth delete error:", authDeleteError)
        // 即使 Auth 刪除失敗 (可能是連線問題)，資料已清空，紀錄日誌後繼續
    }

    // 4. 清除 Session Cookie
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
