import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 取得使用者的 group_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', user.id)
      .single()

    if (!profile?.group_id) {
      return NextResponse.json({ error: 'User has no group assigned' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('inventory_summary')
      .select('*')
      .eq('group_id', profile.group_id)
      .single()

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
