'use client'

import { useState, useEffect, useCallback, useMemo } from "react"
import { InventoryDisplay } from "@/components/inventory-display"
import { PickupForm } from "@/components/pickup-form"
import { SettlementDialog } from "@/components/settlement-dialog"
import { RestockForm } from "@/components/restock-form"
import { PickupHistory } from "@/components/pickup-history"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"


import { Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GroupSettingsDialog } from "@/components/group-settings-dialog"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  const [inventory, setInventory] = useState<{
    initial_stock: number;
    total_picked: number;
    current_stock: number;
  } | null>(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<{ name: string } | null>(null)
  
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const fetchData = useCallback(async () => {
    try {
      const [invRes, pickRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/pickup')
      ])
      
      if (!invRes.ok) {
        if (invRes.status === 401) return router.push('/login')
        const errorText = await invRes.text();
        throw new Error(`Inventory API error: ${invRes.status} ${errorText}`);
      }
      if (!pickRes.ok) {
        const errorText = await pickRes.text();
        throw new Error(`Pickup API error: ${pickRes.status} ${errorText}`);
      }

      const invData = await invRes.json()
      const pickData = await pickRes.json()
      
      setInventory(invData)
      setRecords(pickData)
    } catch (error) {
      console.error("Fetch data error:", error)
      alert(error instanceof Error ? error.message : "資料讀取失敗，請檢查資料庫連線與環境變數設定。")
    } finally {
      setLoading(false)
    }
  }, [router])

  const fetchUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, groups(*)')
        .eq('id', user.id)
        .single()
      
      if (profile && profile.groups) {
        setGroup(profile.groups)
      } else {
        // 資料讀取中或發生異常時的處理
        setGroup(null)
      }
    } else {
      router.push('/login')
    }
  }, [supabase, router])

  useEffect(() => {
    fetchUser()
    fetchData()
  }, [fetchUser, fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-slate-500 font-medium">資料讀取中...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-center bg-card p-6 rounded-2xl shadow-sm border border-border gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-black text-foreground tracking-tight">羽球庫存共享小幫手</h1>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
              <span className="bg-blue-600 dark:bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider shadow-sm uppercase">Beta</span>
              <span className="text-muted-foreground text-sm font-semibold tracking-tight">Shuttlecock Tracker</span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-muted/50 p-2 pl-4 rounded-xl border border-border">
            {group ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">球團 :</span>
                <span className="text-blue-600 font-bold px-3 py-1 bg-muted rounded-lg ring-1 ring-border">
                  {group.name}
                </span>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-600 mx-1 hidden sm:block" />
                <ThemeToggle />
                <GroupSettingsDialog 
                  currentGroupName={group.name} 
                  onUpdateSuccess={(newName) => {
                    if (newName) {
                      setGroup(prev => prev ? { ...prev, name: newName } : null)
                    }
                    fetchUser();
                    fetchData();
                  }} 
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  登出
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">當前球團</p>
                  <p className="text-foreground font-black">未載入</p>
                </div>
                <div className="h-10 w-px bg-border mx-2 hidden sm:block" />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-full"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </header>

        {inventory && (
          <InventoryDisplay 
            initialStock={inventory.initial_stock}
            totalPicked={inventory.total_picked}
            currentStock={inventory.current_stock}
          />
        )}

        <div className="flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto">
           <PickupForm onSuccess={fetchData} />
           <SettlementDialog records={records} />
           <RestockForm onSuccess={fetchData} />
        </div>
        <div className="w-full max-w-2xl mx-auto">
           <PickupHistory records={records} onDelete={fetchData} />
        </div>

        <footer className="py-12 text-center text-slate-300 text-sm">
          &copy; 2025 動資訊有限公司 Active Info Co., Ltd. All rights reserved.
        </footer>
      </div>
    </main>
  )
}
