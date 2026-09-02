import Link from "next/link"
import { Compass, Home, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"

// 找不到頁面時的落點。最常見的情境是點到已刪除的球隊或活動連結。
export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <span className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 mb-5">
        <Compass className="w-7 h-7" />
      </span>

      <h1 className="text-xl font-black text-foreground mb-2">找不到這個頁面</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        網址可能有誤，或這筆球隊、活動紀錄已經被刪除了。
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild className="gap-2">
          <Link href="/">
            <Home className="w-4 h-4" /> 回首頁儀表板
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/clubs">
            <ClipboardList className="w-4 h-4" /> 開團紀錄
          </Link>
        </Button>
      </div>
    </div>
  )
}
