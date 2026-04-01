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
  ChevronLeft, Plus, Settings, Lock, Loader2, Trash2,
  ClipboardList, Users, BadgeCheck, Sparkles, CalendarDays,
} from "lucide-react"
import { EventDetailDialog } from "./event-detail-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Club {
  id: string
  name: string
  leader_name: string
  created_at: string
}

interface BadmintonEvent {
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
  created_at: string
  venue_cost: number
  total_revenue: number
  profit: number
}

interface ParsedName {
  name: string
  included: boolean
  fee: number
  isFree: boolean
}

// ─── LINE Parser ──────────────────────────────────────────────────────────────

function parseLineMessage(text: string): {
  eventDate?: string; venueName?: string; hours?: number; names: string[]
} {
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
  const nameRe = /^\d+[.．、]\s*(.+)/gm
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

// ─── CreateClubDialog ─────────────────────────────────────────────────────────

function CreateClubDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [leaderName, setLeaderName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => { setName(''); setLeaderName(''); setPin('') }

  const handleCreate = async () => {
    if (!name.trim() || !leaderName.trim() || !pin.trim()) {
      showToast('請填寫所有必填欄位', 'warning'); return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, leaderName, pin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('球團建立成功', 'success')
      onOpenChange(false); reset(); onCreated()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '建立失敗', 'error')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> 新增球團
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>球團名稱 <span className="text-red-500">*</span></Label>
            <Input placeholder="例：快樂打羽球" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>隊長 / 負責人 <span className="text-red-500">*</span></Label>
            <Input placeholder="例：阿呆" value={leaderName} onChange={e => setLeaderName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>PIN 碼 <span className="text-red-500">*</span></Label>
            <Input type="password" placeholder="設定登入 PIN" value={pin} onChange={e => setPin(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">此 PIN 為球團負責人專用，請妥善保管</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); reset() }} disabled={loading}>取消</Button>
          <Button onClick={handleCreate} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}建立球團
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── ClubSettingsDialog ───────────────────────────────────────────────────────

function ClubSettingsDialog({
  club, open, onOpenChange, onUpdated,
}: { club: Club; open: boolean; onOpenChange: (v: boolean) => void; onUpdated: () => void }) {
  const [name, setName] = useState(club.name)
  const [leaderName, setLeaderName] = useState(club.leader_name)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) { setName(club.name); setLeaderName(club.leader_name); setPin('') }
  }, [open, club])

  const handleUpdate = async () => {
    const body: Record<string, string> = {}
    if (name.trim() && name !== club.name) body.name = name.trim()
    if (leaderName.trim() && leaderName !== club.leader_name) body.leaderName = leaderName.trim()
    if (pin.trim()) body.pin = pin.trim()
    if (Object.keys(body).length === 0) { showToast('沒有變更內容', 'info'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/clubs/${club.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('球團資訊已更新', 'success')
      onOpenChange(false); onUpdated()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '更新失敗', 'error')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> 球團設定
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>球團名稱</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>隊長 / 負責人</Label>
            <Input value={leaderName} onChange={e => setLeaderName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>更換 PIN 碼（選填，不填則不變更）</Label>
            <Input type="password" placeholder="輸入新 PIN" value={pin} onChange={e => setPin(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button onClick={handleUpdate} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── PinVerifyDialog ──────────────────────────────────────────────────────────

function PinVerifyDialog({
  club, onOpenChange, onSuccess,
}: { club: Club | null; onOpenChange: (v: boolean) => void; onSuccess: (c: Club) => void }) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setPin(''); setError('') }

  const handleVerify = async () => {
    if (!club) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/clubs/${club.id}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'PIN 碼錯誤'); return }
      onSuccess(club); onOpenChange(false); reset()
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={!!club} onOpenChange={(o) => { if (!o) { onOpenChange(false); reset() } }}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" /> 進入 {club?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>PIN 碼</Label>
            <Input
              type="password" placeholder="輸入 PIN"
              value={pin} autoFocus
              onChange={e => { setPin(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); reset() }} disabled={loading}>取消</Button>
          <Button onClick={handleVerify} disabled={loading || !pin} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}確認進入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── CreateEventDialog ────────────────────────────────────────────────────────

function CreateEventDialog({
  club, open, onOpenChange, onCreated,
}: { club: Club; open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [eventDate, setEventDate] = useState(today)
  const [venueName, setVenueName] = useState('')
  const [courtCount, setCourtCount] = useState('2')
  const [hours, setHours] = useState('2')
  const [hourlyRate, setHourlyRate] = useState('')
  const [shuttleCostMode, setShuttleCostMode] = useState<'manual' | 'auto'>('manual')
  const [shuttleCost, setShuttleCost] = useState('')
  const [notes, setNotes] = useState('')
  const [lineText, setLineText] = useState('')
  const [parsedNames, setParsedNames] = useState<ParsedName[]>([])
  const [defaultFee, setDefaultFee] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setEventDate(today); setVenueName(''); setCourtCount('2'); setHours('2')
    setHourlyRate(''); setShuttleCostMode('manual'); setShuttleCost('')
    setNotes(''); setLineText(''); setParsedNames([]); setDefaultFee('')
  }

  const handleParse = () => {
    if (!lineText.trim()) { showToast('請先貼上 LINE 訊息', 'warning'); return }
    const result = parseLineMessage(lineText)
    if (result.eventDate) setEventDate(result.eventDate)
    if (result.venueName) setVenueName(result.venueName)
    if (result.hours) setHours(String(result.hours))
    if (result.names.length === 0) {
      showToast('未找到出席名單，請確認訊息格式', 'warning'); return
    }
    const fee = parseFloat(defaultFee) || 0
    setParsedNames(result.names.map(name => ({ name, included: true, fee, isFree: false })))
    showToast(`已解析 ${result.names.length} 位出席者`, 'success')
  }

  const applyDefaultFee = () => {
    const fee = parseFloat(defaultFee) || 0
    setParsedNames(prev => prev.map(p => p.isFree ? p : { ...p, fee }))
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
          clubId: club.id,
          eventDate,
          venueName: venueName || null,
          courtCount: parseInt(courtCount),
          hours: parseFloat(hours),
          hourlyRate: parseFloat(hourlyRate),
          shuttleCostMode,
          shuttleCost: shuttleCostMode === 'manual' ? (parseFloat(shuttleCost) || 0) : 0,
          notes: notes || null,
        }),
      })
      const eventData = await res.json()
      if (!res.ok) throw new Error(eventData.error)

      // Bulk insert attendees from LINE parse
      const toAdd = parsedNames.filter(p => p.included)
      if (toAdd.length > 0) {
        await Promise.all(toAdd.map(p =>
          fetch(`/api/events/${eventData.id}/attendees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: p.name, fee: p.fee, isFree: p.isFree, paid: false }),
          })
        ))
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
          {/* LINE 解析區 */}
          <div className="space-y-2 rounded-xl border border-dashed border-blue-200 dark:border-blue-800 p-3 bg-blue-50/40 dark:bg-blue-950/20">
            <Label className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
              <Sparkles className="w-4 h-4" /> 貼上 LINE 報名訊息（選填，自動解析）
            </Label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="將 LINE 群組的報名訊息貼在這裡..."
              value={lineText}
              onChange={e => setLineText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Input
                placeholder="預設費用（元）"
                value={defaultFee}
                onChange={e => setDefaultFee(e.target.value)}
                className="w-36 h-8 text-sm"
                type="number"
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

          {/* 解析名單預覽 */}
          {parsedNames.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">出席名單預覽</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="統一費用"
                    value={defaultFee}
                    onChange={e => setDefaultFee(e.target.value)}
                    className="w-24 h-7 text-xs"
                    type="number"
                  />
                  <Button size="sm" variant="ghost" onClick={applyDefaultFee} className="h-7 text-xs px-2">
                    套用
                  </Button>
                </div>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 rounded-lg border p-2">
                {parsedNames.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                    <input
                      type="checkbox"
                      checked={p.included}
                      onChange={e => setParsedNames(prev => prev.map((n, j) => j === i ? { ...n, included: e.target.checked } : n))}
                      className="w-3.5 h-3.5 accent-blue-600"
                    />
                    <Input
                      value={p.name}
                      onChange={e => setParsedNames(prev => prev.map((n, j) => j === i ? { ...n, name: e.target.value } : n))}
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      value={p.isFree ? '' : p.fee}
                      disabled={p.isFree}
                      onChange={e => setParsedNames(prev => prev.map((n, j) => j === i ? { ...n, fee: parseFloat(e.target.value) || 0 } : n))}
                      className="h-7 text-xs w-20"
                      placeholder="費用"
                    />
                    <button
                      onClick={() => setParsedNames(prev => prev.map((n, j) => j === i ? { ...n, isFree: !n.isFree } : n))}
                      className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${p.isFree ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300' : 'text-muted-foreground border-border hover:bg-muted'}`}
                    >
                      免費
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 場地資訊 */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">場地資訊</Label>
            <div className="grid grid-cols-2 gap-3">
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
                <div className="h-10 flex items-center px-3 rounded-lg border bg-muted/50 text-sm font-medium">
                  ${venueCost.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* 用球成本 */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">用球成本</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setShuttleCostMode('manual')}
                className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${shuttleCostMode === 'manual' ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
              >手動輸入</button>
              <button
                onClick={() => setShuttleCostMode('auto')}
                className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${shuttleCostMode === 'auto' ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
              >自動 FIFO</button>
            </div>
            {shuttleCostMode === 'manual' ? (
              <Input type="number" min="0" placeholder="用球成本（元）" value={shuttleCost} onChange={e => setShuttleCost(e.target.value)} />
            ) : (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
                建立活動後，可在活動詳情中依球種與顆數自動計算 FIFO 成本。
              </p>
            )}
          </div>

          {/* 備註 */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">備註（選填）</Label>
            <Input placeholder="備註" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button variant="ghost" onClick={() => { onOpenChange(false); reset() }} disabled={loading}>取消</Button>
          <Button onClick={handleCreate} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}建立活動
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── ClubsView ────────────────────────────────────────────────────────────────

function ClubsView({ onEnterClub }: { onEnterClub: (club: Club) => void }) {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [pinClub, setPinClub] = useState<Club | null>(null)
  const [settingsClub, setSettingsClub] = useState<Club | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchClubs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clubs')
      const data = await res.json()
      if (res.ok) setClubs(data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchClubs() }, [fetchClubs])

  return (
    <>
      <div className="flex-1 overflow-y-auto space-y-3 py-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : clubs.length === 0 ? (
          <div className="text-center py-10 space-y-2 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm">尚無球團，請新增第一個球團</p>
          </div>
        ) : (
          clubs.map(club => (
            <div key={club.id} className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/30 transition-colors group">
              <button
                className="flex-1 text-left"
                onClick={() => setPinClub(club)}
              >
                <div className="font-semibold">🏸 {club.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">隊長：{club.leader_name}</div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSettingsClub(club) }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="pt-3 border-t">
        <Button variant="outline" className="w-full gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> 新增球團
        </Button>
      </div>

      <CreateClubDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchClubs} />
      <PinVerifyDialog club={pinClub} onOpenChange={(o) => !o && setPinClub(null)} onSuccess={(c) => { setPinClub(null); onEnterClub(c) }} />
      {settingsClub && (
        <ClubSettingsDialog
          club={settingsClub}
          open={!!settingsClub}
          onOpenChange={(o) => !o && setSettingsClub(null)}
          onUpdated={fetchClubs}
        />
      )}
    </>
  )
}

// ─── EventsView ───────────────────────────────────────────────────────────────

function EventsView({
  club, onViewEvent,
}: { club: Club; onViewEvent: (eventId: string) => void }) {
  const [events, setEvents] = useState<BadmintonEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events?club_id=${club.id}`)
      const data = await res.json()
      if (res.ok) setEvents(data)
    } finally { setLoading(false) }
  }, [club.id])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleDelete = async (e: React.MouseEvent, event: BadmintonEvent) => {
    e.stopPropagation()
    if (!confirm(`確定刪除 ${event.event_date} 的活動？`)) return
    setDeletingId(event.id)
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { showToast(data.error, 'error'); return }
      showToast('活動已刪除', 'success')
      fetchEvents()
    } finally { setDeletingId(null) }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto space-y-3 py-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-10 space-y-2 text-muted-foreground">
            <CalendarDays className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm">尚無活動紀錄</p>
          </div>
        ) : (
          events.map(ev => (
            <div
              key={ev.id}
              className="rounded-xl border p-4 hover:bg-muted/30 cursor-pointer transition-colors group space-y-2"
              onClick={() => onViewEvent(ev.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm">{ev.event_date}</div>
                  <div className="text-xs text-muted-foreground">{ev.venue_name || '未設定場地'}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {ev.is_settled && (
                    <span className="flex items-center gap-1 text-[11px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                      <BadgeCheck className="w-3 h-3" /> 已結算
                    </span>
                  )}
                  {!ev.is_settled && (
                    <button
                      onClick={(e) => handleDelete(e, ev)}
                      disabled={deletingId === ev.id}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {deletingId === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs pt-1 border-t border-border/50">
                <div className="text-center">
                  <div className="text-muted-foreground">場租</div>
                  <div className="font-medium">{fmtMoney(ev.venue_cost)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">球費</div>
                  <div className="font-medium">{fmtMoney(ev.shuttle_cost)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">收費</div>
                  <div className="font-medium">{fmtMoney(ev.total_revenue)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">利潤</div>
                  <div className={profitClass(ev.profit)}>{profitLabel(ev.profit)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-3 border-t">
        <Button variant="outline" className="w-full gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> 新增活動
        </Button>
      </div>

      <CreateEventDialog
        club={club}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchEvents}
      />
    </>
  )
}

// ─── EventTrackerDialog (Main Export) ─────────────────────────────────────────

export function EventTrackerDialog() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'clubs' | 'events'>('clubs')
  const [activeClub, setActiveClub] = useState<Club | null>(null)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleClose = () => {
    setOpen(false)
    setTimeout(() => { setView('clubs'); setActiveClub(null) }, 300)
  }

  const handleEnterClub = (club: Club) => {
    setActiveClub(club)
    setView('events')
  }

  const handleBack = () => {
    setView('clubs')
    setActiveClub(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true) }}>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors h-9"
        >
          <ClipboardList className="w-4 h-4" />
          <span className="hidden sm:inline">開團紀錄</span>
        </button>

        <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {view === 'events' && activeClub ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleBack}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  🏸 {activeClub.name}
                  <span className="text-xs font-normal text-muted-foreground ml-1">— {activeClub.leader_name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  開團紀錄
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {view === 'clubs' && (
            <ClubsView onEnterClub={handleEnterClub} />
          )}
          {view === 'events' && activeClub && (
            <EventsView
              club={activeClub}
              onViewEvent={(id) => { setDetailEventId(id); setDetailOpen(true) }}
            />
          )}
        </DialogContent>
      </Dialog>

      {detailEventId && (
        <EventDetailDialog
          eventId={detailEventId}
          open={detailOpen}
          onOpenChange={(o) => { setDetailOpen(o); if (!o) setDetailEventId(null) }}
        />
      )}
    </>
  )
}
