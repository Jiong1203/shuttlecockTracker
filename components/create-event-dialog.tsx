'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { showToast } from "@/components/ui/toast"
import { parseLineMessage } from "@/lib/line-parser"
import { CalendarDays, ClipboardList, Loader2, Plus, Sparkles } from "lucide-react"

interface ParsedName { name: string; included: boolean; fee: number; isFree: boolean }


export function CreateEventDialog({
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
    // 優先採用訊息解析到的費用，否則沿用使用者輸入的預設費用
    const fee = result.fee ?? (parseFloat(defaultFee) || 0)
    if (result.fee != null) setDefaultFee(String(result.fee))
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

      // 一次批次寫入；API 會逐筆遞增 created_at，維持與 LINE 訊息一致的出席順序
      const toAdd = parsedNames.filter(p => p.included)
      if (toAdd.length > 0) {
        const attRes = await fetch(`/api/events/${eventData.id}/attendees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendees: toAdd.map(p => ({ displayName: p.name, fee: p.fee, isFree: p.isFree, paid: false })),
          }),
        })
        if (!attRes.ok) {
          // 活動本身已建立，只有名單失敗——講清楚現況，別讓使用者以為整場都沒建
          const attErr = await attRes.json().catch(() => ({}))
          showToast(`活動已建立，但出席名單寫入失敗：${attErr.error || '請稍後於活動詳情手動補上'}`, 'error')
          onOpenChange(false); reset(); onCreated()
          return
        }
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
              正在建立活動{parsedNames.filter(p => p.included).length > 0 ? `（含 ${parsedNames.filter(p => p.included).length} 位出席者）` : ''}，請稍候…
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
