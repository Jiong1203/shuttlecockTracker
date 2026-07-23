'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { Menu, PanelLeftClose, PanelLeft, RefreshCw } from "lucide-react"

interface AppShellProps {
  group: { name: string; contactEmail: string } | null
  children: React.ReactNode
}

interface Crumb {
  label: string
  href?: string
}

function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === "/") return [{ label: "首頁儀表板" }]
  if (pathname === "/settings") return [{ label: "帳號設定" }]
  if (pathname === "/clubs") return [{ label: "開團紀錄" }]
  if (pathname.startsWith("/clubs/")) {
    return [{ label: "開團紀錄", href: "/clubs" }, { label: "球隊詳情" }]
  }
  return [{ label: "首頁" }]
}

export function AppShell({ group, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // 讀取上次收合偏好（避免 SSR 不一致，掛載後再套用）
  useEffect(() => {
    setMounted(true)
    try {
      if (localStorage.getItem("sidebar-collapsed") === "1") setCollapsed(true)
    } catch {}
  }, [])

  // 換頁時關閉手機抽屜
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem("sidebar-collapsed", next ? "1" : "0")
      } catch {}
      return next
    })
  }

  const crumbs = buildCrumbs(pathname)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 桌面側邊欄 */}
      <div
        className={`hidden shrink-0 md:block ${mounted ? "transition-[width] duration-200" : ""} ${
          collapsed ? "w-[68px]" : "w-64"
        }`}
      >
        <AppSidebar group={group} collapsed={collapsed} />
      </div>

      {/* 手機抽屜 */}
      <div className={`md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setMobileOpen(false)}
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 shadow-xl transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <AppSidebar group={group} collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* 內容欄 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 頂部列 */}
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          {/* 手機漢堡 */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label="開啟選單"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* 桌面收合 */}
          <button
            type="button"
            onClick={toggleCollapse}
            className="hidden h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:grid"
            aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          {/* 麵包屑 */}
          <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="麵包屑">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-2 min-w-0">
                {i > 0 && <span className="text-muted-foreground/50">/</span>}
                {c.href ? (
                  <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-foreground">{c.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="flex-1" />

          {/* 重新整理 */}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="重新整理"
            title="重新整理"
          >
            <RefreshCw className="h-[18px] w-[18px]" />
          </button>
        </header>

        {/* 主內容（自身捲動） */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
