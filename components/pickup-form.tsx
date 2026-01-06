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
import { PlusCircle, Loader2 } from "lucide-react"

interface PickupFormProps {
  onSuccess: () => void
}

export function PickupForm({ onSuccess }: PickupFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("1")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picker_name: name,
          quantity: parseInt(quantity, 10),
        }),
      })

      if (response.ok) {
        setName("")
        setQuantity("1")
        setOpen(false)
        onSuccess()
      } else {
        alert("登記失敗，請檢查資料")
      }
    } catch (error) {
      console.error("Pickup error:", error)
      alert("連線發生錯誤")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="flex-1 min-w-[120px] flex gap-2 h-14 text-base font-bold shadow-md hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700">
          <PlusCircle size={20} />
          領取登記
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>羽球領取登記</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-6">
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
