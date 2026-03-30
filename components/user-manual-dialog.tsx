'use client'

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { showToast } from "@/components/ui/toast"

export function UserManualDialog() {
  const [content, setContent] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const loadManual = async () => {
    if (content) return
    setLoading(true)
    try {
      const res = await fetch("/api/manual")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      setContent(text)
    } catch {
      showToast("使用手冊載入失敗，請稍後再試", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (open) loadManual() }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground hover:bg-muted gap-2 transition-all px-2 md:px-3"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden md:inline">使用手冊</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4" />
            使用手冊
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              載入中...
            </div>
          ) : content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h1:text-xl prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b
              prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
              prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2
              prose-p:text-sm prose-p:leading-relaxed prose-p:my-1.5
              prose-li:text-sm prose-li:my-0.5
              prose-table:text-sm prose-th:text-left prose-th:font-semibold
              prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-muted prose-pre:text-xs prose-pre:p-3 prose-pre:rounded-lg
              prose-blockquote:text-muted-foreground prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:text-xs
              prose-a:text-blue-600 dark:prose-a:text-blue-400
              prose-hr:border-border prose-hr:my-4">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              無法載入使用手冊
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
