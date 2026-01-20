import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

// 允許緩存，但設置較短的 revalidate 時間（30秒）
export const revalidate = 30;

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

export async function GET() {
  const supabase = await createClient()

  try {
    const groupId = await getGroupId(supabase)
    if (!groupId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('pickup_records')
      .select('*, shuttlecock_types(brand, name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
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

    const { picker_name, quantity, type_id } = await request.json()

    if (!picker_name || !quantity) {
      return NextResponse.json({ error: 'Missing name or quantity' }, { status: 400 })
    }
    
    if (!type_id) {
       return NextResponse.json({ error: 'Missing type_id' }, { status: 400 })
    }

    // Check current stock
    const { data: stockData } = await supabase
      .from('inventory_summary')
      .select('current_stock')
      .eq('group_id', groupId)
      .eq('shuttlecock_type_id', type_id)
      .single()

    const currentStock = stockData?.current_stock || 0
    if (quantity > currentStock) {
        return NextResponse.json({ error: `庫存不足，目前僅剩 ${currentStock} 桶` }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pickup_records')
      .insert([{ 
        picker_name, 
        quantity, 
        group_id: groupId, 
        shuttlecock_type_id: type_id 
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  try {
    const groupId = await getGroupId(supabase)
    if (!groupId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing record ID' }, { status: 400 })
    }

    const { error } = await supabase
      .from('pickup_records')
      .delete()
      .eq('id', id)
      .eq('group_id', groupId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Record deleted successfully' })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
