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

export async function POST(request: Request) {
  const supabase = await createClient()
  try {
    const groupId = await getGroupId(supabase)
    if (!groupId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { amount, password, type_id, unit_price } = await request.json()

    if (!amount || amount < 1) {
      return NextResponse.json({ error: '進貨數量必須至少為 1 桶' }, { status: 400 })
    }
    
    if (!type_id) {
       return NextResponse.json({ error: '必須選擇球種' }, { status: 400 })
    }

    // 檢查是否有設定入庫密碼
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('restock_password')
      .eq('id', groupId)
      .single()
    
    if (groupError) throw groupError

    const effectivePassword = group.restock_password || '1111'

    if (effectivePassword !== password) {
      return NextResponse.json({ error: '入庫管理密碼錯誤' }, { status: 401 })
    }

    // 新增入庫紀錄
    const { error: insertError } = await supabase
      .from('restock_records')
      .insert({ 
        group_id: groupId, 
        shuttlecock_type_id: type_id,
        quantity: parseInt(amount, 10),
        unit_price: unit_price ? parseInt(unit_price, 10) : 0,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
    
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: '進貨成功'
    })
  } catch (error) {
    console.error("Restock error:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
