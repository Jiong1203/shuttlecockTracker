'use client'

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { GroupSettingsDialog } from "@/components/group-settings-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { LogOut } from "lucide-react"
import dynamic from "next/dynamic"

const ToastContainer = dynamic(() => import("@/components/ui/toast").then(mod => ({ default: mod.ToastContainer })), {
  ssr: false
})

interface HomeClientProps {
  groupName: string
}

export default function HomeClient({ groupName }: HomeClientProps) {
  const [group, setGroup] = useState<{ name: string } | null>(groupName ? { name: groupName } : null)
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-xl border border-border/50">
        <ThemeToggle />
        <GroupSettingsDialog 
          currentGroupName={group?.name || ""} 
          onUpdateSuccess={(newName) => {
            if (newName) {
              setGroup(prev => prev ? { ...prev, name: newName } : null)
            }
            window.location.reload()
          }} 
        />
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLogout}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 transition-all px-2 md:px-3"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">登出系統</span>
        </Button>
      </div>
      <ToastContainer />
    </>
  )
}
