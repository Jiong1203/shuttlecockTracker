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
import { Settings, ShieldCheck, KeyRound, Type, Loader2, Mail, AlertTriangle, MessageCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// 官方帳號 Basic ID（供使用者手動搜尋加好友）；QR 圖為 public/ 靜態資源
const LINE_BASIC_ID = process.env.NEXT_PUBLIC_LINE_BASIC_ID || ""

interface GroupSettingsDialogProps {
  currentGroupName: string
  initialContactEmail?: string
  onUpdateSuccess: (newName?: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GroupSettingsDialog({ currentGroupName, initialContactEmail = "", onUpdateSuccess, open: controlledOpen, onOpenChange }: GroupSettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (value: boolean) => {
    setInternalOpen(value)
    onOpenChange?.(value)
  }
  const [loading, setLoading] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  
  // States for form
  // 一次只展開一個編輯輸入框，其餘維持精簡狀態列
  const [activeEdit, setActiveEdit] = useState<null | 'name' | 'password' | 'email'>(null)
  const [newName, setNewName] = useState(currentGroupName)
  const [committedName, setCommittedName] = useState(currentGroupName)
  const [contactEmail, setContactEmail] = useState(initialContactEmail)
  const [committedEmail, setCommittedEmail] = useState(initialContactEmail)
  const [newLoginPassword, setNewLoginPassword] = useState("")
  const [currentRestockPassword, setCurrentRestockPassword] = useState("")
  const [newRestockPassword, setNewRestockPassword] = useState("")
  const [hasRestockPassword, setHasRestockPassword] = useState(false)
  const [restockStep, setRestockStep] = useState<'info' | 'verify' | 'update'>('info')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  // LINE 通知綁定
  const [lineBound, setLineBound] = useState(false)
  const [lineCode, setLineCode] = useState<string | null>(null)
  const router = useRouter()

  // Fetch current detailed settings when opening
  useEffect(() => {
    if (open) {
      fetchSettings()
      // 如果 props 已經更新了，就先用 props 的（避免開窗時信箱欄空白閃爍，等 fetch 回來才補值）
      setActiveEdit(null)
      setNewName(currentGroupName)
      setCommittedName(currentGroupName)
      setContactEmail(initialContactEmail)
      setCommittedEmail(initialContactEmail)
      setNewLoginPassword("")
      setCurrentRestockPassword("")
      setNewRestockPassword("")
      setRestockStep('info')
      setShowDeleteConfirm(false)
      setDeleteConfirmName("")
      setLineCode(null)
    }
  }, [open, currentGroupName, initialContactEmail])

  const fetchSettings = async () => {
    setIsLoadingSettings(true)
    try {
      const res = await fetch('/api/group')
      const data = await res.json()
      if (data.name) { setNewName(data.name); setCommittedName(data.name) }
      if (data.contactEmail) { setContactEmail(data.contactEmail); setCommittedEmail(data.contactEmail) }
      setHasRestockPassword(data.hasRestockPassword)
      setLineBound(!!data.lineBound)
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleUpdateGroupName = async () => {
    if (!newName || newName === committedName) return
    setLoading(true)
    try {
      const res = await fetch('/api/group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      if (!res.ok) throw new Error('更新失敗')
      alert('球團名稱更新成功')
      setCommittedName(newName)
      setActiveEdit(null)
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
      setCommittedEmail(contactEmail)
      setActiveEdit(null)
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
      setActiveEdit(null)
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

  const handleLineAction = async (lineAction: 'enable' | 'regenerate' | 'unbind') => {
    setLoading(true)
    try {
      const res = await fetch('/api/group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineAction })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '操作失敗')

      if (lineAction === 'unbind') {
        setLineBound(false)
        setLineCode(null)
        alert('已解除 LINE 綁定')
      } else {
        // enable / regenerate：顯示新產生的驗證碼供使用者輸入
        setLineCode(data.code)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '操作失敗'
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (deleteConfirmName !== currentGroupName) return
    setLoading(true)
    try {
      const res = await fetch('/api/group', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: deleteConfirmName })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '刪除失敗')
      
      alert('您的球團與帳號已永久移除。')
      setOpen(false)
      router.push('/login')
      router.refresh()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '刪除失敗'
      alert(message)
    } finally {
      setLoading(false)
    }
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
          <DialogDescription>
            在此管理您的球團名稱、共享密碼及安全設定。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4 overflow-y-auto px-1 flex-1">
          {/* Group Name Section */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2 text-foreground font-bold">
              <Type className="w-4 h-4" /> 球團名稱
            </Label>
            {activeEdit === 'name' ? (
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 h-9"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => { setNewName(committedName); setActiveEdit(null) }}
                  disabled={loading}
                >
                  取消
                </Button>
                <Button
                  onClick={handleUpdateGroupName}
                  disabled={loading || !newName || newName === committedName}
                  size="sm"
                  className="h-9"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "儲存"}
                </Button>
              </div>
            ) : (
              <div className="settings-card flex items-center justify-between gap-2 px-3 py-2 rounded-lg border">
                <span className="text-sm text-foreground truncate">{committedName}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="settings-button shrink-0"
                  onClick={() => setActiveEdit('name')}
                  disabled={isLoadingSettings}
                >
                  編輯
                </Button>
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Login Password Section */}
          <div className="space-y-2">
            <Label htmlFor="login-pass" className="flex items-center gap-2 text-foreground font-bold">
              <KeyRound className="w-4 h-4" /> 變更共享密碼 (系統登入用)
            </Label>
            {activeEdit === 'password' ? (
              <>
                <div className="flex gap-2">
                  <Input
                    id="login-pass"
                    type="password"
                    placeholder="輸入新密碼（至少 6 字元）"
                    value={newLoginPassword}
                    onChange={(e) => setNewLoginPassword(e.target.value)}
                    className="flex-1 h-9"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() => { setNewLoginPassword(""); setActiveEdit(null) }}
                    disabled={loading}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleUpdateLoginPassword}
                    disabled={loading || !newLoginPassword}
                    size="sm"
                    className="h-9"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "儲存"}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">更新後，所有共用此帳號的成員皆需使用新密碼登入。</p>
              </>
            ) : (
              <div className="settings-card flex items-center justify-between gap-2 px-3 py-2 rounded-lg border">
                <span className="text-sm text-muted-foreground">共用登入密碼 ••••••</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="settings-button shrink-0"
                  onClick={() => setActiveEdit('password')}
                >
                  變更
                </Button>
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Contact Email Section */}
          <div className="space-y-2">
            <Label htmlFor="contact-email" className="flex items-center gap-2 text-foreground font-bold">
              <Mail className="w-4 h-4" /> 聯絡信箱
            </Label>
            {activeEdit === 'email' ? (
              <>
                <div className="flex gap-2">
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="例如：abc@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="flex-1 h-9"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() => { setContactEmail(committedEmail); setActiveEdit(null) }}
                    disabled={loading}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleUpdateContactEmail}
                    disabled={loading}
                    size="sm"
                    className="h-9"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "儲存"}
                  </Button>
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-500">
                  📬 低庫存通知會寄到這個信箱。未填寫則不會收到補貨提醒，建議填寫真實可收信的信箱。
                </p>
              </>
            ) : (
              <div className="settings-card flex items-center justify-between gap-2 px-3 py-2 rounded-lg border">
                <span className={cn("text-sm truncate", committedEmail ? "text-foreground" : "text-muted-foreground")}>
                  {committedEmail || "尚未設定（不會收到低庫存通知）"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="settings-button shrink-0"
                  onClick={() => setActiveEdit('email')}
                  disabled={isLoadingSettings}
                >
                  編輯
                </Button>
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* LINE Notification Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground font-bold">
              <MessageCircle className="w-4 h-4 text-green-600" /> LINE 低庫存通知
            </Label>

            <div className="settings-card p-4 rounded-xl border">
              {lineBound ? (
                // 已綁定
                <div className="flex flex-col items-center gap-3">
                  <span className="status-badge-success px-2 py-0.5 rounded border text-sm font-medium">
                    已綁定 LINE 通知 ✅
                  </span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                    庫存偏低時，系統會透過 LINE 官方帳號推播提醒。
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleLineAction('unbind')}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "解除綁定"}
                  </Button>
                </div>
              ) : lineCode ? (
                // 已產生驗證碼，等待使用者加好友並輸入
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/line-add-friend.png"
                    alt="加 LINE 官方帳號好友 QR Code"
                    className="w-36 h-36 rounded-lg border bg-white object-contain"
                  />
                  {LINE_BASIC_ID && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      或搜尋 LINE ID：<span className="font-mono font-bold">{LINE_BASIC_ID}</span>
                    </p>
                  )}
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 mb-1">加好友後，在聊天室輸入以下驗證碼：</p>
                    <p className="text-3xl font-mono font-bold tracking-[0.3em] text-green-600">{lineCode}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">驗證碼 10 分鐘內有效</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full settings-button"
                    onClick={() => handleLineAction('regenerate')}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "重新產生驗證碼"}
                  </Button>
                </div>
              ) : (
                // 未啟用
                <div className="flex flex-col items-center gap-3">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                    除了 Email，也可綁定 LINE 官方帳號，低庫存時直接收到 LINE 通知。
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full settings-button"
                    onClick={() => handleLineAction('enable')}
                    disabled={loading || isLoadingSettings}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "開啟 LINE 通知"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Restock Password Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-foreground font-bold">
              <ShieldCheck className="w-4 h-4" /> 入庫管理密碼
            </Label>
            
            <div className="settings-card p-4 rounded-xl border min-h-[100px] flex flex-col justify-center">
              {restockStep === 'info' ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {hasRestockPassword ? (
                      <span className="status-badge-success px-2 py-0.5 rounded border">已啟用自訂密碼防護</span>
                    ) : (
                      <span className="status-badge-default px-2 py-0.5 rounded border">目前使用系統預設碼 (1111)</span>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setRestockStep('verify')}
                    className="w-full settings-button"
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
                      className="h-9"
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
                      size="sm"
                      className="flex-1 h-9"
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
                      className="h-9"
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
                      size="sm"
                      className="h-9"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "儲存設定"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">入庫登記為敏感操作，建議設定專屬密碼與球團成員共享。</p>
          </div>

          <hr className="border-slate-100" />

          {/* Danger Zone */}
          <div className="pt-2">
            {!showDeleteConfirm ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold"
                onClick={() => setShowDeleteConfirm(true)}
              >
                刪除球團與帳號
              </Button>
            ) : (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/50 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">這是不可逆的操作！</p>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80">
                      刪除後將永久移除所有球種、入庫紀錄、領取歷史。請在下方輸入球團名稱 <span className="font-mono bg-white dark:bg-black px-1 rounded border">{currentGroupName}</span> 以確認。
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Input
                    placeholder="請在此輸入球團名稱"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    className="h-9 border-red-200 focus-visible:ring-red-500"
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1 h-9"
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setDeleteConfirmName("")
                      }}
                    >
                      取消
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="flex-1 h-9 font-bold"
                      disabled={loading || deleteConfirmName !== currentGroupName}
                      onClick={handleDeleteGroup}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "確認永久刪除"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
