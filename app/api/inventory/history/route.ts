import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getGroupId } from '@/lib/supabase/helpers'

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const groupId = await getGroupId(supabase)
    if (!groupId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('restock_records')
      .select(`
        *,
        shuttlecock_types (
          brand,
          name
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
        query = query.lte('created_at', endDate)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const formattedData = data.map(record => ({
        id: record.id,
        date: record.created_at,
        brand: record.shuttlecock_types?.brand || 'Unknown',
        name: record.shuttlecock_types?.name || 'Unknown',
        quantity: record.quantity,
        unit_price: record.unit_price,
        total_price: record.quantity * record.unit_price,
        created_by_email: 'System' // 暫時無法直接關聯取得 email
    }))

    return NextResponse.json(formattedData)
    
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
