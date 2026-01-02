'use client'

import { useState, useMemo } from "react"
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
import { Calculator, Calendar, User, DollarSign } from "lucide-react"
import { isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns"


interface PickupRecord {
  id: string
  picker_name: string
  quantity: number
  created_at: string
}

interface SettlementDialogProps {
  records: PickupRecord[]
}

export function SettlementDialog({ records }: SettlementDialogProps) {
  const [selectedName, setSelectedName] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [pricePerUnit, setPricePerUnit] = useState<string>("645")

  // 提取所有不重複的領取人姓名
  const uniqueNames = useMemo(() => {
    const names = Array.from(new Set(records.map(r => r.picker_name)))
    return names.sort((a, b) => a.localeCompare(b, 'zh-TW'))

  }, [records])

  // 結算計算邏輯
  const stats = useMemo(() => {
    let filtered = records

    // 過濾姓名
    if (selectedName !== "all") {
      filtered = filtered.filter(r => r.picker_name === selectedName)
    }

    // 過濾日期
    if (startDate || endDate) {
      filtered = filtered.filter(r => {
        const date = parseISO(r.created_at)
        const start = startDate ? startOfDay(new Date(startDate)) : new Date(0)
        const end = endDate ? endOfDay(new Date(endDate)) : new Date(8640000000000000)
        return isWithinInterval(date, { start, end })
      })
    }

    const totalQuantity = filtered.reduce((sum, r) => sum + r.quantity, 0)
    const totalPrice = totalQuantity * (parseFloat(pricePerUnit) || 0)

    return {
      totalQuantity,
      totalPrice,
      count: filtered.length
    }
  }, [records, selectedName, startDate, endDate, pricePerUnit])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" className="flex-1 min-w-[120px] flex gap-2 h-14 text-base font-bold shadow-md hover:shadow-xl transition-all bg-slate-800 hover:bg-slate-900 text-white border-0">
          <Calculator size={20} />
          結算試算
        </Button>
      </DialogTrigger>


      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black">
            <Calculator className="text-blue-500" />
            數據結算試算
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-6">
          {/* 領取人選擇 */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2 text-slate-600">
              <User size={16} /> 選擇領取人
            </Label>
            <select 
              className="flex h-12 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}
            >
              <option value="all">所有人 (不限姓名)</option>
              {uniqueNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* 時間區間 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-slate-600">
                <Calendar size={16} /> 開始日期
              </Label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-slate-600">
                <Calendar size={16} /> 結束日期
              </Label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="h-12"
              />
            </div>
          </div>

          {/* 單價設定 */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2 text-slate-600">
              <DollarSign size={16} /> 單桶價格 (元)
            </Label>
            <Input 
              type="number" 
              value={pricePerUnit} 
              onChange={(e) => setPricePerUnit(e.target.value)}
              placeholder="例如 645"
              className="h-12 font-bold text-lg"
            />
          </div>

          <hr className="border-slate-100" />

          {/* 結算結果展示 */}
          <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200">
             <div className="grid grid-cols-2 gap-4 divide-x divide-slate-200 text-center">
                <div>
                  <p className="text-sm text-slate-500 mb-1">總計領取</p>
                  <p className="text-3xl font-black text-slate-800">{stats.totalQuantity} <span className="text-lg font-normal">桶</span></p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">應收總額</p>
                  <p className="text-3xl font-black text-blue-600"><span className="text-lg font-normal mr-1">$</span>{stats.totalPrice.toLocaleString()}</p>
                </div>
             </div>
             <p className="text-center text-xs text-slate-400 mt-4">
               共計 {stats.count} 筆領取紀錄
             </p>
          </div>
        </div>
        
        <div className="text-center text-[10px] text-slate-300">
          * 結算結果僅供參考，請以實際收支為準。
        </div>
      </DialogContent>
    </Dialog>
  )
}
