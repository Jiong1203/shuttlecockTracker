import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient()
  
  // Get Group ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No user' })
    
  const { data: profile } = await supabase
    .from('profiles')
    .select('group_id')
    .eq('id', user.id)
    .single()
  
  const groupId = profile?.group_id
  if (!groupId) return NextResponse.json({ error: 'No group' })

  // Get Types
  const { data: types } = await supabase
    .from('shuttlecock_types')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  const result = []

  if (types) {
      for (const type of types) {
          const { data: records } = await supabase
            .from('restock_records')
            .select('id, unit_price, quantity, created_at')
            .eq('shuttlecock_type_id', type.id)
            .eq('group_id', groupId)
          
          result.push({
              type: {
                  id: type.id,
                  brand: type.brand,
                  name: type.name,
                  created_by: type.created_by
              },
              restock_records: records
          })
      }
  }

  return NextResponse.json({
      timestamp: new Date().toISOString(),
      groupId,
      user_id: user.id,
      data: result
  })
}
