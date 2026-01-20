import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 允許緩存，但設置較短的 revalidate 時間（30秒）
export const revalidate = 30;

export async function GET(request: Request) {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 取得使用者的 group_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.group_id) {
      console.error('Inventory API 403 debug:', { 
        userId: user.id, 
        profileError, 
        profile 
      })
      return NextResponse.json({ error: 'User has no group assigned' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const showAll = searchParams.get('all') === 'true'

    let query = supabase
      .from('inventory_summary')
      .select('*')
      .eq('group_id', profile.group_id)
    
    if (!showAll) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching inventory summary:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
