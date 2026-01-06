'use client'

import { useState } from "react"
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

interface RestockFormProps {
  onSuccess: () => void
}

export function RestockForm({ onSuccess }: RestockFormProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1) // 1: 密碼, 2: 數量, 3: 二次確認
  const [loading, setLoading] = useState(false)
  const [hasRestockPassword, setHasRestockPassword] = useState(false)
  
  const [password, setPassword] = useState("")
  const [amount, setAmount] = useState("10")
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val)
      if (val) {
        checkSecurity()
      } else {
        resetState()
      }
    }}>
      <DialogTrigger asChild>
        <Button size="lg" className="flex-1 min-w-[120px] flex gap-2 h-14 text-base font-bold shadow-md hover:shadow-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white border-0">
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
          <form onSubmit={handleGoToConfirm}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={20} />
                驗證成功：輸入入庫量
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label htmlFor="amount">本次進貨數量 (桶)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  className="h-12 text-xl font-bold"
                />
                {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold bg-emerald-600 hover:bg-emerald-700">
                下一步：確認明細
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <PackagePlus size={20} />
                入庫二次確認
              </DialogTitle>
            </DialogHeader>
            <div className="py-8 text-center bg-muted/50 rounded-xl my-4 border border-border">
               <p className="text-muted-foreground mb-1">本次準備入庫數量</p>
               <p className="text-5xl font-black text-foreground">{amount} <span className="text-xl font-normal">桶</span></p>
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
}

