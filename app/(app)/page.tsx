import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { InventoryDisplay } from "@/components/inventory-display"
import { InventoryStats } from "@/components/inventory-stats"
import { ClientWrapper } from "./client-wrapper"

type GroupSummary = {
  id: string
  name: string
  contact_email: string | null
}

async function getInventoryData() {
  const supabase = await createClient()

  // middleware 已驗證過 token，這裡直接從 cookie 讀 session，省掉一次網路呼叫
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/login')
  const userId = session.user.id

  // 取得 profile + group（合併為一次查詢）
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('group_id, groups(id, name, contact_email)')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.group_id) redirect('/login')

  const groupId = profile.group_id

  // 本月起始（以台北時區 UTC+8 計算），供「本月取用」統計使用
  const now = new Date()
  const taipei = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const monthStartISO = new Date(
    Date.UTC(taipei.getUTCFullYear(), taipei.getUTCMonth(), 1) - 8 * 60 * 60 * 1000
  ).toISOString()

  // 並行獲取庫存、領取紀錄、本月取用彙總
  const [inventoryResult, pickupResult, monthlyPickupResult] = await Promise.all([
    supabase
      .from('inventory_summary')
      .select('*')
      .eq('group_id', groupId),
    supabase
      .from('pickup_records')
      .select('*, shuttlecock_types(brand, name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('pickup_records')
      .select('quantity')
      .eq('group_id', groupId)
      .gte('created_at', monthStartISO),
  ])

  const inventory = inventoryResult.data || []
  const records = pickupResult.data || []
  const monthlyRows = (monthlyPickupResult.data || []) as { quantity: number | null }[]
  const groups = profile.groups as GroupSummary | GroupSummary[] | null
  const group = Array.isArray(groups) ? groups[0] : groups

  const monthlyPickupQty = monthlyRows.reduce((acc, r) => acc + (r.quantity || 0), 0)
  const monthlyPickupCount = monthlyRows.length

  return {
    inventory: Array.isArray(inventory) ? inventory : [inventory],
    records,
    group,
    monthlyPickupQty,
    monthlyPickupCount,
  }
}

type InventoryStatRow = {
  is_active?: boolean
  total_restocked?: number | null
  current_stock?: number | null
  low_stock_threshold?: number | null
}

export default async function Home() {
  const { inventory, records, group, monthlyPickupQty, monthlyPickupCount } = await getInventoryData()

  const totalCurrentStock = inventory.reduce((acc, item) => acc + (item.current_stock || 0), 0)

  // KPI 統計（低庫存準則與低庫存通知一致：啟用 + 曾進貨 + 低於門檻）
  const invRows = inventory as InventoryStatRow[]
  const activeRows = invRows.filter((i) => i.is_active)
  const totalActiveStock = activeRows.reduce((acc, i) => acc + (i.current_stock || 0), 0)
  const lowStockCount = invRows.filter(
    (i) => i.is_active && (i.total_restocked || 0) > 0 && (i.current_stock || 0) < (i.low_stock_threshold ?? 5)
  ).length

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
          <InventoryStats
            totalStock={totalActiveStock}
            activeTypeCount={activeRows.length}
            totalTypeCount={invRows.length}
            lowStockCount={lowStockCount}
            monthlyPickupQty={monthlyPickupQty}
            monthlyPickupCount={monthlyPickupCount}
          />

          {inventory && (
            <InventoryDisplay stocks={inventory.filter(i => i.is_active)} />
          )}

          <ClientWrapper
            variant="content"
            groupName={group?.name || ""}
            inventory={inventory}
            records={records}
            totalCurrentStock={totalCurrentStock}
          />

          <footer className="py-12 text-center text-slate-300 text-sm">
            &copy; 2026 動資訊有限公司 MovIT. All rights reserved.
          </footer>
      </div>
    </div>
  )
}
