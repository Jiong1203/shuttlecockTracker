'use client'

import { useState, useEffect, useCallback, use } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToastContainer, showToast } from "@/components/ui/toast"
import { EventDetailDialog } from "@/components/event-detail-dialog"
import { computeEventStats, groupByMonth } from "@/lib/event-stats"
import { EventTrendChart } from "@/components/event-trend-chart"
import { CreateEventDialog } from "@/components/create-event-dialog"
import { ClubPinGate } from "@/components/club-pin-gate"
import { fmtMoney, profitLabel, profitClass as baseProfitClass } from "@/lib/format"
import {
  Plus, Loader2, CalendarDays,
  BadgeCheck, Trash2, ClipboardList, ChevronDown, X, Wallet, Info,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Club { id: string; name: string; leader_name: string }

interface BadmintonEvent {
  id: string; event_date: string; venue_name: string | null
  court_count: number; hours: number; hourly_rate: number
  shuttle_cost_mode: 'auto' | 'manual'; shuttle_cost: number
  shuttle_count: number | null
  is_settled: boolean; notes: string | null
  venue_cost: number
  total_due: number; total_paid: number; total_unpaid: number
  unpaid_count: number; payer_count: number
  profit: number; profit_paid: number
  attendee_count: number
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

// 本頁的損益一律粗體，故在共用樣式上再加字重
const profitClass = (p: number) => `${baseProfitClass(p)} font-bold`

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
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [settledFilter, setSettledFilter] = useState<'all' | 'unsettled' | 'settled'>('all')
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)

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
      const qs = new URLSearchParams({ club_id: clubId })
      if (startDate) qs.set('start', startDate)
      if (endDate) qs.set('end', endDate)
      const res = await fetch(`/api/events?${qs.toString()}`)
      const data = await res.json()
      if (res.ok) setEvents(data)
    } finally { setLoadingEvents(false) }
  }, [clubId, startDate, endDate])

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

  const handleSettle = async (ev: BadmintonEvent) => {
    if (!confirm(`確定將 ${ev.event_date} 的活動標記為已結算？\n結算後將無法修改出席名單、球費，也無法刪除此活動。`)) return
    setSettlingId(ev.id)
    try {
      const res = await fetch(`/api/events/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSettled: true }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error, 'error'); return }
      showToast('活動已標記為結算', 'success')
      fetchEvents()
    } finally { setSettlingId(null) }
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
        <ClubPinGate clubId={clubId} clubName={club?.name ?? '球隊'} onVerified={() => setVerified(true)} />
        <ToastContainer />
      </>
    )
  }

  // Profit summary
  // 結算狀態為前端篩選（API 未提供此參數，且資料已載入）；日期篩選則在後端完成
  const visibleEvents = settledFilter === 'all'
    ? events
    : events.filter(e => (settledFilter === 'settled' ? e.is_settled : !e.is_settled))

  // 彙總統計（建立在目前顯示的 events 上，日期與狀態篩選會自動跟隨）
  const stats = computeEventStats(visibleEvents)

  // 彙總卡設定；具 chart 者可點擊展開每月趨勢圖（B2）
  const statCards: {
    key: string
    label: string
    value: string
    className?: string
    chart?: { title: string; accessor: (e: BadmintonEvent) => number; format: (v: number) => string; barClass: string }
  }[] = [
    { key: 'shuttle', label: '累計用球', value: `${stats.totalShuttleCount.toLocaleString()} 顆`,
      chart: { title: '每月用球量（顆）', accessor: e => e.shuttle_count ?? 0, format: v => `${v.toLocaleString()} 顆`, barClass: 'bg-sky-500' } },
    { key: 'shuttleCost', label: '累計球費', value: fmtMoney(stats.totalShuttleCost),
      chart: { title: '每月球費', accessor: e => Number(e.shuttle_cost) || 0, format: fmtMoney, barClass: 'bg-amber-500' } },
    { key: 'revenue', label: '累計應收', value: fmtMoney(stats.totalDue),
      chart: { title: '每月應收', accessor: e => Number(e.total_due) || 0, format: fmtMoney, barClass: 'bg-emerald-500' } },
    { key: 'unpaid', label: '待收款', value: fmtMoney(stats.totalUnpaid),
      className: stats.totalUnpaid > 0 ? 'text-amber-600 dark:text-amber-500' : undefined,
      chart: { title: '每月待收款', accessor: e => Number(e.total_unpaid) || 0, format: fmtMoney, barClass: 'bg-amber-500' } },
    { key: 'profit', label: '累計利潤', value: profitLabel(stats.totalProfit), className: profitClass(stats.totalProfit),
      chart: { title: '每月利潤', accessor: e => Number(e.profit) || 0, format: profitLabel, barClass: 'bg-blue-500' } },
    { key: 'avgProfit', label: '平均每場利潤', value: profitLabel(stats.avgProfit), className: profitClass(stats.avgProfit) },
    { key: 'avgAtt', label: '平均出席', value: `${stats.avgAttendance.toFixed(1)} 人` },
  ]

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border/60 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>🏸 {club?.name}</span>
              {club?.leader_name && (
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline">— {club.leader_name}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {/* Title + Action row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-xl font-black">活動紀錄</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              共 {stats.count} 場 · {stats.settledCount} 場已結算
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> 新增活動
          </Button>
        </div>

        {/* 結算規則說明 — 可折疊，避免佔用版面 */}
        <details open className="group/rules rounded-xl border border-border bg-muted/30 overflow-hidden">
          <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none text-sm font-semibold text-foreground list-none hover:bg-muted/50 transition-colors">
            <Info className="w-4 h-4 shrink-0 text-muted-foreground" />
            結算規則說明
            <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground transition-transform group-open/rules:rotate-180" />
          </summary>
          <ul className="px-4 pb-3.5 pt-3 space-y-1.5 text-xs text-muted-foreground leading-relaxed border-t border-border/60">
            <li className="flex gap-2"><BadgeCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-600 dark:text-green-500" /><span>結算代表本場帳目已確認完成，狀態欄會顯示綠色 ✓ 已結算標記。</span></li>
            <li className="flex gap-2"><span className="shrink-0 text-muted-foreground/50">•</span><span>結算前請先確認<span className="font-semibold text-foreground">場租、用球數、球費、出席名單與收費</span>皆填寫正確。</span></li>
            <li className="flex gap-2"><span className="shrink-0 text-muted-foreground/50">•</span><span>結算後此活動將<span className="font-semibold text-foreground">鎖定</span>：無法再新增／修改出席名單與球費，也<span className="font-semibold text-foreground">無法刪除</span>。</span></li>
            <li className="flex gap-2"><span className="shrink-0 text-muted-foreground/50">•</span><span>結算為不可逆操作，請於各欄位確認無誤後，再按下該列的「結算」按鈕。</span></li>
          </ul>
        </details>

        {/* Date filter — 篩選後彙總、合計與趨勢圖皆自動跟隨 */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-auto text-xs" aria-label="開始日期" />
          <span className="text-muted-foreground">~</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-auto text-xs" aria-label="結束日期" />
          <div className="flex items-center rounded-md border border-input overflow-hidden">
            {([
              { v: 'all', label: '全部' },
              { v: 'unsettled', label: '未結算' },
              { v: 'settled', label: '已結算' },
            ] as const).map(o => (
              <button
                key={o.v}
                onClick={() => setSettledFilter(o.v)}
                className={`px-2.5 py-1.5 text-xs transition-colors ${
                  settledFilter === o.v
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {(startDate || endDate || settledFilter !== 'all') && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setSettledFilter('all') }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5"
            >
              <X className="w-3 h-3" /> 清除
            </button>
          )}
        </div>

        {/* Summary stat strip + 趨勢圖（點擊卡片展開每月趨勢） */}
        {visibleEvents.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {statCards.map(c => {
                const clickable = !!c.chart
                const active = expandedMetric === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && setExpandedMetric(active ? null : c.key)}
                    className={`rounded-lg border px-3 py-2 text-center sm:text-left transition-colors ${
                      clickable ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default'
                    } ${active ? 'border-blue-400 dark:border-blue-600 bg-muted/60 ring-1 ring-blue-400/40' : 'bg-muted/30'}`}
                  >
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-center sm:justify-start">
                      {c.label}
                      {clickable && <ChevronDown className={`w-3 h-3 transition-transform ${active ? 'rotate-180' : ''}`} />}
                    </div>
                    <div className={`text-sm font-black mt-0.5 ${c.className ?? 'text-foreground'}`}>{c.value}</div>
                  </button>
                )
              })}
            </div>
            {expandedMetric && (() => {
              const c = statCards.find(x => x.key === expandedMetric)
              return c?.chart ? (
                <EventTrendChart
                  title={c.chart.title}
                  data={groupByMonth(events, c.chart.accessor)}
                  format={c.chart.format}
                  barClass={c.chart.barClass}
                />
              ) : null
            })()}
          </div>
        )}

        {/* 結算摘要 — mobile only；桌機的合計列在手機看不到，這裡補上結算導向的金額總結（含場租） */}
        {visibleEvents.length > 0 && (
          <div className="md:hidden rounded-xl border border-blue-400/40 dark:border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-blue-500/[0.04] to-purple-500/10 px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                <Wallet className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm font-bold">結算摘要</span>
              <span className="text-xs text-muted-foreground">· 共 {stats.count} 場</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2.5">
              {[
                { label: '場租', value: fmtMoney(stats.totalVenueCost) },
                { label: '球費', value: fmtMoney(stats.totalShuttleCost) },
                { label: '應收', value: fmtMoney(stats.totalDue) },
              ].map(item => (
                <div key={item.label} className="rounded-lg bg-background/70 px-2.5 py-2">
                  <div className="text-[11px] text-muted-foreground">{item.label}</div>
                  <div className="text-sm font-bold mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-background/80 border border-border/50 px-3 py-2.5">
              <span className="text-xs font-semibold text-muted-foreground">累計利潤</span>
              <span className={`text-lg font-black ${profitClass(stats.totalProfit)}`}>{profitLabel(stats.totalProfit)}</span>
            </div>
            {stats.totalUnpaid > 0 && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-500 text-center">
                利潤以應收計；尚有 {stats.totalUnpaidCount} 人次未繳，共 {fmtMoney(stats.totalUnpaid)}
              </p>
            )}
          </div>
        )}

        {/* Events Table */}
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          {/* Table Header — desktop only */}
          <div className="hidden md:grid grid-cols-[120px_1fr_90px_72px_90px_90px_100px_80px_120px] gap-3 px-5 py-3 bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>日期</span>
            <span>場地</span>
            <span className="text-right">場租</span>
            <span className="text-right">用球數</span>
            <span className="text-right">球費</span>
            <span className="text-right">應收</span>
            <span className="text-right">利潤</span>
            <span className="text-center">狀態</span>
            <span className="text-center">操作</span>
          </div>

          {loadingEvents ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-muted-foreground">
              <CalendarDays className="w-12 h-12 opacity-20" />
              <p className="text-sm">
                {startDate || endDate || settledFilter !== 'all'
                  ? '沒有符合篩選條件的活動，試試調整或清除篩選'
                  : '尚無活動紀錄，點擊「新增活動」開始記錄'}
              </p>
            </div>
          ) : (
            visibleEvents.map((ev, i) => (
              <div
                key={ev.id}
                onClick={() => { setDetailEventId(ev.id); setDetailOpen(true) }}
                className={`px-5 hover:bg-muted/20 cursor-pointer transition-colors group ${i < visibleEvents.length - 1 ? 'border-b border-border/60' : ''}`}
              >
                {/* Mobile layout */}
                <div className="flex items-center gap-3 py-3.5 md:hidden">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">{ev.event_date}</span>
                      {ev.is_settled && <BadgeCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {ev.venue_name || '未設定場地'}
                      {ev.shuttle_count != null && <span className="opacity-80"> · 用球 {ev.shuttle_count.toLocaleString()} 顆</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-bold ${profitClass(ev.profit)}`}>{profitLabel(ev.profit)}</span>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {!ev.is_settled && (
                        <>
                          <button
                            onClick={() => handleSettle(ev)}
                            disabled={settlingId === ev.id}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-green-600 dark:text-green-400 border border-green-500/40 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors disabled:opacity-50"
                          >
                            {settlingId === ev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BadgeCheck className="w-3 h-3" />}
                            結算
                          </button>
                          <button
                            onClick={() => handleDelete(ev)}
                            disabled={deletingId === ev.id}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          >
                            {deletingId === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {/* Desktop layout */}
                <div className="hidden md:grid grid-cols-[120px_1fr_90px_72px_90px_90px_100px_80px_120px] gap-3 py-4 items-center">
                  <div className="font-semibold text-sm">{ev.event_date}</div>
                  <div className="text-sm text-muted-foreground truncate">{ev.venue_name || '—'}</div>
                  <div className="text-sm text-right">{fmtMoney(ev.venue_cost)}</div>
                  <div className="text-sm text-right">{ev.shuttle_count != null ? `${ev.shuttle_count.toLocaleString()} 顆` : '—'}</div>
                  <div className="text-sm text-right">{fmtMoney(ev.shuttle_cost)}</div>
                  <div className="text-sm text-right">
                    {fmtMoney(ev.total_due)}
                    {ev.unpaid_count > 0 && (
                      <span className="block text-[10px] text-amber-600 dark:text-amber-500 font-medium">
                        {ev.unpaid_count} 人未繳
                      </span>
                    )}
                  </div>
                  <div className={`text-sm text-right ${profitClass(ev.profit)}`}>{profitLabel(ev.profit)}</div>
                  <div className="flex justify-center">
                    {ev.is_settled ? (
                      <BadgeCheck className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />
                    )}
                  </div>
                  <div className="flex justify-center items-center gap-1" onClick={e => e.stopPropagation()}>
                    {ev.is_settled ? (
                      <span className="text-xs text-muted-foreground">已結算</span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleSettle(ev)}
                          disabled={settlingId === ev.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-green-600 dark:text-green-400 border border-green-500/40 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors disabled:opacity-50"
                        >
                          {settlingId === ev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BadgeCheck className="w-3 h-3" />}
                          結算
                        </button>
                        <button
                          onClick={() => handleDelete(ev)}
                          disabled={deletingId === ev.id}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        >
                          {deletingId === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* 合計列 — desktop only，對齊表頭欄位 */}
          {visibleEvents.length > 0 && (
            <div className="hidden md:grid grid-cols-[120px_1fr_90px_72px_90px_90px_100px_80px_120px] gap-3 px-5 py-3.5 border-t-2 border-border bg-muted/40 items-center text-sm font-bold">
              <div>合計</div>
              <div></div>
              <div className="text-right">{fmtMoney(stats.totalVenueCost)}</div>
              <div className="text-right">{stats.totalShuttleCount.toLocaleString()} 顆</div>
              <div className="text-right">{fmtMoney(stats.totalShuttleCost)}</div>
              <div className="text-right">
                {fmtMoney(stats.totalDue)}
                {stats.totalUnpaid > 0 && (
                  <span className="block text-[10px] font-medium text-amber-600 dark:text-amber-500">
                    未收 {fmtMoney(stats.totalUnpaid)}
                  </span>
                )}
              </div>
              <div className={`text-right ${profitClass(stats.totalProfit)}`}>{profitLabel(stats.totalProfit)}</div>
              <div></div>
              <div></div>
            </div>
          )}
        </div>

        {visibleEvents.length > 0 && (
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
