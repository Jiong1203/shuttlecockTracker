'use client'

import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings, ShieldCheck, KeyRound, Type, Loader2, Mail } from "lucide-react"

interface GroupSettingsDialogProps {
  currentGroupName: string
  onUpdateSuccess: (newName?: string) => void
}

export function GroupSettingsDialog({ currentGroupName, onUpdateSuccess }: GroupSettingsDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  
  // States for form
  const [newName, setNewName] = useState(currentGroupName)
  const [contactEmail, setContactEmail] = useState("")
  const [newLoginPassword, setNewLoginPassword] = useState("")
  const [currentRestockPassword, setCurrentRestockPassword] = useState("")
  const [newRestockPassword, setNewRestockPassword] = useState("")
  const [hasRestockPassword, setHasRestockPassword] = useState(false)
  const [restockStep, setRestockStep] = useState<'info' | 'verify' | 'update'>('info')

  // Fetch current detailed settings when opening
  useEffect(() => {
    if (open) {
      fetchSettings()
      // 如果 props 已經更新了，就先用 props 的
      setNewName(currentGroupName)
      setContactEmail("")
      setNewLoginPassword("")
      setCurrentRestockPassword("")
      setNewRestockPassword("")
      setRestockStep('info')
    }
  }, [open, currentGroupName])

  const fetchSettings = async () => {
    setIsLoadingSettings(true)
    try {
      const res = await fetch('/api/group')
      const data = await res.json()
      if (data.name) setNewName(data.name)
      if (data.contactEmail) setContactEmail(data.contactEmail)
      setHasRestockPassword(data.hasRestockPassword)
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleUpdateGroupName = async () => {
    if (!newName || newName === currentGroupName) return
    setLoading(true)
    try {
      const res = await fetch('/api/group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      if (!res.ok) throw new Error('更新失敗')
      alert('球團名稱更新成功')
      onUpdateSuccess(newName)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新失敗'
      alert(message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleUpdateContactEmail = async () => {
    // 簡單的 Email 格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (contactEmail && !emailRegex.test(contactEmail)) {
      alert('請輸入有效的電子信箱格式')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactEmail })
      })
      if (!res.ok) throw new Error('更新失敗')
      alert('聯絡信箱更新成功')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新失敗'
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateLoginPassword = async () => {
    if (!newLoginPassword || newLoginPassword.length < 6) {
      alert('新密碼長度至少需要 6 個字元')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newLoginPassword })
      })
      if (!res.ok) throw new Error('更新失敗')
      alert('登入密碼更新成功')
      setNewLoginPassword("")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新失敗'
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCurrentPassword = async () => {
    if (!currentRestockPassword) {
      alert('請輸入原密碼')
      return
    }
    setLoading(true)
    try {
      // 這裡我們稍微利用一下 PATCH API 來做驗證，但不更動資料
      // 或者我們可以相信使用者輸入，等最後 PATCH 再失敗也行。
      // 但為了立即回饋，我們試著傳送一個「不更新」但帶有密碼的請求
      const res = await fetch('/api/group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentRestockPassword: currentRestockPassword,
          // 這裡不傳 restockPassword，API 就不會嘗試更新
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '驗證失敗')
      
      setRestockStep('update')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '驗證失敗'
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRestockPassword = async (isDisable = false) => {
    const passwordToSet = isDisable ? "" : newRestockPassword
    if (!isDisable && !passwordToSet) {
      alert('請輸入「新」入庫密碼')
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch('/api/group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          restockPassword: passwordToSet,
          currentRestockPassword: currentRestockPassword
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '操作失敗')

      alert(isDisable ? '入庫密碼已取消' : '入庫密碼設定成功')
      setNewRestockPassword("")
      setCurrentRestockPassword("")
      setRestockStep('info')
      fetchSettings()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '操作失敗'
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 px-2 sm:px-3">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">帳號設定</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            <span className="dark:text-white">球團帳號設定</span>
          </DialogTitle>
          <DialogDescription>
            在此管理您的球團名稱、共享密碼及安全設定。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Group Name Section */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2 text-foreground font-bold">
              <Type className="w-4 h-4" /> 球團名稱
            </Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleUpdateGroupName} 
                disabled={loading || isLoadingSettings || newName === currentGroupName}
                size="sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "更新"}
              </Button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Login Password Section */}
          <div className="space-y-2">
            <Label htmlFor="login-pass" className="flex items-center gap-2 text-foreground font-bold">
              <KeyRound className="w-4 h-4" /> 變更共享密碼 (系統登入用)
            </Label>
            <div className="flex gap-2">
              <Input
                id="login-pass"
                type="password"
                placeholder="輸入新密碼"
                value={newLoginPassword}
                onChange={(e) => setNewLoginPassword(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleUpdateLoginPassword} 
                disabled={loading || !newLoginPassword}
                variant="secondary"
                size="sm"
              >
                更新
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">更新後，所有共用此帳號的成員皆需使用新密碼登入。</p>
          </div>

          <hr className="border-slate-100" />

          {/* Contact Email Section */}
          <div className="space-y-2">
            <Label htmlFor="contact-email" className="flex items-center gap-2 text-foreground font-bold">
              <Mail className="w-4 h-4" /> 聯絡信箱
            </Label>
            <div className="flex gap-2">
              <Input
                id="contact-email"
                type="email"
                placeholder="例如：abc@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleUpdateContactEmail} 
                disabled={loading || !contactEmail}
                variant="secondary"
                size="sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "更新"}
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">供未來開發相關通知或管理功能使用。</p>
          </div>

          <hr className="border-slate-100" />

          {/* Restock Password Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-foreground font-bold">
              <ShieldCheck className="w-4 h-4" /> 入庫管理密碼
            </Label>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-border min-h-[100px] flex flex-col justify-center">
              {restockStep === 'info' ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {hasRestockPassword ? (
                      <span className="text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/50">已啟用自訂密碼防護</span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">目前使用系統預設碼 (1111)</span>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setRestockStep('verify')}
                    className="w-full bg-white"
                  >
                    修改入庫密碼
                  </Button>
                </div>
              ) : restockStep === 'verify' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">
                      階段 1：驗證原入庫密碼 {!hasRestockPassword && "(預設為 1111)"}
                    </p>
                    <Input
                      id="current-restock-pass"
                      type="password"
                      placeholder="請輸入原密碼"
                      value={currentRestockPassword}
                      onChange={(e) => setCurrentRestockPassword(e.target.value)}
                      className="bg-white h-9"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setRestockStep('info')}
                      className="flex-1 h-9"
                    >
                      取消
                    </Button>
                    <Button 
                      onClick={handleVerifyCurrentPassword} 
                      disabled={loading || !currentRestockPassword}
                      className="flex-1 h-9 bg-slate-800"
                    >
                      {loading ? "驗證中..." : "下一步"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-emerald-600 font-bold ml-1">階段 2：設定新入庫密碼</p>
                    <Input
                      id="new-restock-pass"
                      type="password"
                      placeholder="請輸入新密碼"
                      value={newRestockPassword}
                      onChange={(e) => setNewRestockPassword(e.target.value)}
                      className="bg-white h-9"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    {hasRestockPassword && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-700 px-0"
                        onClick={() => handleUpdateRestockPassword(true)}
                        disabled={loading}
                      >
                        停用自訂密碼
                      </Button>
                    )}
                    <div className="flex-1" />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setRestockStep('info')}
                      disabled={loading}
                      className="h-9"
                    >
                      取消
                    </Button>
                    <Button 
                      onClick={() => handleUpdateRestockPassword(false)} 
                      disabled={loading || !newRestockPassword}
                      className="h-9 bg-emerald-600 hover:bg-emerald-700"
                    >
                      儲存設定
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">入庫登記為敏感操作，建議設定專屬密碼與球團成員共享。</p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="ghost" className="w-full">
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
