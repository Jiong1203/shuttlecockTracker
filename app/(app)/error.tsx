'use client'

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

// 路由層的錯誤邊界。沒有這個檔案時，未捕捉的例外會落到 Next.js 的英文預設頁，
// 與整個介面的語境脫節，而且沒有回首頁的路。
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] 未預期的錯誤：', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <span className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-500 mb-5">
        <AlertTriangle className="w-7 h-7" />
      </span>

      <h1 className="text-xl font-black text-foreground mb-2">這個頁面沒能載入</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-1">
        資料沒有受到影響。重新載入通常就能解決；若持續發生，請截圖回報。
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/70 font-mono mb-6">
          錯誤代碼 {error.digest}
        </p>
      )}
      {!error.digest && <div className="mb-6" />}

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset} className="gap-2">
          <RotateCw className="w-4 h-4" /> 重新載入
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/">
            <Home className="w-4 h-4" /> 回首頁儀表板
          </Link>
        </Button>
      </div>
    </div>
  )
}
