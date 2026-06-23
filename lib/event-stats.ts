// 開團活動的彙總統計（純函式，無副作用）。
// A5 的合計列與 stat strip 使用；B2 趨勢圖未來可在此擴充 groupByMonth 等分桶函式共用。

export interface EventForStats {
  venue_cost: number
  shuttle_cost: number
  shuttle_count: number | null
  total_revenue: number
  profit: number
  attendee_count: number
  is_settled: boolean
}

export interface EventAggregates {
  count: number
  settledCount: number
  totalVenueCost: number
  totalShuttleCost: number
  totalShuttleCount: number
  totalRevenue: number
  totalProfit: number
  avgProfit: number      // 每場平均利潤
  avgAttendance: number  // 每場平均出席人數
}

export function computeEventStats(events: EventForStats[]): EventAggregates {
  const count = events.length
  const acc = events.reduce(
    (a, e) => {
      a.totalVenueCost += Number(e.venue_cost) || 0
      a.totalShuttleCost += Number(e.shuttle_cost) || 0
      a.totalShuttleCount += e.shuttle_count ?? 0
      a.totalRevenue += Number(e.total_revenue) || 0
      a.totalProfit += Number(e.profit) || 0
      a.totalAttendance += e.attendee_count ?? 0
      if (e.is_settled) a.settledCount += 1
      return a
    },
    {
      totalVenueCost: 0, totalShuttleCost: 0, totalShuttleCount: 0,
      totalRevenue: 0, totalProfit: 0, totalAttendance: 0, settledCount: 0,
    }
  )

  return {
    count,
    settledCount: acc.settledCount,
    totalVenueCost: acc.totalVenueCost,
    totalShuttleCost: acc.totalShuttleCost,
    totalShuttleCount: acc.totalShuttleCount,
    totalRevenue: acc.totalRevenue,
    totalProfit: acc.totalProfit,
    avgProfit: count ? acc.totalProfit / count : 0,
    avgAttendance: count ? acc.totalAttendance / count : 0,
  }
}

// ─── 趨勢分桶（B2 趨勢圖使用）────────────────────────────────────────────────

export interface MonthlyPoint {
  month: string  // 'YYYY-MM'
  label: string  // 'YYYY/MM'
  value: number
}

// 將活動依 event_date（'YYYY-MM-DD'）按月分桶並加總 accessor 取出的數值，依月份升冪排序。
export function groupByMonth<T extends { event_date: string }>(
  events: T[],
  value: (e: T) => number
): MonthlyPoint[] {
  const map = new Map<string, number>()
  for (const e of events) {
    const month = e.event_date.slice(0, 7)  // 'YYYY-MM'
    map.set(month, (map.get(month) ?? 0) + (value(e) || 0))
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, label: `${month.slice(0, 4)}/${month.slice(5, 7)}`, value: v }))
}
