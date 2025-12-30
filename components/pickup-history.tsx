'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"

interface PickupRecord {
  id: string
  picker_name: string
  quantity: number
  created_at: string
}

interface PickupHistoryProps {
  records: PickupRecord[]
}

export function PickupHistory({ records }: PickupHistoryProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4 px-2 text-slate-700">領取歷史紀錄</h2>
      <div className="bg-white rounded-xl border-2 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">領取人</TableHead>
              <TableHead className="text-right font-bold">桶數</TableHead>
              <TableHead className="text-right font-bold">時間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-slate-400">
                  尚無領取紀錄
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="font-medium text-slate-700">{record.picker_name}</TableCell>
                  <TableCell className="text-right text-slate-600 font-semibold">{record.quantity} 桶</TableCell>
                  <TableCell className="text-right text-slate-400 text-xs">
                    {format(new Date(record.created_at), 'MM/dd HH:mm', { locale: zhTW })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
