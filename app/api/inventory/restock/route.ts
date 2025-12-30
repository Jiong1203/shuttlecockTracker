import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { password, amount } = await request.json()

    // 1. 驗證密碼
    if (password !== "1111") {
      return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
    }

    if (!amount || amount < 1) {
      return NextResponse.json({ error: '進貨數量必須至少為 1 桶' }, { status: 400 })
    }

    // 2. 獲取現有的庫存配置 (不限制 ID)
    const { data: configList, error: fetchError } = await supabase
      .from('inventory_config')
      .select('*')
      .limit(1)

    if (fetchError || !configList || configList.length === 0) {
      return NextResponse.json({ error: '找不到庫存配置紀錄，請確認資料庫已正確初始化' }, { status: 500 })
    }

    const currentConfig = configList[0]

    // 3. 更新初始庫存量 (動態使用找到的 ID)
    const newStock = currentConfig.initial_quantity + parseInt(amount, 10)

    const { error: updateError } = await supabase
      .from('inventory_config')
      .update({ initial_quantity: newStock })
      .eq('id', currentConfig.id) 

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }


    return NextResponse.json({ 
      message: '進貨成功', 
      new_initial_stock: newStock 
    })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
