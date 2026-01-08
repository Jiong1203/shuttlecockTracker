'use client'

import { useState, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PackagePlus, Lock, Loader2, CheckCircle2 } from "lucide-react"
import { ShuttlecockTypeManager } from "./shuttlecock-type-manager"

interface RestockFormProps {
  onSuccess: () => void
  shouldHighlight?: boolean
}

export interface RestockFormRef {
  open: () => void
}

export const RestockForm = forwardRef<RestockFormRef, RestockFormProps>(function RestockForm({ onSuccess, shouldHighlight = false }, ref) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1) // 1: 密碼, 2: 數量/球種/價格, 3: 二次確認
  const [loading, setLoading] = useState(false)
  const [hasRestockPassword, setHasRestockPassword] = useState(false)
  
  const [password, setPassword] = useState("")
  const [amount, setAmount] = useState("10")
  const [unitPrice, setUnitPrice] = useState("")
  const [types, setTypes] = useState<any[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  // Expose open method to parent via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true)
      checkSecurity()
      fetchTypes()
    }
  }))

  const fetchTypes = async () => {
    try {
      const res = await fetch('/api/inventory/types')
      const data = await res.json()
      if (Array.isArray(data)) {
        setTypes(data)
        // Default to the first one if available and not set
        if (data.length > 0 && !selectedTypeId) {
            setSelectedTypeId(data[0].id)
        }
      }
    } catch (e) {
      console.error("Failed to fetch types", e)
    }
  }

  // 檢查是否需要密碼（目前恆定需要，至少是 1111）
  const checkSecurity = async () => {
    try {
      const res = await fetch('/api/group')
      const data = await res.json()
      setHasRestockPassword(data.hasRestockPassword)
      // 無論是否有自訂密碼，都保持在第 1 步 (驗證步)
      setStep(1)
    } catch (error) {
      console.error("Failed to fetch security settings:", error)
      setStep(1)
    }
  }

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError("請輸入密碼")
      return
    }

    setLoading(true)
    setError(null)
    try {
      // 調用 API 驗證密碼
      const res = await fetch('/api/group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentRestockPassword: password })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "密碼錯誤")
      }

      setStep(2)
      // fetch types if not yet
      if (types.length === 0) fetchTypes()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "驗證失敗，請重新輸入"
      setError(message)
      setPassword("")
    } finally {
      setLoading(false)
    }
  }

  const handleGoToConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (parseInt(amount, 10) < 1) {
      setError("數量至少為 1 桶")
      return
    }
    if (!selectedTypeId) {
        setError("請選擇球種")
        return
    }
    // Price checks? Allow 0? Assume yes.
    setStep(3)
    setError(null)
  }

  const handleRestock = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          amount: parseInt(amount, 10),
          type_id: selectedTypeId,
          unit_price: unitPrice ? parseInt(unitPrice, 10) : 0
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setOpen(false)
        resetState()
        onSuccess()
      } else {
        setError(data.error || "入庫失敗")
        // 如果是密碼錯誤，跳回第一步
        if (response.status === 401) {
          setStep(1)
          setPassword("")
        } else {
          setStep(2)
        }
      }
    } catch (err) {
      console.error("Restock error:", err)
      setError("連線發生錯誤")
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const resetState = () => {
    setStep(1)
    setPassword("")
    setAmount("10")
    setUnitPrice("")
    setError(null)
    // Don't reset selectedTypeId to avoid annoyance
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val)
      if (val) {
        checkSecurity()
        fetchTypes()
      } else {
        resetState()
      }
    }}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          data-restock-button
          className={`flex-1 min-w-[120px] flex gap-2 h-14 text-base font-bold shadow-md hover:shadow-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white border-0 ${shouldHighlight ? 'pulse-highlight' : ''}`}
        >
          <PackagePlus size={20} />
          入庫登記
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        {step === 1 ? (
          <form onSubmit={handleVerifyPassword}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="text-muted-foreground" size={20} />
                <span className="text-foreground">{hasRestockPassword ? "入庫驗證" : "身分驗證"}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label htmlFor="password">請輸入管理密碼</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="****"
                  autoFocus
                  required
                  className="h-12 text-center text-2xl tracking-[1em]"
                />
                {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold bg-primary text-primary-foreground" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                驗證並繼續
              </Button>
            </DialogFooter>
          </form>
        ) : step === 2 ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={20} />
                驗證成功：輸入明細
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleGoToConfirm} className="grid gap-4 py-2">
                <div className="grid gap-2">
                    <Label htmlFor="type">選擇球種</Label>
                    <select 
                        id="type"
                        className="flex h-12 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedTypeId}
                        onChange={(e) => setSelectedTypeId(e.target.value)}
                        required
                    >
                        {types.map(t => (
                            <option key={t.id} value={t.id}>{t.brand} {t.name}</option>
                        ))}
                    </select>
                    {/* Simplified integration without importing the component to avoid import path issues if not careful, 
                        but effectively we should use the component. The user instruction said 'Embed ShuttlecockTypeManager'. 
                        I will assume I need to import it. */}
                     <ShuttlecockTypeManager onTypeAdded={fetchTypes} />
                </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">進貨數量 (桶)</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="h-12 text-lg font-bold"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="price">購入單價/桶</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="0"
                      className="h-12 text-lg font-bold"
                    />
                  </div>
              </div>
              
              {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
              
              <DialogFooter className="mt-4">
                <Button type="submit" className="w-full h-12 text-lg font-bold bg-emerald-600 hover:bg-emerald-700">
                  下一步：確認明細
                </Button>
              </DialogFooter>
            </form>
          </div>
        ) : (
          <div>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <PackagePlus size={20} />
                入庫二次確認
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 text-center bg-muted/50 rounded-xl my-4 border border-border">
               <div className="mb-4">
                 <p className="text-muted-foreground text-sm">球種</p>
                 <p className="text-lg font-bold">{types.find(t => t.id === selectedTypeId)?.brand} {types.find(t => t.id === selectedTypeId)?.name}</p>
               </div>
               <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
                   <div>
                        <p className="text-muted-foreground text-xs">數量</p>
                        <p className="text-2xl font-black text-foreground">{amount} <span className="text-sm font-normal">桶</span></p>
                   </div>
                   <div>
                        <p className="text-muted-foreground text-xs">單價</p>
                        <p className="text-2xl font-black text-foreground">${unitPrice || 0}</p>
                   </div>
               </div>
               
               {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button variant="outline" onClick={() => setStep(2)} disabled={loading} className="h-12 border-border">
                返回修改
              </Button>
              <Button onClick={handleRestock} className="h-12 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-0" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                執行入庫
              </Button>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
