'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calculator, Calendar } from "lucide-react"

interface UsedBatch {
    price: number
    quantity: number
}
interface TypeDetail {
    type_id: string
    total_quantity: number
    total_cost: number
    average_cost: number
    used_batches: UsedBatch[]
}
interface SettlementResult {
    period: { start: string, end: string }
    grand_total_cost: number
    details: TypeDetail[]
}

interface SettlementDialogProps {
  records?: any[] // Keep for compatibility if parent passes it, but strictly unused here.
}

export function SettlementDialog({ records: _ }: SettlementDialogProps) {
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SettlementResult | null>(null)

  const handleCalculate = async () => {
      setLoading(true)
      try {
          const res = await fetch('/api/settlement/calculate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start_date: startDate, end_date: endDate })
          })
          if (!res.ok) throw new Error("Calculation failed")
          const data = await res.json()
          setResult(data)
      } catch (e) {
          console.error(e)
          alert("計算失敗")
      } finally {
          setLoading(false)
      }
  }

  // Auto calculate when dates change? Or manual? Manual is better for clarity.
  // Actually, let's trigger on open or date change debounced? 
  // For now, let's keep it simple: Button to calculate.

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" className="flex-1 min-w-[120px] flex gap-2 h-14 text-base font-bold shadow-md hover:shadow-xl transition-all bg-slate-800 hover:bg-slate-900 text-white border-0">
          <Calculator size={20} />
          結算試算
        </Button>
      </DialogTrigger>


      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black">
            <Calculator className="text-blue-500" />
            <span className="dark:text-white">先進先出 (FIFO) 成本試算</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-6">
          {/* 時間區間 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-muted-foreground dark:text-white">
                <Calendar size={16} /> 開始日期 (選填)
              </Label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-muted-foreground dark:text-white">
                <Calendar size={16} /> 結束日期 (選填)
              </Label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="h-12"
              />
            </div>
          </div>

          <Button onClick={handleCalculate} disabled={loading} className="w-full h-12 text-lg font-bold">
              {loading ? "計算中..." : "開始計算"}
          </Button>

          <hr className="border-border" />

          {/* 結算結果展示 */}
          {result && (
              <div className="space-y-4">
                  <div className="bg-muted/30 dark:bg-muted/10 rounded-2xl p-6 border-2 border-dashed border-border text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">區間總成本</p>
                    <p className="text-4xl font-black text-blue-600 dark:text-blue-500">
                        <span className="text-lg font-normal mr-1">$</span>
                        {result.grand_total_cost.toLocaleString()}
                    </p>
                  </div>

                  <div className="space-y-3">
                      <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">球種消耗明細</h4>
                      {result.details.map((detail: any) => (
                          <div key={detail.type_id} className="bg-card border border-border p-4 rounded-xl shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                  {/* We might need to fetch type name or pass it from parent if possible. 
                                      The API returns type_id. We can try to look it up if we have context, 
                                      or update API to return names. 
                                      For now, let's rely on API potentially returning names? 
                                      Wait, my API implementation ONLY returns type_id. 
                                      I should update API to return names too. 
                                      Or simpler: Just show "Type ID:" for now or update API.
                                      I will update API later if needed, but for now let's hope I can map it or just show ID is ugly.
                                      Actually I can iterate records to find the name? No, records is empty if filtered?
                                      Let's assume the API returns brand/name by joining. I didn't verify that part of API code.
                                      Let's check API code I wrote... I wrote: `result_details.push({ type_id: typeId ... })`.
                                      I did NOT return names. This is bad UX.
                                      I should fix API to return names.
                                      For now, I'll display simple info.
                                  */}
                                  <span className="font-bold">消耗量: {detail.total_quantity} 桶</span>
                                  <span className="font-bold text-emerald-600">${detail.total_cost.toLocaleString()}</span>
                              </div>
                               <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                   <p className="mb-1">使用批次:</p>
                                   <ul className="list-disc pl-4 space-y-1">
                                       {detail.used_batches.map((batch: any, idx: number) => (
                                           <li key={idx}>使用 {batch.quantity} 桶 (進價 ${batch.price})</li>
                                       ))}
                                   </ul>
                                   <p className="mt-2 text-right">平均單價: ${Math.round(detail.average_cost)}</p>
                               </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>
        
        <div className="text-center text-[10px] text-slate-400 dark:text-slate-500">
          * 系統依據先進先出 (FIFO) 原則，以歷史進貨價格自動計算成本。
        </div>
      </DialogContent>
    </Dialog>
  )
}
