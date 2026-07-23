'use client'

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Settings, ShieldCheck } from "lucide-react"
import { GroupSettingsForm } from "@/components/group-settings-form"

interface GroupSettingsDialogProps {
  currentGroupName: string
  initialContactEmail?: string
  onUpdateSuccess: (newName?: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * 帳號設定彈窗（薄殼）：實際表單內容由 GroupSettingsForm 提供，與 /settings 頁面共用同一份邏輯。
 */
export function GroupSettingsDialog({
  currentGroupName,
  initialContactEmail = "",
  onUpdateSuccess,
  open: controlledOpen,
  onOpenChange,
}: GroupSettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (value: boolean) => {
    setInternalOpen(value)
    onOpenChange?.(value)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            <span className="dark:text-white">球團帳號設定</span>
          </DialogTitle>
          <DialogDescription>在此管理您的球團名稱、共享密碼及安全設定。</DialogDescription>
        </DialogHeader>

        {/* 開窗時才掛載 → 每次開啟都重新抓取最新設定 */}
        {open && (
          <div className="flex-1 overflow-y-auto px-1 py-4">
            <GroupSettingsForm
              initialGroupName={currentGroupName}
              initialContactEmail={initialContactEmail}
              onGroupNameChange={(newName) => onUpdateSuccess(newName)}
            />
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="ghost" className="w-full">
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
