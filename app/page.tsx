import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { InventoryDisplay } from "@/components/inventory-display"
import { ClientWrapper } from "./client-wrapper"

type GroupSummary = {
  id: string
  name: string
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
    .select('group_id, groups(id, name)')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.group_id) redirect('/login')

  const groupId = profile.group_id

  // 並行獲取庫存與領取紀錄
  const [inventoryResult, pickupResult] = await Promise.all([
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
  ])

  const inventory = inventoryResult.data || []
  const records = pickupResult.data || []
  const groups = profile.groups as GroupSummary | GroupSummary[] | null
  const group = Array.isArray(groups) ? groups[0] : groups

  return {
    inventory: Array.isArray(inventory) ? inventory : [inventory],
    records,
    group,
  }
}

export default async function Home() {
  const { inventory, records, group } = await getInventoryData()
  
  const totalCurrentStock = inventory.reduce((acc, item) => acc + (item.current_stock || 0), 0)

  return (
    <div className="min-h-screen bg-background">
      {/* ── Toolbar ── */}
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-14 flex items-center gap-3">
          {/* 左側：品牌 + 球團名稱 */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <h1 className="text-sm font-black tracking-tight text-foreground whitespace-nowrap">羽球庫存共享小幫手</h1>
              <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wider uppercase">Beta</span>
            </div>

            {group && (
              <>
                <div className="hidden sm:block w-px h-4 bg-border shrink-0" />
                <span className="hidden sm:flex items-center gap-1.5 min-w-0">
                  <span className="bg-blue-600 dark:bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-widest uppercase shrink-0">球團</span>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-300 truncate">{group.name}</span>
                </span>
              </>
            )}
          </div>

          {/* 右側：操作按鈕組 */}
          <ClientWrapper variant="header" groupName={group?.name || ""} />
        </div>
      </header>

      {/* ── 內容區 ── */}
      <main className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
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
      </main>
    </div>
  )
}
