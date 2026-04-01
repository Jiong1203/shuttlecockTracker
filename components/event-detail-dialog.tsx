'use client'

import { useState, useEffect, useCallback } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { showToast } from "@/components/ui/toast"
import {
  Loader2, Plus, Trash2, BadgeCheck, Lock, Sparkles, RotateCcw,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface FullEvent {
  id: string
  event_date: string
  venue_name: string | null
  court_count: number
  hours: number
  hourly_rate: number
  shuttle_cost_mode: 'auto' | 'manual'
  shuttle_cost: number
  is_settled: boolean
  notes: string | null
  venue_cost: number
  total_revenue: number
  profit: number
  event_attendees: Attendee[]
}

interface Attendee {
  id: string
  display_name: string
  fee: number
  paid: boolean
  is_free: boolean
  created_at: string
}

interface ShuttleType {
  shuttlecock_type_id: string
  brand: string
  name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => `$${Math.abs(n).toLocaleString()}`
const profitClass = (p: number) =>
  p > 0 ? 'text-red-500 dark:text-red-400' :
  p < 0 ? 'text-green-600 dark:text-green-500' :
  'text-muted-foreground'
const profitLabel = (p: number) => `${p >= 0 ? '+' : '-'}${fmtMoney(p)}`

// ─── ProfitCard ───────────────────────────────────────────────────────────────

function ProfitCard({ event }: { event: FullEvent }) {
  const items = [
    { label: '場租費用', value: fmtMoney(event.venue_cost), className: 'text-foreground' },
    { label: '用球成本', value: fmtMoney(event.shuttle_cost), className: 'text-foreground' },
    { label: '總收費', value: fmtMoney(event.total_revenue), className: 'text-foreground' },
    { label: '利潤', value: profitLabel(event.profit), className: `text-lg ${profitClass(event.profit)} font-black` },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 rounded-xl border p-3 bg-muted/30">
      {items.map(it => (
        <div key={it.label} className="text-center space-y-0.5">
          <div className="text-[10px] text-muted-foreground">{it.label}</div>
          <div className={`text-sm font-semibold ${it.className}`}>{it.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── FifoCalculator ───────────────────────────────────────────────────────────

function FifoCalculator({ eventId, onApply }: { eventId: string; onApply: (cost: number) => void }) {
  const [open, setOpen] = useState(false)
  const [types, setTypes] = useState<ShuttleType[]>([])
  const [typeId, setTypeId] = useState('')
  const [qty, setQty] = useState('')
  const [result, setResult] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchTypes = useCallback(async () => {
    const res = await fetch('/api/inventory')
    const data = await res.json()
    if (res.ok) setTypes(data.filter((t: ShuttleType & { is_active: boolean }) => t.is_active))
  }, [])

  useEffect(() => { if (open) { fetchTypes(); setResult(null); setTypeId(''); setQty('') } }, [open, fetchTypes])

  const handleCalc = async () => {
    if (!typeId || !qty || parseFloat(qty) <= 0) {
      showToast('請選擇球種並輸入顆數', 'warning'); return
    }
    setLoading(true); setResult(null)
    try {
      const res = await fetch(`/api/events/${eventId}/shuttle-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shuttlecockTypeId: typeId, quantity: parseFloat(qty) }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error, 'error'); return }
      setResult(data.cost)
    } finally { setLoading(false) }
  }

  const handleApply = async () => {
    if (result === null) return
    onApply(result)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        <Sparkles className="w-3.5 h-3.5" /> FIFO 自動試算
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-blue-600" /> FIFO 用球成本試算
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">球種</Label>
              <select
                value={typeId}
                onChange={e => setTypeId(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">選擇球種...</option>
                {types.map(t => (
                  <option key={t.shuttlecock_type_id} value={t.shuttlecock_type_id}>
                    {t.brand} {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">顆數</Label>
              <Input type="number" min="1" placeholder="本場使用顆數" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            {result !== null && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
                <div className="text-xs text-muted-foreground">FIFO 試算結果</div>
                <div className="text-xl font-black text-blue-600 dark:text-blue-400">${result.toLocaleString()}</div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>取消</Button>
            <Button variant="secondary" size="sm" onClick={handleCalc} disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 試算
            </Button>
            {result !== null && (
              <Button size="sm" onClick={handleApply} className="gap-1.5">套用 ${result.toLocaleString()}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── AttendeeRow ──────────────────────────────────────────────────────────────

function AttendeeRow({
  a, eventId, onUpdated,
}: { a: Attendee; eventId: string; onUpdated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [fee, setFee] = useState(String(a.fee))
  const [editingFee, setEditingFee] = useState(false)

  const patch = async (updates: Partial<{ paid: boolean; isFree: boolean; fee: number; displayName: string }>) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/attendees/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return }
      onUpdated()
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/attendees/${a.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return }
      onUpdated()
    } finally { setLoading(false) }
  }

  const handleFeeBlur = () => {
    setEditingFee(false)
    const parsed = parseFloat(fee)
    if (!isNaN(parsed) && parsed !== a.fee) patch({ fee: parsed })
    else setFee(String(a.fee))
  }

  return (
    <div className={`flex items-center gap-2 py-2 px-1 rounded-lg text-sm transition-colors ${loading ? 'opacity-50' : ''}`}>
      {/* Name */}
      <span className={`flex-1 font-medium truncate ${a.is_free ? 'text-muted-foreground' : ''}`}>
        {a.display_name}
        {a.is_free && <span className="ml-1 text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-300">免費</span>}
      </span>

      {/* Fee */}
      {!a.is_free && (
        editingFee ? (
          <Input
            type="number"
            value={fee}
            autoFocus
            onChange={e => setFee(e.target.value)}
            onBlur={handleFeeBlur}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-7 w-20 text-xs"
          />
        ) : (
          <button
            onClick={() => setEditingFee(true)}
            className="w-20 text-right text-muted-foreground hover:text-foreground text-xs hover:underline"
          >
            ${Number(a.fee).toLocaleString()}
          </button>
        )
      )}

      {/* Free toggle */}
      <button
        onClick={() => patch({ isFree: !a.is_free })}
        disabled={loading}
        className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${a.is_free ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300' : 'text-muted-foreground border-border hover:bg-muted'}`}
      >
        免費
      </button>

      {/* Paid toggle */}
      {!a.is_free && (
        <button
          onClick={() => patch({ paid: !a.paid })}
          disabled={loading}
          className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${a.paid ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300' : 'text-muted-foreground border-border hover:bg-muted'}`}
        >
          {a.paid ? '已繳' : '未繳'}
        </button>
      )}

      {/* Delete */}
      <button onClick={handleDelete} disabled={loading} className="text-muted-foreground hover:text-red-500 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── EventDetailDialog (Main Export) ─────────────────────────────────────────

interface EventDetailDialogProps {
  eventId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EventDetailDialog({ eventId, open, onOpenChange }: EventDetailDialogProps) {
  const [event, setEvent] = useState<FullEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState(false)
  const [newName, setNewName] = useState('')
  const [addingAttendee, setAddingAttendee] = useState(false)
  const [bulkFee, setBulkFee] = useState('')
  const [editingShuttle, setEditingShuttle] = useState(false)
  const [shuttleCostInput, setShuttleCostInput] = useState('')

  const fetchEvent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}`)
      const data = await res.json()
      if (res.ok) setEvent(data)
    } finally { setLoading(false) }
  }, [eventId])

  useEffect(() => { if (open && eventId) fetchEvent() }, [open, eventId, fetchEvent])

  const handleAddAttendee = async () => {
    if (!newName.trim()) return
    setAddingAttendee(true)
    try {
      const res = await fetch(`/api/events/${eventId}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: newName.trim(), fee: 0, paid: false, isFree: false }),
      })
      if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return }
      setNewName('')
      fetchEvent()
    } finally { setAddingAttendee(false) }
  }

  const handleMarkAllPaid = async () => {
    if (!event) return
    const unpaid = event.event_attendees.filter(a => !a.paid && !a.is_free)
    if (unpaid.length === 0) { showToast('所有人皆已繳費', 'info'); return }
    await Promise.all(unpaid.map(a =>
      fetch(`/api/events/${eventId}/attendees/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      })
    ))
    fetchEvent()
  }

  const handleApplyBulkFee = async () => {
    if (!event || !bulkFee) return
    const fee = parseFloat(bulkFee)
    if (isNaN(fee)) return
    await Promise.all(
      event.event_attendees.filter(a => !a.is_free).map(a =>
        fetch(`/api/events/${eventId}/attendees/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fee }),
        })
      )
    )
    setBulkFee('')
    fetchEvent()
  }

  const handleApplyFifoCost = async (cost: number) => {
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shuttleCost: cost, shuttleCostMode: 'auto' }),
    })
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return }
    showToast('用球成本已更新', 'success')
    fetchEvent()
  }

  const handleUpdateShuttleCost = async () => {
    const cost = parseFloat(shuttleCostInput)
    if (isNaN(cost) || cost < 0) { showToast('請輸入有效金額', 'warning'); return }
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shuttleCost: cost, shuttleCostMode: 'manual' }),
    })
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return }
    setEditingShuttle(false)
    showToast('用球成本已更新', 'success')
    fetchEvent()
  }

  const handleSettle = async () => {
    if (!confirm('確定標記為已結算？結算後無法刪除此活動。')) return
    setSettling(true)
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSettled: true }),
      })
      if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return }
      showToast('活動已標記為結算', 'success')
      fetchEvent()
    } finally { setSettling(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base">
              <span className="font-black">{event?.event_date ?? '—'}</span>
              {event?.venue_name && (
                <span className="text-sm font-normal text-muted-foreground">{event.venue_name}</span>
              )}
            </div>
            {event?.is_settled && (
              <span className="flex items-center gap-1 text-[11px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                <BadgeCheck className="w-3 h-3" /> 已結算
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading || !event ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-1 px-1">
            {/* Profit Card */}
            <ProfitCard event={event} />

            {/* Shuttle cost controls */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-muted-foreground">
                用球成本：<span className="font-semibold text-foreground">{fmtMoney(event.shuttle_cost)}</span>
                <span className="ml-1 opacity-60">({event.shuttle_cost_mode === 'auto' ? 'FIFO' : '手動'})</span>
              </span>
              <div className="flex items-center gap-3">
                <FifoCalculator eventId={eventId} onApply={handleApplyFifoCost} />
                {editingShuttle ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" autoFocus
                      value={shuttleCostInput}
                      onChange={e => setShuttleCostInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUpdateShuttleCost()}
                      className="h-6 w-20 text-xs"
                    />
                    <button onClick={handleUpdateShuttleCost} className="text-blue-600 hover:underline text-xs">套用</button>
                    <button onClick={() => setEditingShuttle(false)} className="text-muted-foreground hover:underline text-xs">取消</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShuttleCostInput(String(event.shuttle_cost)); setEditingShuttle(true) }}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" /> 手動修改
                  </button>
                )}
              </div>
            </div>

            {/* Attendees */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-semibold">
                  出席名單
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ({event.event_attendees.length} 人 / {event.event_attendees.filter(a => a.paid && !a.is_free).length} 人已繳)
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="統一費用"
                      value={bulkFee}
                      onChange={e => setBulkFee(e.target.value)}
                      className="h-7 w-20 text-xs"
                      type="number"
                    />
                    <button onClick={handleApplyBulkFee} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">套用</button>
                  </div>
                  <button onClick={handleMarkAllPaid} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">全部已繳</button>
                </div>
              </div>

              <div className="rounded-xl border divide-y divide-border/60">
                {event.event_attendees.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">尚無出席者</p>
                ) : (
                  event.event_attendees.map(a => (
                    <div key={a.id} className="px-3">
                      <AttendeeRow a={a} eventId={eventId} onUpdated={fetchEvent} />
                    </div>
                  ))
                )}
              </div>

              {/* Add attendee */}
              {!event.is_settled && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="新增出席者姓名"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddAttendee()}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm" variant="outline"
                    onClick={handleAddAttendee}
                    disabled={addingAttendee || !newName.trim()}
                    className="h-8 gap-1.5 shrink-0"
                  >
                    {addingAttendee ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    新增
                  </Button>
                </div>
              )}
            </div>

            {/* Notes */}
            {event.notes && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                備註：{event.notes}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-3 border-t gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>關閉</Button>
          {event && !event.is_settled && (
            <Button
              variant="outline" size="sm"
              onClick={handleSettle}
              disabled={settling}
              className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
            >
              {settling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              標記已結算
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
