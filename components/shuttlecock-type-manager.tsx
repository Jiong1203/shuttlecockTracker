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
  is_active: boolean
}

interface ShuttlecockTypeManagerProps {
  onTypeAdded?: () => void
}

export function ShuttlecockTypeManager({ onTypeAdded }: ShuttlecockTypeManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [brand, setBrand] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [types, setTypes] = useState<ShuttlecockType[]>([])
  const [listLoading, setListLoading] = useState(false)

  const fetchTypes = async () => {
    setListLoading(true)
    try {
      const res = await fetch('/api/inventory/types?all=true') // We need to update API to support all=true or just return all
      const data = await res.json()
      if (Array.isArray(data)) setTypes(data)
    } catch (e) {
      console.error(e)
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    fetchTypes()
  }, [])

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
      fetchTypes()
      if (onTypeAdded) onTypeAdded()
    } catch (error) {
      console.error(error)
      alert("新增失敗")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/inventory/types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive })
      })
      if (res.ok) {
        fetchTypes()
        if (onTypeAdded) onTypeAdded()
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-lg font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-500" />
              管理顯示球種
          </h4>
          <p className="text-xs text-muted-foreground mt-1">設定哪些球種要顯示在首頁庫存卡片與選單中</p>
        </div>
        
        {!isAdding && (
          <Button 
            onClick={() => setIsAdding(true)}
            className="bg-emerald-600 hover:bg-emerald-700 font-bold gap-2"
          >
            <Plus className="h-4 w-4" /> 新增球種
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-2 ${types.length > 4 ? 'max-h-[500px]' : ''}`}>
            {listLoading && types.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">載入中...</div>
            ) : types.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">尚無球種</div>
            ) : (
                types.map(type => (
                    <div key={type.id} className="flex items-center justify-between p-4 rounded-xl bg-background border border-border hover:border-emerald-500/30 transition-all shadow-sm group">
                        <div className="flex flex-col gap-1">
                            <span className="text-base font-bold group-hover:text-emerald-600 transition-colors">{type.brand}</span>
                            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded w-fit">{type.name}</span>
                        </div>
                        <Button 
                            variant={type.is_active ? "default" : "outline"} 
                            size="sm"
                            className={`h-8 px-4 text-xs font-bold transition-all shadow-sm ${type.is_active ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-slate-400 opacity-60 hover:opacity-100'}`}
                            onClick={() => handleToggleActive(type.id, type.is_active)}
                        >
                            {type.is_active ? "顯示中" : "已隱藏"}
                        </Button>
                    </div>
                ))
            )}
        </div>

        {isAdding && (
            <div className="mt-4 p-6 rounded-2xl border-2 border-dashed border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-950/5 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                            <Plus className="h-4 w-4 text-emerald-600" />
                        </div>
                        <h5 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">填寫新球種資料</h5>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/50" onClick={() => setIsAdding(false)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-brand" className="text-xs font-bold ml-1">品牌</Label>
                            <Input 
                                id="new-brand" 
                                value={brand} 
                                onChange={e => setBrand(e.target.value)} 
                                placeholder="例如: RSL" 
                                required 
                                className="h-11 bg-background border-muted-foreground/20 focus:border-emerald-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-name" className="text-xs font-bold ml-1">型號/名稱</Label>
                            <Input 
                                id="new-name" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="例如: 4號球" 
                                required
                                className="h-11 bg-background border-muted-foreground/20 focus:border-emerald-500" 
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1 h-11 font-bold" onClick={() => setIsAdding(false)}>
                            取消
                        </Button>
                        <Button type="submit" className="flex-[2] h-11 bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-500/20" disabled={loading}>
                            {loading ? "處理中..." : "確認並新增球種"}
                        </Button>
                    </div>
                </form>
            </div>
        )}
      </div>
    </div>
  )
}
