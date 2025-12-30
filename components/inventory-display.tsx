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
    <Card className="w-full max-w-md mx-auto overflow-hidden border-slate-100 shadow-sm transition-all hover:shadow-xl rounded-2xl">
      <CardHeader className="pt-8 pb-0">
        <CardTitle className="text-center text-slate-400 font-bold text-sm tracking-widest uppercase">剩餘庫存</CardTitle>
      </CardHeader>

      <CardContent className="pt-8 pb-10 text-center">
        <div className={`text-7xl font-bold mb-2 ${isLowStock ? 'text-red-500' : 'text-slate-800'}`}>
          {currentStock}
          <span className="text-2xl ml-2 font-normal text-slate-400">桶</span>
        </div>
        
        {isLowStock && (
          <div className="flex items-center justify-center gap-2 text-red-500 font-bold animate-pulse mt-4 bg-red-50 p-2 rounded-lg">
            <AlertCircle size={20} />
            庫存不足！請儘速補貨
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-100 text-sm">
          <div className="text-center">
            <p className="text-slate-400 mb-1">累積進貨</p>
            <p className="font-semibold text-slate-700">{initialStock} 桶</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 mb-1">累積領取</p>
            <p className="font-semibold text-slate-700">{totalPicked} 桶</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
