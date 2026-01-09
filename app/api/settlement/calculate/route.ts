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

interface RestockBatch {
    id: string;
    quantity: number;
    remaining: number;
    unit_price: number;
    created_at: string;
}

interface Pickup {
    id: string;
    quantity: number;
    created_at: string;
    shuttlecock_type_id: string;
}

export async function POST(request: Request) {
  const supabase = await createClient()
  try {
    const groupId = await getGroupId(supabase)
    if (!groupId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { start_date, end_date, picker_name } = await request.json()

    // 1. 獲取所有入庫紀錄 (依時間排序)
    const { data: restocks, error: restockError } = await supabase
        .from('restock_records')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true }) // 先進先出

    if (restockError) throw restockError;

    // 2. 獲取所有領取紀錄 (依時間排序)
    // 注意: 即便是查詢此區間的成本，也必須從頭計算消耗，才能知道當下用的是哪一批貨
    const { data: allPickups, error: pickupError } = await supabase
        .from('pickup_records')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })

    if (pickupError) throw pickupError;

    // 將資料依球種分組
    const typeIds = Array.from(new Set(restocks.map((r: any) => r.shuttlecock_type_id)));
    
    // 結果物件
    const result_details: any[] = [];
    let grand_total_cost = 0;

    for (const typeId of typeIds) {
        // 篩選該球種的資料
        const typeRestocks = restocks.filter((r: any) => r.shuttlecock_type_id === typeId).map((r: any) => ({
            ...r,
            remaining: r.quantity
        }));
        
        const typePickups = allPickups.filter((p: any) => p.shuttlecock_type_id === typeId);

        let typeTotalCost = 0;
        let typeUsageCount = 0;
        const usedBatches: { price: number, quantity: number }[] = [];

        // 開始模擬消耗
        for (const pickup of typePickups) {
            let quantityToPick = pickup.quantity;
            let currentPickupCost = 0;
            
            // 判斷該領取是否在查詢區間內，且符合姓名篩選
            const isWithinPeriod = (!start_date || new Date(pickup.created_at) >= new Date(start_date)) &&
                                   (!end_date || new Date(pickup.created_at) <= new Date(end_date)) &&
                                   (!picker_name || pickup.picker_name.includes(picker_name));

            while (quantityToPick > 0) {
                // 找最早且還有剩餘的批次
                const batchIndex = typeRestocks.findIndex((b: RestockBatch) => b.remaining > 0);
                
                if (batchIndex === -1) {
                    // 庫存不足，假設成本為 0 或最後一批價格? 這裡暫且當作 0 並記錄異常，或是使用最後已知價格
                    // 簡單處理: 視為 0 成本 (或是系統預設異常)
                    console.warn(`Type ${typeId} inventory depleted!`);
                    quantityToPick = 0; 
                    break;
                }

                const batch = typeRestocks[batchIndex];
                const amountFromBatch = Math.min(batch.remaining, quantityToPick);

                // 扣除庫存
                batch.remaining -= amountFromBatch;
                quantityToPick -= amountFromBatch;

                // 如果在區間內，累計成本
                if (isWithinPeriod) {
                    const cost = amountFromBatch * batch.unit_price;
                    currentPickupCost += cost;
                    
                    // 記錄使用的批次細節 (合併相同價格)
                    const existingBatch = usedBatches.find(b => b.price === batch.unit_price);
                    if (existingBatch) {
                        existingBatch.quantity += amountFromBatch;
                    } else {
                        usedBatches.push({ price: batch.unit_price, quantity: amountFromBatch });
                    }
                }
            }

            if (isWithinPeriod) {
                typeTotalCost += currentPickupCost;
                typeUsageCount += pickup.quantity; // 注意：這裡若是庫存不足其實沒扣到，但邏輯上算消耗量
            }
        }

        if (typeUsageCount > 0) {
            grand_total_cost += typeTotalCost;
            
            // 取得球種名稱 (需額外查詢或是 join，這裡簡化先回傳 ID，前端可能已有 Map)
            result_details.push({
                type_id: typeId,
                total_quantity: typeUsageCount,
                total_cost: typeTotalCost,
                average_cost: typeTotalCost / typeUsageCount,
                used_batches: usedBatches.sort((a, b) => a.price - b.price)
            });
        }
    }

    return NextResponse.json({
        period: { start: start_date, end: end_date },
        grand_total_cost,
        details: result_details
    })

  } catch (error) {
    console.error("Settlement Calc Error:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
