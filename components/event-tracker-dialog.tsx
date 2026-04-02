'use client'

import Link from "next/link"
import { ClipboardList } from "lucide-react"

export function EventTrackerDialog() {
  return (
    <Link
      href="/clubs"
      className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors h-9"
    >
      <ClipboardList className="w-4 h-4" />
      <span className="hidden sm:inline">開團紀錄</span>
    </Link>
  )
}
