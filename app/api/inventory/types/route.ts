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

interface TypeUpdate {
    is_active?: boolean;
    brand?: string;
    name?: string;
    created_by?: string;

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

    // 獲取球種基本資料 (移除 View Join 避免重複)
    const { data: rawTypes, error: typesError } = await supabase
      .from('shuttlecock_types')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
    
    if (typesError) {
      return NextResponse.json({ error: typesError.message }, { status: 500 })
    }

    // 獲取有紀錄的球種 ID 列表 (從 inventory_summary 獲取)
    const { data: summaries } = await supabase
      .from('inventory_summary')
      .select('shuttlecock_type_id, total_picked')
      .eq('group_id', groupId)

    const recordMap = new Map((summaries || []).map(s => [s.shuttlecock_type_id, s.total_picked > 0]));

    // 獲取當前使用者以判斷編輯權限
    const { data: { user } } = await supabase.auth.getUser()

    // 處理回傳結構，加上 can_edit 與 has_records 標記，並透過 Set 與 filter 確保唯一性
    const seenIds = new Set();
    const data = (rawTypes || [])
        .filter(item => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return showAll || item.is_active;
        })
        .map(item => ({
            id: item.id,
            brand: item.brand,
            name: item.name,
            is_active: item.is_active,
            // 允許編輯的情況：1. 系統預設球種 2. 自己建立的球種
            can_edit: (!item.created_by && (item.brand === 'System' && item.name === '預設系統球種')) || (user && item.created_by === user.id),
            has_records: recordMap.get(item.id) || false
        }));

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

    const { id, is_active, brand, name, update_historical_price } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Missing type ID' }, { status: 400 })
    }

    // 更新內容準備
    const updates: TypeUpdate = {}
    if (is_active !== undefined) updates.is_active = is_active
    
    // 獲取當前使用者資訊 (供後續檢查使用)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 如果帶有 brand 或 name，執行權限檢查與資料處理
    if (brand !== undefined || name !== undefined) {

        const { data: typeToCheck } = await supabase
            .from('shuttlecock_types')
            .select('created_by, brand, name')
            .eq('id', id)
            .single()
        
        // 檢查權限：
        // 1. 如果有 created_by，必須是當前使用者
        // 2. 如果沒有 created_by (系統球種)，允許編輯（並將在下方接管所有權）
        if (typeToCheck?.created_by && typeToCheck.created_by !== user.id) {
            return NextResponse.json({ error: '您無權限編輯此球種' }, { status: 403 })
        }
        
        // 3. 再次確認系統球種的特徵 (雖然 created_by check 已經涵蓋，但雙重確認更安全)
        if (!typeToCheck?.created_by && (typeToCheck?.brand !== 'System' || typeToCheck?.name !== '預設系統球種')) {
             // 理論上不會發生，因為沒有 created_by 的應該只有那一個，但防禦性編碼
             return NextResponse.json({ error: '無法編輯此系統內容' }, { status: 403 })
        }

        if (brand) updates.brand = brand
        if (name) updates.name = name
        
        // 如果原本是系統球種 (created_by 為空)，現在編輯了，就要接管所有權
        if (!typeToCheck?.created_by) {
            updates.created_by = user.id
        }
    }

    // 批量更新歷史金額功能 (僅更新既有紀錄)
    if (update_historical_price !== undefined && typeof update_historical_price === 'number') {
        const { error: batchUpdateError } = await supabase
            .from('restock_records')
            .update({ unit_price: update_historical_price })
            .eq('shuttlecock_type_id', id)
            .eq('group_id', groupId)

        if (batchUpdateError) {
             console.error("Batch update price error:", batchUpdateError)
             return NextResponse.json({ error: 'Failed to update historical prices' }, { status: 500 })
        }
    }

    const { data, error } = await supabase
      .from('shuttlecock_types')
      .update(updates)
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
      return NextResponse.json({ error: 'Missing type ID' }, { status: 400 })
    }

    // 1. 嚴格檢查領取紀錄 (直接查詢領取紀錄表)
    const { data: pickupRecord, error: pickupError } = await supabase
        .from('pickup_records')
        .select('id')
        .eq('shuttlecock_type_id', id)
        .limit(1)
        .maybeSingle()
    
    if (pickupError) throw pickupError;
    if (pickupRecord) {
        return NextResponse.json({ error: '此球種已有領取紀錄，為了歷史報表完整性無法刪除 (請使用隱藏功能)' }, { status: 400 })
    }

    // 2. 自動清理相關進貨紀錄 (不論數量，只要無領取即允許刪除)
    // 確保帶上 group_id 以符合 RLS DELETE 通道
    const { error: restockClearError } = await supabase
        .from('restock_records')
        .delete()
        .eq('shuttlecock_type_id', id)
        .eq('group_id', groupId)
    
    if (restockClearError) {
        console.error("Failed to clear restock records:", restockClearError)
        return NextResponse.json({ error: `清理進貨紀錄時發生錯誤: ${restockClearError.message}` }, { status: 500 })
    };

    // 3. 嘗試清理可能存在的舊配置表關聯 (防禦性清理)
    try {
        await supabase
            .from('inventory_config')
            .delete()
            .eq('shuttlecock_type_id', id)
    } catch {
        // Ignore if table/column doesn't exist
    }

    const { error: deleteError } = await supabase
      .from('shuttlecock_types')
      .delete()
      .eq('id', id)
      .eq('group_id', groupId)

    if (deleteError) {
        console.error("Full delete error details:", deleteError)
        if (deleteError.code === '23503') {
            return NextResponse.json({ 
                error: '資料庫仍存有與此球種關聯的資料 (如結算紀錄或隱藏紀錄)，請聯繫系統管理員，或改用「隱藏」功能。' 
            }, { status: 400 })
        }
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Deleted successfully' })
  } catch (err) {
    console.error("Error deleting type:", err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
