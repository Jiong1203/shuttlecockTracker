'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface InventoryItem {
    shuttlecock_type_id: string
    brand: string
    name: string
    total_restocked: number
    total_picked: number
    current_stock: number
}

interface InventoryDisplayProps {
  stocks?: InventoryItem[]
  // Legacy props for fallback/compatibility if needed, but we should move to stocks
  initialStock?: number
  totalPicked?: number
  currentStock?: number
}

export function InventoryDisplay({ stocks, currentStock }: InventoryDisplayProps) {
  // If legacy props are used and no stocks array, wrap in a dummy item or handle gracefully
  // But ideally we expect `stocks` to be passed.
  
  if (!stocks || stocks.length === 0) {
     // Fallback or empty state
     if (typeof currentStock !== 'undefined') {
        // Render single legacy view... (omitted for brevity, let's assume we convert upstream or render "No Data")
         return (
             <Card className="w-full max-w-md mx-auto overflow-hidden border-border bg-card shadow-sm transition-all hover:shadow-xl rounded-2xl">
              <CardHeader className="pt-8 pb-0">
                <CardTitle className="text-center text-slate-400 dark:text-slate-500 font-bold text-sm tracking-widest uppercase">總庫存</CardTitle>
              </CardHeader>
              <CardContent className="pt-8 pb-10 text-center">
                 <div className="text-7xl font-bold mb-2 text-foreground">
                   {currentStock}
                   <span className="text-2xl ml-2 font-normal text-muted-foreground">桶</span>
                 </div>
              </CardContent>
             </Card>
         )
     }
     return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-wrap justify-center gap-4">
      {stocks.map((stock) => {
        const isLowStock = stock.current_stock < 5
        return (
            <Card key={stock.shuttlecock_type_id} className="w-full md:w-[calc(50%-0.5rem)] overflow-hidden border-border bg-card shadow-sm transition-all hover:shadow-xl rounded-2xl">
            <CardHeader className="pt-6 pb-0">
                <CardTitle className="text-center text-slate-400 dark:text-slate-500 font-bold text-base tracking-widest uppercase">
                    {stock.brand} {stock.name}
                </CardTitle>
            </CardHeader>
    
            <CardContent className="pt-6 pb-8 text-center">
                <div className={`text-6xl font-bold mb-2 ${isLowStock ? 'text-red-500' : 'text-foreground'}`}>
                {stock.current_stock}
                <span className="text-xl ml-2 font-normal text-muted-foreground">桶</span>
                </div>
                
                {stock.current_stock === 0 && (
                 <div className="flex items-center justify-center gap-2 text-orange-600 dark:text-orange-400 text-xs font-bold mt-2 bg-orange-50 dark:bg-orange-950/30 p-2 rounded-lg">
                    <AlertCircle size={16} />
                    <span>缺貨中</span>
                </div>
                )}

                {isLowStock && stock.current_stock > 0 && (
                <div className="flex items-center justify-center gap-2 text-red-500 text-xs font-bold animate-pulse mt-2 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg">
                    <AlertCircle size={16} />
                    <span>庫存即將耗盡，請盡速補充</span>
                </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border text-xs">
                <div className="text-center">
                    <p className="text-muted-foreground mb-1">累積進貨</p>
                    <p className="font-semibold text-foreground">{stock.total_restocked}</p>
                </div>
                <div className="text-center">
                    <p className="text-muted-foreground mb-1">累積領取</p>
                    <p className="font-semibold text-foreground">{stock.total_picked}</p>
                </div>
                </div>
            </CardContent>
            </Card>
        )
      })}
    </div>
  )
}
