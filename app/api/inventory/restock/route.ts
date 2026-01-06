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

    const { amount, password } = await request.json()

    if (!amount || amount < 1) {
      return NextResponse.json({ error: '進貨數量必須至少為 1 桶' }, { status: 400 })
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

    // 獲取該團體現有的庫存配置
    const { data: configList, error: fetchError } = await supabase
      .from('inventory_config')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    let newStock = 0
    if (!configList || configList.length === 0) {
      // 如果還沒有配置，建立一個
      newStock = parseInt(amount, 10)
      const { error: insertError } = await supabase
        .from('inventory_config')
        .insert({ group_id: groupId, initial_quantity: newStock })
      
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    } else {
      // 獲取最新的一筆並更新
      const currentConfig = configList[0]
      newStock = currentConfig.initial_quantity + parseInt(amount, 10)

      const { error: updateError } = await supabase
        .from('inventory_config')
        .update({ initial_quantity: newStock })
        .eq('id', currentConfig.id)

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: '進貨成功', 
      new_initial_stock: newStock 
    })
  } catch (error) {
    console.error("Restock error:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
