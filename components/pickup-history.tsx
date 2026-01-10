import { useState } from "react"
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
}

interface PickupHistoryProps {
  records: PickupRecord[]
  onDelete: () => void
}

export function PickupHistory({ records, onDelete }: PickupHistoryProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return
    setLoading(true)
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
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4 px-2 text-foreground">領取歷史紀錄</h2>
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
          <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">領取人</TableHead>
              <TableHead className="text-right font-bold">桶數</TableHead>
              <TableHead className="text-right font-bold w-[120px]">時間</TableHead>
              <TableHead className="text-center font-bold w-[60px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                  尚無領取紀錄
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id} className="hover:bg-muted/30 transition-colors group">
                  <TableCell className="font-medium text-foreground">{record.picker_name}</TableCell>
                  <TableCell className="text-right text-foreground font-semibold">{record.quantity} 桶</TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {format(new Date(record.created_at), 'MM/dd HH:mm', { locale: zhTW })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => setDeleteId(record.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
