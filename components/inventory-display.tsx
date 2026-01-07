'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface InventoryDisplayProps {
  initialStock: number
  totalPicked: number
  currentStock: number
}

export function InventoryDisplay({ initialStock, totalPicked, currentStock }: InventoryDisplayProps) {
  const isLowStock = currentStock < 5

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden border-border bg-card shadow-sm transition-all hover:shadow-xl rounded-2xl">
      <CardHeader className="pt-8 pb-0">
        <CardTitle className="text-center text-slate-400 dark:text-slate-500 font-bold text-sm tracking-widest uppercase">剩餘庫存</CardTitle>
      </CardHeader>

      <CardContent className="pt-8 pb-10 text-center">
        <div className={`text-7xl font-bold mb-2 ${isLowStock ? 'text-red-500' : 'text-foreground'}`}>
          {currentStock}
          <span className="text-2xl ml-2 font-normal text-muted-foreground">桶</span>
        </div>
        
        {currentStock === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-orange-600 dark:text-orange-400 font-bold mt-4 bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-900/50">
            <AlertCircle size={24} />
            <p className="text-sm">⚠️ 尚未設定初始庫存</p>
            <p className="text-xs font-normal text-muted-foreground">👉 請點擊「入庫登記」開始使用</p>
          </div>
        ) : isLowStock && (
          <div className="flex items-center justify-center gap-2 text-red-500 font-bold animate-pulse mt-4 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-100 dark:border-red-900/50">
            <AlertCircle size={20} />
            庫存不足！請儘速補貨
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-border text-sm">
          <div className="text-center">
            <p className="text-muted-foreground mb-1">累積進貨</p>
            <p className="font-semibold text-foreground">{initialStock} 桶</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground mb-1">累積領取</p>
            <p className="font-semibold text-foreground">{totalPicked} 桶</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
