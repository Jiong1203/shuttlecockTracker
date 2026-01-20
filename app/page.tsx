import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { InventoryDisplay } from "@/components/inventory-display"
import { ClientWrapper } from "./client-wrapper"

async function getInventoryData() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 取得使用者的 group_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('group_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.group_id) {
    redirect('/login')
  }

  // 並行獲取數據
  const [inventoryResult, pickupResult, groupResult] = await Promise.all([
    supabase
      .from('inventory_summary')
      .select('*')
      .eq('group_id', profile.group_id),
    supabase
      .from('pickup_records')
      .select('*, shuttlecock_types(brand, name)')
      .eq('group_id', profile.group_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('*, groups(*)')
      .eq('id', user.id)
      .single()
  ])

  const inventory = inventoryResult.data || []
  const records = pickupResult.data || []
  const group = groupResult.data?.groups || null

  return {
    inventory: Array.isArray(inventory) ? inventory : [inventory],
    records,
    group
  }
}

export default async function Home() {
  const { inventory, records, group } = await getInventoryData()
  
  const totalCurrentStock = inventory.reduce((acc, item) => acc + (item.current_stock || 0), 0)

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="bg-card p-5 md:p-6 rounded-2xl shadow-sm border border-border space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">羽球庫存共享小幫手</h1>
              <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                <span className="bg-blue-600 dark:bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider shadow-sm uppercase">Beta</span>
                <span className="text-muted-foreground text-sm font-semibold tracking-tight">Shuttlecock Tracker</span>
              </div>
            </div>

            <ClientWrapper variant="header" groupName={group?.name || ""} />
          </div>

          {group ? (
            <div className="group-name-block flex flex-col sm:flex-row items-center gap-3 p-3 md:p-4 rounded-xl border border-blue-100 dark:border-blue-400/30 shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md">
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-blue-600 dark:bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md tracking-widest uppercase shadow-sm shadow-blue-500/30">當前球團</span>
              </div>
              <div className="text-blue-600 dark:text-blue-200 font-bold text-lg md:text-xl text-center sm:text-left break-words w-full tracking-tight drop-shadow-sm">
                {group.name}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-border italic text-muted-foreground text-sm justify-center sm:justify-start">
              未載入球團資訊...
            </div>
          )}
        </header>

        {inventory && (
          <>
            <InventoryDisplay stocks={inventory.filter(i => i.is_active)} />
          </>
        )}

        <ClientWrapper 
          variant="content"
          groupName={group?.name || ""} 
          inventory={inventory}
          records={records}
          totalCurrentStock={totalCurrentStock}
          currentStock={totalCurrentStock}
        />

        <footer className="py-12 text-center text-slate-300 text-sm">
          &copy; 2025 動資訊有限公司 MovIT. All rights reserved.
        </footer>
      </div>
    </main>
  )
}
