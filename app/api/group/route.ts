import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = "force-dynamic";

interface GroupUpdates {
  name?: string;
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
      .select('name, restock_password')
      .eq('id', profile.group_id)
      .single()

    if (error) throw error

    return NextResponse.json({
      name: group.name,
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

    const { name, restockPassword, currentRestockPassword } = await request.json()

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
