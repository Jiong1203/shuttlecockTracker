import { Loader2 } from "lucide-react"

/**
 * 路由切換時的即時載入畫面（Suspense fallback）。
 * server 元件在抓資料時，先顯示這個，避免畫面「卡在舊頁」而感覺延遲。
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <span className="text-sm">載入中…</span>
    </div>
  )
}
