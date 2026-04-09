'use client'

import { useState, useMemo, useRef, useEffect } from "react"
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
import { Calculator, Calendar, User, Package, Loader2, ChevronDown, Check } from "lucide-react"

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

interface PickupRecord {
    picker_name: string
}

interface SettlementDialogProps {
  records?: PickupRecord[]
  types?: { shuttlecock_type_id: string, brand: string, name: string }[]
}

// ── 共用的多選下拉元件 ──────────────────────────────────────────────
interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (next: string[]) => void
  allLabel: string
  emptyText?: string
}

function MultiSelectDropdown({ options, selected, onChange, allLabel, emptyText = "無資料" }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const allSelected = options.length > 0 && selected.length === options.length

  const displayText = selected.length === 0 || allSelected
    ? allLabel
    : selected.length === 1
    ? options.find(o => o.value === selected[0])?.label ?? selected[0]
    : `已選 ${selected.length} 項`

  const isPlaceholder = selected.length === 0

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const toggleAll = () => {
    onChange(allSelected ? [] : options.map(o => o.value))
  }

  const toggleOne = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex h-12 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={isPlaceholder ? "text-muted-foreground" : ""}>{displayText}</span>
        <ChevronDown size={16} className="text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-52 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            <>
              {/* 全選列 */}
              <button
                type="button"
                onClick={toggleAll}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 border-b border-border"
              >
                <Checkbox checked={allSelected} />
                {allLabel}
              </button>

              {/* 個別選項 */}
              {options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleOne(opt.value)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <Checkbox checked={selected.includes(opt.value)} />
                  {opt.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-4 w-4 items-center justify-center rounded border shrink-0 ${checked ? "bg-primary border-primary" : "border-input"}`}>
      {checked && <Check size={10} className="text-primary-foreground" />}
    </span>
  )
}

// ── 主元件 ───────────────────────────────────────────────────────────
export function SettlementDialog({ records, types = [] }: SettlementDialogProps) {
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SettlementResult | null>(null)

  const uniquePickers = useMemo(() => {
    return Array.from(new Set(records?.map(r => r.picker_name).filter(Boolean))) as string[]
  }, [records])

  const pickerOptions = useMemo(
    () => uniquePickers.map(p => ({ value: p, label: p })),
    [uniquePickers]
  )

  const typeOptions = useMemo(
    () => types.map(t => ({ value: t.shuttlecock_type_id, label: `${t.brand} ${t.name}` })),
    [types]
  )

  const handleCalculate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settlement/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          picker_names: selectedNames,
          shuttlecock_type_ids: selectedTypeIds,
        })
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
            <span className="dark:text-white">結算試算</span>
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

          {/* 篩選條件：球種 與 領取人 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-muted-foreground dark:text-white">
                <Package size={16} /> 球種 (選填)
              </Label>
              <MultiSelectDropdown
                options={typeOptions}
                selected={selectedTypeIds}
                onChange={setSelectedTypeIds}
                allLabel="全部球種"
              />
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-muted-foreground dark:text-white">
                <User size={16} /> 領取人 (選填)
              </Label>
              <MultiSelectDropdown
                options={pickerOptions}
                selected={selectedNames}
                onChange={setSelectedNames}
                allLabel="全部領取人"
              />
            </div>
          </div>

          <Button onClick={handleCalculate} disabled={loading} className="w-full h-12 text-lg font-bold">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                計算中...
              </>
            ) : (
              "開始計算"
            )}
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
                {result.details.map((detail) => {
                  const typeInfo = types.find(t => t.shuttlecock_type_id === detail.type_id)
                  const typeName = typeInfo ? `${typeInfo.brand} ${typeInfo.name}` : '未知球種'
                  return (
                    <div key={detail.type_id} className="bg-card border border-border p-4 rounded-xl shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-lg text-emerald-700 dark:text-emerald-400">{typeName}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2 text-sm">
                        <span>消耗量: <span className="font-bold">{detail.total_quantity}</span> 桶</span>
                        <span className="font-bold text-emerald-600">${detail.total_cost.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <p className="mb-1">使用批次:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          {detail.used_batches.map((batch, idx) => (
                            <li key={idx}>使用 {batch.quantity} 桶 (進價 ${batch.price})</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-right">平均單價: ${Math.round(detail.average_cost)}</p>
                      </div>
                    </div>
                  )
                })}
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
