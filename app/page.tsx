'use client'

import { useState, useEffect, useCallback } from "react"
import { InventoryDisplay } from "@/components/inventory-display"
import { PickupForm } from "@/components/pickup-form"
import { PickupHistory } from "@/components/pickup-history"
import { Loader2 } from "lucide-react"

export default function Home() {
  const [inventory, setInventory] = useState<{
    initial_stock: number;
    total_picked: number;
    current_stock: number;
  } | null>(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [invRes, pickRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/pickup')
      ])
      
      if (!invRes.ok) {
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
  }, [])


  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-slate-500 font-medium">資料讀取中...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">羽球領取管理系統</h1>
          <p className="text-slate-500 mt-2">Shuttlecock Tracker</p>
        </header>

        {inventory && (
          <InventoryDisplay 
            initialStock={inventory.initial_stock}
            totalPicked={inventory.total_picked}
            currentStock={inventory.current_stock}
          />
        )}

        <div className="flex justify-center flex-col items-center">
           <PickupForm onSuccess={fetchData} />
           <PickupHistory records={records} />
        </div>

        <footer className="py-12 text-center text-slate-300 text-sm">
          &copy; 2025 Badminton Club. All rights reserved.
        </footer>
      </div>
    </main>
  )
}
