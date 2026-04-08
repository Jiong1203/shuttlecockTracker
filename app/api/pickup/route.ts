import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupId } from '@/lib/supabase/helpers'

// 允許緩存，但設置較短的 revalidate 時間（30秒）
export const revalidate = 30;

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
      .limit(100)

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

    const { picker_name, quantity, type_id, pickup_date } = await request.json()

    if (!picker_name || !quantity) {
      return NextResponse.json({ error: '缺少姓名或數量' }, { status: 400 })
    }

    if (!type_id) {
      return NextResponse.json({ error: '缺少球種' }, { status: 400 })
    }

    // 透過 DB function 原子性執行庫存檢查 + 插入，防止並發競爭
    const { data, error } = await supabase.rpc('insert_pickup_record', {
      p_picker_name: picker_name,
      p_quantity: quantity,
      p_group_id: groupId,
      p_type_id: type_id,
      ...(pickup_date ? { p_pickup_date: pickup_date } : {}),
    })

    if (error) {
      const status = error.message.includes('庫存不足') ? 400 : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    return NextResponse.json(data[0])
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
