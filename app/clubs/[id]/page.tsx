'use client'

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { ToastContainer, showToast } from "@/components/ui/toast"
import { ThemeToggle } from "@/components/theme-toggle"
import { EventDetailDialog } from "@/components/event-detail-dialog"
import {
  ChevronLeft, Plus, Loader2, Lock, CalendarDays,
  BadgeCheck, Trash2, Sparkles, ClipboardList,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Club { id: string; name: string; leader_name: string }

interface BadmintonEvent {
  id: string; event_date: string; venue_name: string | null
  court_count: number; hours: number; hourly_rate: number
  shuttle_cost_mode: 'auto' | 'manual'; shuttle_cost: number
  is_settled: boolean; notes: string | null
  venue_cost: number; total_revenue: number; profit: number
}

interface ParsedName { name: string; included: boolean; fee: number; isFree: boolean }

// ─── LINE Parser ──────────────────────────────────────────────────────────────

function parseLineMessage(text: string) {
  const mainText = text.split(/候補[0-9]?[：:]?[\s\S]*|——+|🈵/)[0]

  let eventDate: string | undefined
  const fullDate = mainText.match(/(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/)
  if (fullDate) {
    eventDate = `${fullDate[1]}-${fullDate[2].padStart(2, '0')}-${fullDate[3].padStart(2, '0')}`
  } else {
    const shortDate = mainText.match(/\b(\d{1,2})[\/.](\d{1,2})\b/)
    if (shortDate) {
      const year = new Date().getFullYear()
      eventDate = `${year}-${shortDate[1].padStart(2, '0')}-${shortDate[2].padStart(2, '0')}`
    }
  }

  let hours: number | undefined
  const fullTime = mainText.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/)
  if (fullTime) {
    const start = parseInt(fullTime[1]) * 60 + parseInt(fullTime[2])
    const end = parseInt(fullTime[3]) * 60 + parseInt(fullTime[4])
    if (end > start) hours = Math.round((end - start) / 60 * 10) / 10
  } else {
    const simple = mainText.match(/\b([01]?\d|2[0-3])\s*-\s*([01]?\d|2[0-3])\b/)
    if (simple) {
      const s = parseInt(simple[1]), e = parseInt(simple[2])
      if (e > s && s >= 6 && e <= 24) hours = e - s
    }
  }

  let venueName: string | undefined
  const venueMatch = mainText.match(/場館[：:]\s*([^\n]+)|場地[：:]\s*([^\n]+)/)
  if (venueMatch) venueName = (venueMatch[1] || venueMatch[2]).trim()

  const names: string[] = []
  const nameRe = /^\d+[.．、][ \t]*(.+)/gm
  let m: RegExpExecArray | null
  while ((m = nameRe.exec(mainText)) !== null) {
    const n = m[1].trim()
    if (n) names.push(n)
  }
  return { eventDate, venueName, hours, names }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => `$${Math.abs(n).toLocaleString()}`
const profitClass = (p: number) =>
  p > 0 ? 'text-red-500 dark:text-red-400 font-bold' :
  p < 0 ? 'text-green-600 dark:text-green-500 font-bold' :
  'text-muted-foreground font-bold'
const profitLabel = (p: number) => `${p >= 0 ? '+' : '-'}${fmtMoney(p)}`

// ─── CreateEventDialog ────────────────────────────────────────────────────────

function CreateEventDialog({
  clubId, open, onOpenChange, onCreated,
}: { clubId: string; open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [eventDate, setEventDate] = useState(today)
  const [venueName, setVenueName] = useState('')
  const [courtCount, setCourtCount] = useState('2')
  const [hours, setHours] = useState('2')
  const [hourlyRate, setHourlyRate] = useState('')
  const [notes, setNotes] = useState('')
  const [lineText, setLineText] = useState('')
  const [parsedNames, setParsedNames] = useState<ParsedName[]>([])
  const [defaultFee, setDefaultFee] = useState('')
  const [inputMode, setInputMode] = useState<'line' | 'manual'>('line')
  const [manualText, setManualText] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualFee, setManualFee] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setEventDate(today); setVenueName(''); setCourtCount('2'); setHours('2')
    setHourlyRate(''); setNotes('')
    setLineText(''); setParsedNames([]); setDefaultFee('')
    setInputMode('line'); setManualText(''); setManualName(''); setManualFee('')
  }

  const handleParse = () => {
    if (!lineText.trim()) { showToast('請先貼上 LINE 訊息', 'warning'); return }
    const result = parseLineMessage(lineText)
    if (result.eventDate) setEventDate(result.eventDate)
    if (result.venueName) setVenueName(result.venueName)
    if (result.hours) setHours(String(result.hours))
    if (result.names.length === 0) { showToast('未找到出席名單，請確認訊息格式', 'warning'); return }
    const fee = parseFloat(defaultFee) || 0
    setParsedNames(result.names.map(name => ({ name, included: true, fee, isFree: false })))
    showToast(`已解析 ${result.names.length} 位出席者`, 'success')
  }

  const applyDefaultFee = () => {
    const fee = parseFloat(defaultFee) || 0
    setParsedNames(prev => prev.map(p => p.isFree ? p : { ...p, fee }))
  }

  const handleManualBatchAdd = () => {
    const names = manualText.split('\n').map(s => s.trim()).filter(Boolean)
    if (names.length === 0) { showToast('請輸入至少一個名稱', 'warning'); return }
    const fee = parseFloat(defaultFee) || 0
    setParsedNames(prev => [...prev, ...names.map(name => ({ name, included: true, fee, isFree: false }))])
    setManualText('')
    showToast(`已新增 ${names.length} 位出席者`, 'success')
  }

  const handleManualSingleAdd = () => {
    if (!manualName.trim()) return
    const fee = parseFloat(manualFee) || 0
    setParsedNames(prev => [...prev, { name: manualName.trim(), included: true, fee, isFree: false }])
    setManualName('')
    setManualFee('')
  }

  const venueCost = (parseFloat(courtCount) || 0) * (parseFloat(hours) || 0) * (parseFloat(hourlyRate) || 0)

  const handleCreate = async () => {
    if (!eventDate) { showToast('請輸入活動日期', 'warning'); return }
    if (!courtCount || parseFloat(courtCount) < 1) { showToast('場地數需大於 0', 'warning'); return }
    if (!hours || parseFloat(hours) <= 0) { showToast('時數需大於 0', 'warning'); return }
    if (!hourlyRate || parseFloat(hourlyRate) < 0) { showToast('請輸入每小時場租', 'warning'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId, eventDate,
          venueName: venueName || null,
          courtCount: parseInt(courtCount),
          hours: parseFloat(hours),
          hourlyRate: parseFloat(hourlyRate),
          shuttleCostMode: 'manual',
          shuttleCost: 0,
          notes: notes || null,
        }),
      })
      const eventData = await res.json()
      if (!res.ok) throw new Error(eventData.error)

      // 序列寫入，確保出席順序與 LINE 訊息一致
      const toAdd = parsedNames.filter(p => p.included)
      for (const p of toAdd) {
        await fetch(`/api/events/${eventData.id}/attendees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: p.name, fee: p.fee, isFree: p.isFree, paid: false }),
        })
      }

      showToast('活動建立成功', 'success')
      onOpenChange(false); reset(); onCreated()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '建立失敗', 'error')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" /> 新增活動
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-5 py-1 px-1">
          {/* 出席名單輸入區 */}
          <div className="space-y-2 rounded-xl border border-dashed border-blue-200 dark:border-blue-800 p-3 bg-blue-50/40 dark:bg-blue-950/20">
            {/* Tab 切換 */}
            <div className="flex gap-1 bg-blue-100/60 dark:bg-blue-900/30 rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setInputMode('line')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${inputMode === 'line' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Sparkles className="w-3 h-3" /> LINE 解析
              </button>
              <button
                onClick={() => setInputMode('manual')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${inputMode === 'manual' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ClipboardList className="w-3 h-3" /> 手動輸入
              </button>
            </div>

            {inputMode === 'line' ? (
              <div className="space-y-2">
                <textarea
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="將 LINE 群組的報名訊息貼在這裡..."
                  value={lineText}
                  onChange={e => setLineText(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="預設費用（元）" value={defaultFee}
                    onChange={e => setDefaultFee(e.target.value)}
                    className="w-36 h-8 text-sm" type="number"
                  />
                  <Button size="sm" variant="secondary" onClick={handleParse} className="gap-1.5 h-8">
                    <Sparkles className="w-3.5 h-3.5" /> 解析訊息
                  </Button>
                  {parsedNames.length > 0 && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      ✓ {parsedNames.filter(p => p.included).length} 人
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* 批次輸入：一行一人 */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">批次輸入（一行一人）</Label>
                  <textarea
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={"珍妮\n小明\n阿華"}
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="預設費用（元）" value={defaultFee}
                      onChange={e => setDefaultFee(e.target.value)}
                      className="w-36 h-8 text-sm" type="number"
                    />
                    <Button size="sm" variant="secondary" onClick={handleManualBatchAdd} className="h-8">
                      新增至名單
                    </Button>
                  </div>
                </div>

                {/* 分隔線 */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex-1 border-t border-border/60" />
                  <span>或逐一新增</span>
                  <div className="flex-1 border-t border-border/60" />
                </div>

                {/* 單筆新增 */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="姓名"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSingleAdd()}
                    className="h-8 text-sm flex-1"
                  />
                  <Input
                    type="number" placeholder="費用"
                    value={manualFee}
                    onChange={e => setManualFee(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSingleAdd()}
                    className="h-8 text-sm w-20"
                  />
                  <Button size="sm" onClick={handleManualSingleAdd} disabled={!manualName.trim()} className="h-8 px-3">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {parsedNames.length > 0 && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    ✓ 目前共 {parsedNames.filter(p => p.included).length} 人
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 解析名單預覽 */}
          {parsedNames.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">出席名單預覽</Label>
                <div className="flex items-center gap-1.5">
                  <Input placeholder="統一費用" value={defaultFee} onChange={e => setDefaultFee(e.target.value)} className="w-24 h-7 text-xs" type="number" />
                  <Button size="sm" variant="ghost" onClick={applyDefaultFee} className="h-7 text-xs px-2">套用</Button>
                </div>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 rounded-lg border p-2">
                {parsedNames.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                    <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                    <input type="checkbox" checked={p.included} onChange={e => setParsedNames(prev => prev.map((n, j) => j === i ? { ...n, included: e.target.checked } : n))} className="w-3.5 h-3.5 accent-blue-600" />
                    <Input value={p.name} onChange={e => setParsedNames(prev => prev.map((n, j) => j === i ? { ...n, name: e.target.value } : n))} className="h-7 text-xs flex-1 min-w-0" />
                    <Input type="number" value={p.isFree ? '' : p.fee} disabled={p.isFree} onChange={e => setParsedNames(prev => prev.map((n, j) => j === i ? { ...n, fee: parseFloat(e.target.value) || 0 } : n))} className="h-7 text-xs w-16 sm:w-20" placeholder="費用" />
                    <button onClick={() => setParsedNames(prev => prev.map((n, j) => j === i ? { ...n, isFree: !n.isFree } : n))} className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${p.isFree ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300' : 'text-muted-foreground border-border hover:bg-muted'}`}>免費</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 場地資訊 */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">場地資訊</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">活動日期 *</Label>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">場地名稱</Label>
                <Input placeholder="例：嘉世羽球" value={venueName} onChange={e => setVenueName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">場地數 *</Label>
                <Input type="number" min="1" value={courtCount} onChange={e => setCourtCount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">時數 *</Label>
                <Input type="number" min="0.5" step="0.5" value={hours} onChange={e => setHours(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">每小時場租 *</Label>
                <Input type="number" min="0" placeholder="元" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">場租小計</Label>
                <div className="h-10 flex items-center px-3 rounded-lg border bg-muted/50 text-sm font-medium">${venueCost.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">備註（選填）</Label>
            <Input placeholder="備註" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="pt-3 border-t flex-col gap-2">
          {loading && (
            <p className="text-xs text-muted-foreground text-center w-full">
              正在建立活動{parsedNames.filter(p => p.included).length > 0 ? `（逐一新增 ${parsedNames.filter(p => p.included).length} 位出席者）` : ''}，請稍候…
            </p>
          )}
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => { onOpenChange(false); reset() }} disabled={loading}>取消</Button>
            <Button onClick={handleCreate} disabled={loading} className="gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}建立活動
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── PinGate ──────────────────────────────────────────────────────────────────

function PinGate({ clubId, clubName, onVerified }: { clubId: string; clubName: string; onVerified: () => void }) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async () => {
    if (!pin) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/clubs/${clubId}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'PIN 碼錯誤'); return }
      sessionStorage.setItem(`club_verified_${clubId}`, 'true')
      onVerified()
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl border shadow-sm p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-black text-foreground">進入 {clubName}</h2>
            <p className="text-sm text-muted-foreground">請輸入球隊 PIN 碼以進入</p>
          </div>
          <div className="space-y-3">
            <Input
              type="password" placeholder="輸入 PIN 碼" value={pin} autoFocus
              onChange={e => { setPin(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              className="text-center text-lg tracking-widest h-12"
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <Button className="w-full h-11 gap-2" onClick={handleVerify} disabled={loading || !pin}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}確認進入
            </Button>
          </div>
          <div className="text-center">
            <Link href="/clubs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← 返回球隊清單
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClubEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = use(params)
  const [club, setClub] = useState<Club | null>(null)
  const [verified, setVerified] = useState(false)
  const [loadingClub, setLoadingClub] = useState(true)
  const [events, setEvents] = useState<BadmintonEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Check session verification & fetch club info
  useEffect(() => {
    const isVerified = sessionStorage.getItem(`club_verified_${clubId}`) === 'true'
    setVerified(isVerified)

    fetch(`/api/clubs/${clubId}`)
      .then(r => r.json())
      .then(d => { if (d.id) setClub(d) })
      .finally(() => setLoadingClub(false))
  }, [clubId])

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const res = await fetch(`/api/events?club_id=${clubId}`)
      const data = await res.json()
      if (res.ok) setEvents(data)
    } finally { setLoadingEvents(false) }
  }, [clubId])

  useEffect(() => { if (verified) fetchEvents() }, [verified, fetchEvents])

  const handleDelete = async (ev: BadmintonEvent) => {
    if (!confirm(`確定刪除 ${ev.event_date} 的活動？`)) return
    setDeletingId(ev.id)
    try {
      const res = await fetch(`/api/events/${ev.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { showToast(data.error, 'error'); return }
      showToast('活動已刪除', 'success')
      fetchEvents()
    } finally { setDeletingId(null) }
  }

  // Loading state
  if (loadingClub) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // PIN gate
  if (!verified) {
    return (
      <>
        <PinGate clubId={clubId} clubName={club?.name ?? '球隊'} onVerified={() => setVerified(true)} />
        <ToastContainer />
      </>
    )
  }

  // Profit summary
  const totalProfit = events.reduce((s, e) => s + e.profit, 0)
  const settledCount = events.filter(e => e.is_settled).length

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border/60 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/clubs" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" /> 球隊清單
            </Link>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2 font-semibold">
              <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>🏸 {club?.name}</span>
              {club?.leader_name && (
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline">— {club.leader_name}</span>
              )}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {/* Stats + Action row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-xl font-black">活動紀錄</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                共 {events.length} 場 · {settledCount} 場已結算
              </p>
            </div>
            {events.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted/30 text-sm">
                <span className="text-muted-foreground">累計利潤</span>
                <span className={`font-black ${profitClass(totalProfit)}`}>{profitLabel(totalProfit)}</span>
              </div>
            )}
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> 新增活動
          </Button>
        </div>

        {/* Events Table */}
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          {/* Table Header — desktop only */}
          <div className="hidden md:grid grid-cols-[120px_1fr_90px_90px_90px_100px_80px_50px] gap-3 px-5 py-3 bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>日期</span>
            <span>場地</span>
            <span className="text-right">場租</span>
            <span className="text-right">球費</span>
            <span className="text-right">收費</span>
            <span className="text-right">利潤</span>
            <span className="text-center">狀態</span>
            <span></span>
          </div>

          {loadingEvents ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-muted-foreground">
              <CalendarDays className="w-12 h-12 opacity-20" />
              <p className="text-sm">尚無活動紀錄，點擊「新增活動」開始記錄</p>
            </div>
          ) : (
            events.map((ev, i) => (
              <div
                key={ev.id}
                onClick={() => { setDetailEventId(ev.id); setDetailOpen(true) }}
                className={`px-5 hover:bg-muted/20 cursor-pointer transition-colors group ${i < events.length - 1 ? 'border-b border-border/60' : ''}`}
              >
                {/* Mobile layout */}
                <div className="flex items-center gap-3 py-3.5 md:hidden">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">{ev.event_date}</span>
                      {ev.is_settled && <BadgeCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{ev.venue_name || '未設定場地'}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-bold ${profitClass(ev.profit)}`}>{profitLabel(ev.profit)}</span>
                    <div onClick={e => e.stopPropagation()}>
                      {!ev.is_settled && (
                        <button
                          onClick={() => handleDelete(ev)}
                          disabled={deletingId === ev.id}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        >
                          {deletingId === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {/* Desktop layout */}
                <div className="hidden md:grid grid-cols-[120px_1fr_90px_90px_90px_100px_80px_50px] gap-3 py-4 items-center">
                  <div className="font-semibold text-sm">{ev.event_date}</div>
                  <div className="text-sm text-muted-foreground truncate">{ev.venue_name || '—'}</div>
                  <div className="text-sm text-right">{fmtMoney(ev.venue_cost)}</div>
                  <div className="text-sm text-right">{fmtMoney(ev.shuttle_cost)}</div>
                  <div className="text-sm text-right">{fmtMoney(ev.total_revenue)}</div>
                  <div className={`text-sm text-right ${profitClass(ev.profit)}`}>{profitLabel(ev.profit)}</div>
                  <div className="flex justify-center">
                    {ev.is_settled ? (
                      <BadgeCheck className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />
                    )}
                  </div>
                  <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                    {!ev.is_settled && (
                      <button
                        onClick={() => handleDelete(ev)}
                        disabled={deletingId === ev.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {deletingId === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {events.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            點擊任一列可查看活動詳情與出席名單
          </p>
        )}
      </div>

      {/* Dialogs */}
      <CreateEventDialog
        clubId={clubId} open={createOpen}
        onOpenChange={setCreateOpen} onCreated={fetchEvents}
      />
      {detailEventId && (
        <EventDetailDialog
          eventId={detailEventId} open={detailOpen}
          onOpenChange={(o) => { setDetailOpen(o); if (!o) { setDetailEventId(null); fetchEvents() } }}
        />
      )}

      <ToastContainer />
    </main>
  )
}
