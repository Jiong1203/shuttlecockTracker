'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Settings,
  LogOut,
  Loader2,
} from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  external?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "首頁儀表板", icon: LayoutDashboard },
  { href: "/clubs", label: "開團紀錄", icon: ClipboardList },
  { href: "/manual", label: "使用手冊", icon: BookOpen, external: true },
]

export interface AppSidebarProps {
  group: { name: string; contactEmail: string } | null
  collapsed: boolean
  /** 導覽點擊後的 callback（手機版用來關閉抽屜） */
  onNavigate?: () => void
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

export function AppSidebar({ group, collapsed, onNavigate }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [loggingOut, setLoggingOut] = useState(false)
  const settingsActive = isActive(pathname, "/settings")

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push("/login")
    } catch (e) {
      console.error("Logout error:", e)
      setLoggingOut(false)
    }
  }

  return (
    <aside className="flex h-full flex-col bg-[#14211B] text-[#AEBBB2]">
      {/* Brand */}
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-[#223129] px-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#1E7A5A] to-[#155c43] text-base">
          🏸
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">羽球庫存管理</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#6E7A72]">ShuttleTracker</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          const cls = `mx-2.5 my-0.5 flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-colors ${
            collapsed ? "justify-center" : ""
          } ${
            active
              ? "bg-[#1E7A5A] font-medium text-white shadow-[0_2px_10px_rgba(30,122,90,0.35)]"
              : "hover:bg-[#1E2E27] hover:text-white"
          }`
          const inner = (
            <>
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            </>
          )

          return item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cls}
              title={collapsed ? item.label : undefined}
              onClick={onNavigate}
            >
              {inner}
            </a>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={cls}
              title={collapsed ? item.label : undefined}
              onClick={onNavigate}
            >
              {inner}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#223129] p-3">
        {!collapsed && group?.name && (
          <div className="mb-2 flex items-center gap-2 px-1.5">
            <span className="rounded-md bg-[#1E2E27] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#8fd3b6]">
              球團
            </span>
            <span className="truncate text-xs font-medium text-[#cfe0d7]">{group.name}</span>
          </div>
        )}
        <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
          <Link
            href="/settings"
            onClick={onNavigate}
            className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${
              settingsActive
                ? "bg-[#1E7A5A] text-white"
                : "text-[#AEBBB2] hover:bg-[#1E2E27] hover:text-white"
            }`}
            aria-label="帳號設定"
            title="帳號設定"
          >
            <Settings className="h-[18px] w-[18px]" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="grid h-9 w-9 place-items-center rounded-lg text-[#AEBBB2] transition-colors hover:bg-[#3a1e1e] hover:text-red-300 disabled:opacity-60"
            aria-label="登出"
            title="登出"
          >
            {loggingOut ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <LogOut className="h-[18px] w-[18px]" />}
          </button>

          <div className="[&_button]:rounded-lg [&_button]:text-[#AEBBB2] [&_button:hover]:!bg-[#1E2E27] [&_button:hover]:!text-white">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  )
}
