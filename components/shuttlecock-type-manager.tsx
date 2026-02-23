'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, X, Pencil, Loader2 } from "lucide-react"
import { showToast } from "@/components/ui/toast"

interface ShuttlecockType {
  id: string
  brand: string
  name: string
  is_active: boolean
  can_edit: boolean
  has_records: boolean
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
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 編輯相關狀態
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBrand, setEditBrand] = useState("")
  const [editName, setEditName] = useState("")
  const [editDefaultPrice, setEditDefaultPrice] = useState("")

  const fetchTypes = async () => {
    setListLoading(true)
    try {
      const res = await fetch('/api/inventory/types?all=true')
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
      await fetchTypes()
      showToast(`已新增球種：${brand} ${name}`, 'success')
      // 通知父層有變更（但不觸發整頁重新整理）
      if (onTypeAdded) onTypeAdded()
    } catch (error) {
      console.error(error)
      showToast("新增球種失敗", 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id)
    try {
      const res = await fetch('/api/inventory/types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive })
      })
      if (res.ok) {
        await fetchTypes()
        const newStatus = !currentActive ? '顯示' : '隱藏'
        showToast(`已${newStatus}球種`, 'success')
        // 通知父層有變更（但不觸發整頁重新整理）
        if (onTypeAdded) onTypeAdded()
      }
    } catch (error) {
      console.error(error)
      showToast("操作失敗", 'error')
    } finally {
      setTogglingId(null)
    }
  }

  const handleStartEdit = (type: ShuttlecockType) => {
      setEditingId(type.id)
      setEditBrand(type.brand)
      setEditName(type.name)
      setEditDefaultPrice("") // 編輯模式開啟時，讓使用者輸入新的價格，不預帶舊的(因為這是批量更新功能)
  }

  const handleUpdate = async () => {
    setLoading(true)
    try {
        const res = await fetch('/api/inventory/types', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id: editingId, 
                brand: editBrand, 
                name: editName,
                update_historical_price: editDefaultPrice ? parseInt(editDefaultPrice) : undefined
            })
        })
        if (res.ok) {
            setEditingId(null)
            await fetchTypes()
            showToast(`已更新球種：${editBrand} ${editName}`, 'success')
            // 通知父層有變更（但不觸發整頁重新整理）
            if (onTypeAdded) onTypeAdded()
        } else {
            const data = await res.json()
            showToast(data.error || "更新失敗", 'error')
        }
    } catch (error) {
        console.error(error)
        showToast("更新失敗", 'error')
    } finally {
        setLoading(false)
    }
  }

  const handleDelete = async (type: ShuttlecockType) => {
      if (type.has_records) {
          showToast(`「${type.brand} ${type.name}」已有消耗紀錄，無法刪除。若不再使用，請點擊「隱藏」`, 'warning', 5000)
          return
      }

      if (!confirm(`確定要永久刪除「${type.brand} ${type.name}」嗎？`)) return

      setDeletingId(type.id)
      try {
          const res = await fetch(`/api/inventory/types?id=${type.id}`, {
              method: 'DELETE'
          })
          if (res.ok) {
              await fetchTypes()
              showToast(`已刪除球種：${type.brand} ${type.name}`, 'success')
              // 通知父層有變更（但不觸發整頁重新整理）
              if (onTypeAdded) onTypeAdded()
          } else {
              const data = await res.json()
              showToast(data.error || "刪除失敗", 'error')
          }
      } catch (error) {
          console.error(error)
          showToast("刪除失敗", 'error')
      } finally {
          setDeletingId(null)
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
          <p className="text-xs text-muted-foreground mt-1">設定顯示/隱藏，或編輯系統預設球種內容</p>
        </div>
        
        {!isAdding && (
          <Button 
            onClick={() => setIsAdding(true)}
            className="bg-emerald-600 hover:bg-emerald-700 font-bold gap-2 animate-in fade-in zoom-in duration-300"
          >
            <Plus className="h-4 w-4" /> 新增球種
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {isAdding && (
            <div className="mb-4 p-6 rounded-2xl border-2 border-dashed border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-950/5 animate-in slide-in-from-top-4 duration-300">
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
                                className="h-11 bg-background border-muted-foreground/20 focus:border-emerald-500 shadow-sm"
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
                                className="h-11 bg-background border-muted-foreground/20 focus:border-emerald-500 shadow-sm" 
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1 h-11 font-bold" onClick={() => setIsAdding(false)}>
                            取消
                        </Button>
                        <Button type="submit" className="flex-[2] h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    處理中...
                                </>
                            ) : (
                                "確認並新增球種"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        )}

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-2 ${types.length > 4 ? 'max-h-[500px]' : ''}`}>
            {listLoading && types.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">載入中...</div>
            ) : types.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">尚無球種</div>
            ) : (
                types.map(type => (
                    <div key={type.id} className={`flex flex-col p-4 rounded-xl bg-background border transition-all shadow-sm group ${editingId === type.id ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-border hover:border-emerald-500/30'}`}>
                        {editingId === type.id ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <Input value={editBrand} onChange={e => setEditBrand(e.target.value)} bs-size="sm" className="h-8 text-xs" placeholder="品牌" />
                                    <Input value={editName} onChange={e => setEditName(e.target.value)} bs-size="sm" className="h-8 text-xs" placeholder="型號" />
                                </div>
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                    <Label className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1 block">批量更新歷史進貨單價 (慎用)</Label>
                                    <Input 
                                        type="number" 
                                        value={editDefaultPrice} 
                                        onChange={e => setEditDefaultPrice(e.target.value)} 
                                        className="h-8 text-xs bg-white dark:bg-slate-900" 
                                        placeholder="輸入金額以更新所有歷史紀錄" 
                                    />
                                    <p className="text-[10px] text-blue-600/80 dark:text-blue-400/70 mt-1">
                                        * 若輸入並儲存，將會把此球種的所有歷史進貨紀錄單價統一修改為此價格。
                                    </p>
                                </div>
                                <div className="flex gap-2 justify-end mt-2">
                                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditingId(null)} disabled={loading}>取消</Button>
                                    <Button size="sm" className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700" onClick={handleUpdate} disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                儲存中
                                            </>
                                        ) : (
                                            "儲存"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-base font-bold group-hover:text-emerald-600 transition-colors">{type.brand}</span>
                                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded w-fit">{type.name}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {type.can_edit && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-orange-500 hover:bg-orange-50"
                                                onClick={() => handleStartEdit(type)}
                                                disabled={loading || togglingId === type.id || deletingId === type.id}
                                            >
                                                <Pencil className="h-3 w-3" />
                                                <span className="sr-only">編輯</span>
                                            </Button>
                                        )}
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className={`h-7 w-7 ${type.has_records ? 'text-slate-200 cursor-not-allowed' : 'text-rose-400 hover:bg-rose-50'}`}
                                            onClick={() => handleDelete(type)}
                                            disabled={type.has_records || deletingId === type.id || togglingId === type.id}
                                        >
                                            {deletingId === type.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <X className="h-3 w-3" />
                                            )}
                                            <span className="sr-only">刪除</span>
                                        </Button>
                                    </div>
                                </div>

                                <Button 
                                    variant={type.is_active ? "default" : "outline"} 
                                    size="sm"
                                    className={`w-full h-8 px-4 text-xs font-bold transition-all shadow-sm ${type.is_active ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-slate-400 opacity-60 hover:opacity-100'}`}
                                    onClick={() => handleToggleActive(type.id, type.is_active)}
                                    disabled={togglingId === type.id || deletingId === type.id}
                                >
                                    {togglingId === type.id ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                            處理中...
                                        </>
                                    ) : (
                                        type.is_active ? "首頁：顯示中" : "首頁：已隱藏"
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                ))
            )}
        </div>


      </div>
    </div>
  )
}
