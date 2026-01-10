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
import { PlusCircle, Loader2, AlertCircle } from "lucide-react"
import { showToast } from "@/components/ui/toast"

interface PickupFormProps {
  onSuccess: () => void
  disabled?: boolean
}

interface ShuttlecockType {
  id: string
  brand: string
  name: string
  is_active: boolean
  group_id: string
  created_at?: string
  created_by?: string
}

export function PickupForm({ onSuccess, disabled = false }: PickupFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [types, setTypes] = useState<ShuttlecockType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const fetchTypes = async () => {
    try {
      const res = await fetch('/api/inventory/types')
      const data = await res.json()
      if (Array.isArray(data)) {
        setTypes(data)
        if (data.length > 0 && !selectedTypeId) {
            setSelectedTypeId(data[0].id)
        }
      }
    } catch (e) {
      console.error("Failed to fetch types", e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedTypeId) {
        setError("請選擇球種")
        return
    }
    setLoading(true)

    try {
      const response = await fetch('/api/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picker_name: name,
          quantity: parseInt(quantity, 10),
          type_id: selectedTypeId
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setName("")
        setQuantity("1")
        setOpen(false)
        onSuccess()
        showToast("登記成功", 'success')
      } else {
        setError(data.error || "登記失敗，請檢查資料")
      }
    } catch (error) {
      console.error("Pickup error:", error)
      setError("連線發生錯誤")
    } finally {
      setLoading(false)
    }
  }

  const handleDisabledClick = () => {
    if (disabled) {
      showToast('請先完成入庫登記以設定初始庫存', 'warning', 3000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (disabled && newOpen) {
        handleDisabledClick()
        return
      }
      setOpen(newOpen)
      if (newOpen) {
          fetchTypes()
      }
    }}>
      <DialogTrigger asChild>
        <div className="flex-1 min-w-[120px]">
          <Button 
            size="lg" 
            disabled={disabled}
            onClick={disabled ? handleDisabledClick : undefined}
            className="w-full flex gap-2 h-14 text-base font-bold shadow-md hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusCircle size={20} />
            領取登記
          </Button>
          {disabled && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 text-center font-medium">
              ⚠️ 請先完成入庫登記
            </p>
          )}
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>羽球領取登記</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
                <Label htmlFor="type" className="text-foreground font-bold">球種</Label>
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-foreground font-bold">領取人姓名</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入姓名"
                required
                className="h-12"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quantity" className="text-foreground font-bold">領取桶數</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="h-12"
              />
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md flex items-center gap-2 text-red-600 dark:text-red-400">
               <AlertCircle size={18} />
               <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確認提交
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
