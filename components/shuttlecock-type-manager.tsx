'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, X } from "lucide-react"

interface ShuttlecockType {
  id: string
  brand: string
  name: string
}

interface ShuttlecockTypeManagerProps {
  onTypeAdded?: () => void
}

export function ShuttlecockTypeManager({ onTypeAdded }: ShuttlecockTypeManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [brand, setBrand] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, name })
      })

      if (!res.ok) throw new Error('Failed to create type')

      setBrand("")
      setName("")
      setIsAdding(false)
      if (onTypeAdded) onTypeAdded()
    } catch (error) {
      console.error(error)
      alert("新增失敗")
    } finally {
      setLoading(false)
    }
  }

  if (!isAdding) {
    return (
      <Button 
        type="button" 
        variant="outline" 
        size="sm" 
        onClick={() => setIsAdding(true)}
        className="mt-2 w-full"
      >
        <Plus className="h-4 w-4 mr-2" /> 新增球種
      </Button>
    )
  }

  return (
    <div className="border rounded-md p-4 mt-2 bg-muted/30">
        <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium">新增球種</h4>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsAdding(false)}>
                <X className="h-4 w-4" />
            </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label htmlFor="new-brand" className="text-xs">品牌</Label>
                    <Input 
                        id="new-brand" 
                        value={brand} 
                        onChange={e => setBrand(e.target.value)} 
                        placeholder="RSL" 
                        required 
                        className="h-8"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="new-name" className="text-xs">型號/名稱</Label>
                    <Input 
                        id="new-name" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="4號" 
                        required
                        className="h-8" 
                    />
                </div>
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={loading}>
                {loading ? "新增中..." : "確認新增"}
            </Button>
        </form>
    </div>
  )
}
