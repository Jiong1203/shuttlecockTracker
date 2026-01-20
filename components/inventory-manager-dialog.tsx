'use client'

import { useState, useEffect, useCallback } from "react"
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
import { 
  Package, 
  History, 
  PlusCircle, 
  Archive, 
  Loader2, 
  CheckCircle2, 
  Lock,
  PackagePlus,
  Settings2
} from "lucide-react"
import { ShuttlecockTypeManager } from "./shuttlecock-type-manager"

interface InventoryManagerDialogProps {
  // We can pass initial data if we want, but fetching fresh inside might be safer for consistency
  trigger?: React.ReactNode
  onUpdate?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialTab?: 'overview' | 'restock' | 'history' | 'types'
}

interface InventoryItem {
  shuttlecock_type_id: string
  brand: string
  name: string
  current_stock: number
  total_restocked: number
  total_picked: number
  is_active: boolean
}

interface HistoryRecord {
  id: string
  date: string
  brand: string
  name: string
  quantity: number
  unit_price: number
  total_price: number
  created_by_email: string
}

interface ShuttlecockType {
  id: string
  brand: string
  name: string
  is_active: boolean
}

export function InventoryManagerDialog({ trigger, onUpdate, open: controlledOpen, onOpenChange, initialTab = 'overview' }: InventoryManagerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen

  const [activeTab, setActiveTab] = useState<'overview' | 'restock' | 'history' | 'types'>('overview')
  const [loading, setLoading] = useState(false)
  
  // Data States
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [history, setHistory] = useState<HistoryRecord[]>([])
  
  // Restock Form States
  const [step, setStep] = useState<1 | 2 | 3>(1) 
  const [restockPassword, setRestockPassword] = useState("")
  const [hasRestockPassword, setHasRestockPassword] = useState(false)
  const [types, setTypes] = useState<ShuttlecockType[]>([])
  const [typesLoading, setTypesLoading] = useState(false)
  const [selectedTypeId, setSelectedTypeId] = useState("")
  const [amount, setAmount] = useState("10")
  const [unitPrice, setUnitPrice] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [lastVerifiedAt, setLastVerifiedAt] = useState<number | null>(null)

  const VERIFICATION_TIMEOUT = 5 * 60 * 1000 // 5 minutes

  // Fetch Data Methods
  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inventory?all=true')
      if (res.ok) setInventory(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inventory/history')
      if (res.ok) setHistory(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTypes = useCallback(async () => {
    try {
      setTypesLoading(true)
      const res = await fetch('/api/inventory/types?all=true')
      const data = await res.json()
      if (Array.isArray(data)) {
        setTypes(data)
        if (data.length > 0 && !selectedTypeId) setSelectedTypeId(data[0].id)
      }
    } catch (e) { console.error(e) } 
    finally {
      setTypesLoading(false)
    }
  }, [selectedTypeId])

  const checkSecurity = useCallback(async () => {
      try {
        const res = await fetch('/api/group')
        const data = await res.json()
        setHasRestockPassword(data.hasRestockPassword)
        
        // Check if we have a valid recent verification
        if (lastVerifiedAt && (Date.now() - lastVerifiedAt < VERIFICATION_TIMEOUT)) {
            setStep(2)
        } else {
            setStep(1)
            setLastVerifiedAt(null)
        }
      } catch (e) { console.error(e) }
  }, [lastVerifiedAt, VERIFICATION_TIMEOUT])

  const handleTypeChange = useCallback(() => {
    fetchTypes()
    fetchInventory()
    onUpdate?.()
  }, [fetchTypes, fetchInventory, onUpdate])

  // Effect to load data when tab changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      if (!internalOpen && activeTab !== initialTab) {
         // Sync tab only when just opening (checking controlled open vs internal or just use a ref to track open state change? 
         // Actually, simpler: just set it effectively. But we don't want to reset it if user changes tab while open.
         // Let's rely on a separate effect tracking open change or just use a ref.
         // However, for this simple case: if !isOpen -> isOpen, set activeTab = initialTab.
      }
    }
  }, [isOpen]) 

  // Better approach: use a previous value of isOpen to detect opening edge
  const [prevOpen, setPrevOpen] = useState(false)
  
  useEffect(() => {
    if (isOpen && !prevOpen) {
       setActiveTab(initialTab)
    }
    setPrevOpen(isOpen)
  }, [isOpen, prevOpen, initialTab])

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'overview') fetchInventory()
      if (activeTab === 'history') fetchHistory()
      if (activeTab === 'restock') {
         checkSecurity()
         fetchTypes()
      }
    }
  }, [isOpen, activeTab, fetchInventory, fetchHistory, checkSecurity, fetchTypes])

  // Restock logic
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentRestockPassword: restockPassword })
      })
      if (!res.ok) throw new Error("密碼錯誤")
      setStep(2)
      setLastVerifiedAt(Date.now())
      if (types.length === 0) fetchTypes()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "密碼錯誤")
      setRestockPassword("")
    } finally {
      setFormLoading(false)
    }
  }

  const handleRestockSubmit = async () => {
    setFormLoading(true)
    setError(null)
    try {
        const res = await fetch('/api/inventory/restock', {
            method: 'POST',
            body: JSON.stringify({
                password: restockPassword,
                amount: parseInt(amount, 10),
                type_id: selectedTypeId,
                unit_price: unitPrice ? parseInt(unitPrice, 10) : 0
            })
        })
        const data = await res.json()
        if (res.ok) {
            // Success
            onUpdate?.() // trigger parent refresh
            setStep(1)
            setAmount("10")
            setUnitPrice("")
            // Keep Password in state if it was verified, but consider updating lastVerifiedAt
            setLastVerifiedAt(Date.now()) 
            setActiveTab('overview') // Switch back to overview to show update
            fetchInventory() 
        } else {
            setError(data.error)
            if (res.status === 401) {
                setStep(1)
                setRestockPassword("")
            }
        }
    } catch {
        setError("連線錯誤")
    } finally {
        setFormLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
        // When closing:
        // 1. If not verified (step 1), clear sensitive password
        if (step === 1) {
            setRestockPassword("")
        }
        // 2. Always clear form transient data
        setAmount("10")
        setUnitPrice("")
        setError(null)
    }
  }

  const handleTabChange = (tab: 'overview' | 'restock' | 'history' | 'types') => {
      // If moving away from restock and haven't verified, clear password
      if (activeTab === 'restock' && tab !== 'restock' && step === 1) {
          setRestockPassword("")
      }
      setActiveTab(tab)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
             <Button 
                size="lg" 
                className="flex-1 min-w-[120px] h-14 text-base font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-2"
             >
                <Package size={20} />
                庫存管理
             </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-2 border-b border-border bg-muted/20">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                    <Package className="text-indigo-600" />
                    <span>庫存管理中心</span>
                </DialogTitle>
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2 -mx-1 px-1">
                     <TabButton active={activeTab === 'overview'} onClick={() => handleTabChange('overview')} icon={<Archive size={16} />} label="庫存" />
                     <TabButton active={activeTab === 'restock'} onClick={() => handleTabChange('restock')} icon={<PlusCircle size={16} />} label="入庫" />
                     <TabButton active={activeTab === 'history'} onClick={() => handleTabChange('history')} icon={<History size={16} />} label="紀錄" />
                     <TabButton active={activeTab === 'types'} onClick={() => handleTabChange('types')} icon={<Settings2 size={16} />} label="球種" />
                </div>
            </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                    ) : (
                        <div className="rounded-md border border-border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted text-muted-foreground">
                                    <tr>
                                        <th className="p-3 text-left font-medium">品牌/型號</th>
                                        <th className="p-3 text-right font-medium">目前庫存</th>
                                        <th className="p-3 text-right font-medium">累積進貨</th>
                                        <th className="p-3 text-right font-medium">累積領取</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventory.map((item) => (
                                        <tr key={item.shuttlecock_type_id} className="border-t border-border hover:bg-muted/20 transition-colors">
                                            <td className="p-3">
                                                <div className="font-bold text-foreground">{item.brand}</div>
                                                <div className="text-xs text-muted-foreground">{item.name}</div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className={`font-bold text-lg ${item.current_stock < 5 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                    {item.current_stock}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-1">桶</span>
                                            </td>
                                            <td className="p-3 text-right text-muted-foreground">{item.total_restocked}</td>
                                            <td className="p-3 text-right text-muted-foreground">{item.total_picked}</td>
                                        </tr>
                                    ))}
                                    {inventory.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">尚無庫存資料</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'restock' && (
                <div className="max-w-md mx-auto py-4">
                  {typesLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                  ) : types.length === 0 ? (
                    <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center animate-in fade-in zoom-in-95 duration-300">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                        <PackagePlus className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                      <div className="space-y-2 max-w-[280px]">
                        <h3 className="font-bold text-lg">尚未建立球種</h3>
                        <p className="text-sm text-muted-foreground">
                          進行入庫登記前，請先建立您的羽球品牌與型號資料。
                        </p>
                      </div>
                      <Button 
                        onClick={() => setActiveTab('types')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                      >
                        <Settings2 className="w-4 h-4" />
                        前往建立球種
                      </Button>
                    </div>
                  ) : step === 1 ? (
                         <form onSubmit={handleVerifyPassword} className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="mx-auto w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600">
                                    <Lock size={24} />
                                </div>
                                <h3 className="text-lg font-bold">身分驗證</h3>
                                <p className="text-sm text-muted-foreground">請輸入庫存管理密碼以進行入庫作業</p>
                            </div>
                            <div className="space-y-2">
                                <Input 
                                    type="password" 
                                    value={restockPassword} 
                                    onChange={e => setRestockPassword(e.target.value)} 
                                    placeholder={hasRestockPassword ? "輸入密碼" : "輸入密碼 (預設 1111)"} 
                                    className="text-center text-lg tracking-widest h-12"
                                    autoFocus
                                />
                                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                            </div>
                            <Button type="submit" className="w-full h-12 text-lg" disabled={formLoading}>
                                {formLoading ? <Loader2 className="animate-spin" /> : "驗證"}
                            </Button>
                         </form>
                    ) : step === 2 ? (
                        <div className="space-y-4">
                             <div className="flex items-center gap-2 text-emerald-600 font-bold border-b pb-2">
                                <CheckCircle2 size={18} /> 驗證通過
                             </div>
                             <div className="space-y-3">
                                 <div className="space-y-1">
                                     <Label>球種</Label>
                                     <select 
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
                                        value={selectedTypeId}
                                        onChange={e => setSelectedTypeId(e.target.value)}
                                     >
                                         {types.map(t => <option key={t.id} value={t.id}>{t.brand} {t.name}</option>)}
                                     </select>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-1">
                                         <Label>數量 (桶)</Label>
                                         <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="h-10" />
                                     </div>
                                     <div className="space-y-1">
                                         <Label>單價 ($)</Label>
                                         <Input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0" className="h-10" />
                                     </div>
                                 </div>
                                 {error && <p className="text-sm text-red-500">{error}</p>}
                                 <Button onClick={() => setStep(3)} className="w-full mt-2" disabled={!selectedTypeId || parseInt(amount) < 1}>
                                    下一步：確認
                                 </Button>
                             </div>
                        </div>
                    ) : (
                        <div className="space-y-6 text-center">
                            <h3 className="text-lg font-bold flex items-center justify-center gap-2 text-orange-600">
                                <PackagePlus /> 二次確認
                            </h3>
                            <div className="bg-muted/50 p-6 rounded-xl space-y-4 border border-border">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase">入庫項目</p>
                                    <p className="text-xl font-bold">{types.find(t=>t.id===selectedTypeId)?.brand} {types.find(t=>t.id===selectedTypeId)?.name}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-left">
                                    <div className="bg-background p-3 rounded border">
                                        <p className="text-xs text-muted-foreground">數量</p>
                                        <p className="text-lg font-bold">{amount} 桶</p>
                                    </div>
                                    <div className="bg-background p-3 rounded border">
                                        <p className="text-xs text-muted-foreground">單價</p>
                                        <p className="text-lg font-bold">${unitPrice || 0}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" onClick={() => setStep(2)}>返回修改</Button>
                                <Button onClick={handleRestockSubmit} disabled={formLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                    {formLoading ? <Loader2 className="animate-spin" /> : "確認入庫"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4">
                      {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                    ) : (
                        <div className="rounded-md border border-border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted text-muted-foreground">
                                    <tr>
                                        <th className="p-3 text-left font-medium">日期</th>
                                        <th className="p-3 text-left font-medium">球種</th>
                                        <th className="p-3 text-right font-medium">數量</th>
                                        <th className="p-3 text-right font-medium">單價</th>
                                        <th className="p-3 text-right font-medium">總額</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((record) => (
                                        <tr key={record.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                                                {new Date(record.date).toLocaleDateString()}
                                                <div className="text-xs opacity-50">{new Date(record.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-semibold">{record.brand}</div>
                                                <div className="text-xs text-muted-foreground">{record.name}</div>
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-600">+{record.quantity}</td>
                                            <td className="p-3 text-right">${record.unit_price}</td>
                                            <td className="p-3 text-right font-medium">${record.total_price}</td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">尚無紀錄</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'types' && (
                <div className="max-w-3xl mx-auto py-4 px-4">
                    <ShuttlecockTypeManager onTypeAdded={handleTypeChange} />
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${active ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'text-muted-foreground hover:bg-muted'}`}
        >
            {icon}
            {label}
        </button>
    )
}
