'use client'

import type { MonthlyPoint } from "@/lib/event-stats"

interface EventTrendChartProps {
  title: string
  data: MonthlyPoint[]
  format?: (v: number) => string
  barClass?: string
}

// 純 CSS 水平長條圖（零依賴）。以絕對值決定長度，負值（虧損）的數字仍依 format 顯示。
export function EventTrendChart({
  title,
  data,
  format = v => v.toLocaleString(),
  barClass = 'bg-blue-500',
}: EventTrendChartProps) {
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1)

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="text-xs font-semibold text-muted-foreground">{title}</div>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">尚無資料</p>
      ) : (
        <div className="space-y-2">
          {data.map(d => (
            <div key={d.month} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{d.label}</span>
              <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barClass} transition-all duration-300`}
                  style={{ width: `${Math.max((Math.abs(d.value) / max) * 100, 2)}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{format(d.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
