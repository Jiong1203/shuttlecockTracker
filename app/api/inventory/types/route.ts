import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = "force-dynamic";

async function getGroupId(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('group_id')
    .eq('id', user.id)
    .single()
  
  return profile?.group_id
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const showAll = searchParams.get('all') === 'true'

  try {
    const groupId = await getGroupId(supabase)
    if (!groupId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('shuttlecock_types')
      .select('*')
      .eq('group_id', groupId)
    
    if (!showAll) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
      console.error("Error fetching types:", err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  try {
    const groupId = await getGroupId(supabase)
    if (!groupId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { brand, name } = await request.json()

    if (!brand || !name) {
      return NextResponse.json({ error: 'Missing brand or name' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('shuttlecock_types')
      .insert([{ 
        group_id: groupId, 
        brand, 
        name,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("Error creating type:", err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  try {
    const groupId = await getGroupId(supabase)
    if (!groupId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, is_active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Missing type ID' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('shuttlecock_types')
      .update({ is_active })
      .eq('id', id)
      .eq('group_id', groupId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("Error updating type:", err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
