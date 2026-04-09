'use client'

import Link from "next/link"
import { ClipboardList } from "lucide-react"

export function EventTrackerDialog() {
  return (
    <Link
      href="/clubs"
      className="inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <ClipboardList className="w-4 h-4" />
    </Link>
  )
}
