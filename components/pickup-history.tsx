import { useState, useMemo } from "react"
import { PICKUP_HISTORY_LIMIT } from "@/lib/limits"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Trash2, Loader2 } from "lucide-react"

interface PickupRecord {
  id: string
  picker_name: string
  quantity: number
  created_at: string
  shuttlecock_types?: {
    brand: string
    name: string
  }
}

interface PickupHistoryProps {
  records: PickupRecord[]
  onDelete: () => void
}

export function PickupHistory({ records, onDelete }: PickupHistoryProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deletingInListId, setDeletingInListId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [month, setMonth] = useState("")   // 'YYYY-MM'，空字串為不限

  // 可選月份取自現有資料，避免列出沒有紀錄的月份
  const months = useMemo(() => {
    const set = new Set(records.map(r => r.created_at.slice(0, 7)))
    return [...set].sort().reverse()
  }, [records])

  // 目前資料量前端過濾即可；待 C3 的分頁完成後再移到後端
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter(r => {
      if (month && !r.created_at.startsWith(month)) return false
      if (!q) return true
      const type = `${r.shuttlecock_types?.brand ?? ''} ${r.shuttlecock_types?.name ?? ''}`
      return r.picker_name.toLowerCase().includes(q) || type.toLowerCase().includes(q)
    })
  }, [records, query, month])

  const handleDelete = async () => {
    if (!deleteId) return
    setLoading(true)
    setDeletingInListId(deleteId)
    try {
      const response = await fetch(`/api/pickup?id=${deleteId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setDeleteId(null)
        onDelete()
      } else {
        alert("刪除失敗")
      }
    } catch (error) {
      console.error("Delete error:", error)
      alert("連線發生錯誤")
    } finally {
      setLoading(false)
      setTimeout(() => setDeletingInListId(null), 300) // 延遲清除，確保動畫完成
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <div className="flex flex-wrap items-center gap-2 mb-4 px-2">
        <h2 className="text-xl font-bold text-foreground mr-auto">領取歷史紀錄</h2>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜尋姓名或球種"
          className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全部月份</option>
          {months.map(m => (
            <option key={m} value={m}>{m.replace('-', ' / ')}</option>
          ))}
        </select>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
          <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">領取人</TableHead>
              <TableHead className="font-bold">球種</TableHead>
              <TableHead className="text-right font-bold">桶數</TableHead>
              <TableHead className="text-right font-bold w-[120px]">時間</TableHead>
              <TableHead className="text-center font-bold w-[60px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  {records.length === 0 ? '尚無領取紀錄' : '沒有符合條件的紀錄'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((record) => (
                <TableRow key={record.id} className="hover:bg-muted/30 transition-colors group">
                  <TableCell className="font-medium text-foreground">{record.picker_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{record.shuttlecock_types?.brand}</span>
                      <span className="text-[10px] text-muted-foreground">{record.shuttlecock_types?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-foreground font-semibold">{record.quantity} 桶</TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {format(new Date(record.created_at), 'MM/dd', { locale: zhTW })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => setDeleteId(record.id)}
                      disabled={deletingInListId === record.id}
                    >
                      {deletingInListId === record.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 後端固定回傳最近 100 筆。不說明的話，使用者會以為更早的紀錄不存在。 */}
      {records.length >= PICKUP_HISTORY_LIMIT && (
        <p className="px-4 py-2.5 text-xs text-muted-foreground text-center border-t">
          僅載入最近 {PICKUP_HISTORY_LIMIT} 筆領取紀錄{query || month ? '，搜尋與篩選在此範圍內進行' : ''}；更早的紀錄仍保存於系統中
        </p>
      )}
    </div>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription className="py-2">
              你確定要刪除這筆領取紀錄嗎？此動作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={loading}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確定刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
