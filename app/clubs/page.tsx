'use client'

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { ToastContainer, showToast } from "@/components/ui/toast"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  ChevronLeft, Plus, Settings, Lock, Loader2, Users,
  LogIn, ClipboardList, BadgeCheck,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Club {
  id: string
  name: string
  leader_name: string
  created_at: string
}

// ─── CreateClubDialog ─────────────────────────────────────────────────────────

function CreateClubDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [leaderName, setLeaderName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => { setName(''); setLeaderName(''); setPin('') }

  const handleCreate = async () => {
    if (!name.trim() || !leaderName.trim() || !pin.trim()) {
      showToast('請填寫所有必填欄位', 'warning'); return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, leaderName, pin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('球團建立成功', 'success')
      onOpenChange(false); reset(); onCreated()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '建立失敗', 'error')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> 新增球團
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>球團名稱 <span className="text-red-500">*</span></Label>
            <Input placeholder="例：瘋羽無懼" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>隊長 / 負責人 <span className="text-red-500">*</span></Label>
            <Input placeholder="例：阿呆" value={leaderName} onChange={e => setLeaderName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>PIN 碼 <span className="text-red-500">*</span></Label>
            <Input type="password" placeholder="設定登入 PIN" value={pin} onChange={e => setPin(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">此 PIN 為球團負責人專用，請妥善保管</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); reset() }} disabled={loading}>取消</Button>
          <Button onClick={handleCreate} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}建立球團
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── ClubSettingsDialog ───────────────────────────────────────────────────────

function ClubSettingsDialog({
  club, open, onOpenChange, onUpdated,
}: { club: Club; open: boolean; onOpenChange: (v: boolean) => void; onUpdated: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [verifiedPin, setVerifiedPin] = useState('')

  // Step 1
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)

  // Step 2
  const [name, setName] = useState(club.name)
  const [leaderName, setLeaderName] = useState(club.leader_name)
  const [newPin, setNewPin] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)

  const reset = () => {
    setStep(1)
    setPinInput(''); setPinError(''); setVerifiedPin('')
    setNewPin('')
  }

  useEffect(() => {
    if (open) {
      reset()
      setName(club.name)
      setLeaderName(club.leader_name)
    }
  }, [open, club]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async () => {
    if (!pinInput.trim()) { setPinError('請輸入 PIN 碼'); return }
    setVerifyLoading(true); setPinError('')
    try {
      const res = await fetch(`/api/clubs/${club.id}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      })
      const data = await res.json()
      if (!res.ok) { setPinError(data.error || 'PIN 碼錯誤'); return }
      setVerifiedPin(pinInput)
      setStep(2)
    } finally { setVerifyLoading(false) }
  }

  const handleSave = async () => {
    const body: Record<string, string> = {}
    if (name.trim() && name !== club.name) body.name = name.trim()
    if (leaderName.trim() && leaderName !== club.leader_name) body.leaderName = leaderName.trim()
    if (newPin.trim()) { body.pin = newPin.trim(); body.currentPin = verifiedPin }
    if (Object.keys(body).length === 0) { showToast('沒有變更內容', 'info'); return }

    setSaveLoading(true)
    try {
      const res = await fetch(`/api/clubs/${club.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('球團資訊已更新', 'success')
      onOpenChange(false); onUpdated()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '更新失敗', 'error')
    } finally { setSaveLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            球團設定
            {step === 2 && (
              <span className="ml-auto text-xs font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5" /> 已驗證
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <>
            <div className="space-y-4 py-2">
              <div className="text-center space-y-2 pb-2">
                <div className="mx-auto w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">請輸入「{club.name}」的 PIN 碼以繼續編輯</p>
              </div>
              <div className="space-y-1.5">
                <Label>PIN 碼</Label>
                <Input
                  type="password"
                  placeholder="輸入 PIN"
                  value={pinInput}
                  autoFocus
                  onChange={e => { setPinInput(e.target.value); setPinError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                />
                {pinError && <p className="text-sm text-red-500">{pinError}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={verifyLoading}>取消</Button>
              <Button onClick={handleVerify} disabled={verifyLoading || !pinInput} className="gap-2">
                {verifyLoading && <Loader2 className="w-4 h-4 animate-spin" />}驗證並繼續
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>球團名稱</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>隊長 / 負責人</Label>
                <Input value={leaderName} onChange={e => setLeaderName(e.target.value)} />
              </div>
              <div className="space-y-1.5 border-t border-border/60 pt-3">
                <Label>更換 PIN 碼 <span className="text-muted-foreground font-normal text-xs">（選填）</span></Label>
                <Input
                  type="password"
                  placeholder="輸入新 PIN 碼"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saveLoading}>返回</Button>
              <Button onClick={handleSave} disabled={saveLoading} className="gap-2">
                {saveLoading && <Loader2 className="w-4 h-4 animate-spin" />}儲存
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── PinVerifyDialog ──────────────────────────────────────────────────────────

function PinVerifyDialog({
  club, open, onOpenChange, onSuccess,
}: { club: Club | null; open: boolean; onOpenChange: (v: boolean) => void; onSuccess: (c: Club) => void }) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setPin(''); setError('') }

  const handleVerify = async () => {
    if (!club) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/clubs/${club.id}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'PIN 碼錯誤'); return }
      onSuccess(club); onOpenChange(false); reset()
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" /> 進入 {club?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>PIN 碼</Label>
            <Input
              type="password" placeholder="輸入 PIN" value={pin} autoFocus
              onChange={e => { setPin(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); reset() }} disabled={loading}>取消</Button>
          <Button onClick={handleVerify} disabled={loading || !pin} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}確認進入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClubsPage() {
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [pinTarget, setPinTarget] = useState<Club | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState<Club | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const fetchClubs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clubs')
      const data = await res.json()
      if (res.ok) setClubs(data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchClubs() }, [fetchClubs])

  const handleEnterClub = (club: Club) => {
    sessionStorage.setItem(`club_verified_${club.id}`, 'true')
    router.push(`/clubs/${club.id}`)
  }

  const openPin = (club: Club) => { setPinTarget(club); setPinOpen(true) }
  const openSettings = (club: Club) => { setSettingsTarget(club); setSettingsOpen(true) }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border/60 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" /> 首頁
            </Link>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2 font-semibold">
              <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              開團紀錄
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-foreground">球團管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">管理球團清單，進入後可查看活動紀錄與利潤</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> 新增球團
          </Button>
        </div>

        {/* Club Table */}
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          {/* Table Header — desktop only */}
          <div className="hidden md:grid grid-cols-[1fr_160px_140px_130px] gap-4 px-5 py-3 bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>球團名稱</span>
            <span>隊長 / 負責人</span>
            <span>建立日期</span>
            <span className="text-right">操作</span>
          </div>

          {/* Rows */}
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : clubs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-muted-foreground">
              <Users className="w-12 h-12 opacity-20" />
              <p className="text-sm">尚無球團，點擊「新增球團」開始建立</p>
            </div>
          ) : (
            clubs.map((club, i) => (
              <div
                key={club.id}
                className={`px-5 py-4 hover:bg-muted/20 transition-colors ${i < clubs.length - 1 ? 'border-b border-border/60' : ''}`}
              >
                {/* Mobile layout */}
                <div className="flex items-center gap-3 md:hidden">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">🏸 {club.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {club.leader_name} · {new Date(club.created_at).toLocaleDateString('zh-TW')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" onClick={() => openPin(club)}>
                      <LogIn className="w-3.5 h-3.5" /> 進入
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground" onClick={() => openSettings(club)}>
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Desktop layout */}
                <div className="hidden md:grid grid-cols-[1fr_160px_140px_130px] gap-4 items-center">
                  <div className="font-semibold text-foreground truncate">🏸 {club.name}</div>
                  <div className="text-sm text-muted-foreground">{club.leader_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(club.created_at).toLocaleDateString('zh-TW')}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => openPin(club)}>
                      <LogIn className="w-3.5 h-3.5" /> 進入
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openSettings(club)}>
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {clubs.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            共 {clubs.length} 個球團 · 點擊「進入」後輸入 PIN 碼即可查看活動紀錄
          </p>
        )}
      </div>

      {/* Dialogs */}
      <CreateClubDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchClubs} />
      <PinVerifyDialog
        club={pinTarget} open={pinOpen}
        onOpenChange={(o) => { setPinOpen(o); if (!o) setPinTarget(null) }}
        onSuccess={handleEnterClub}
      />
      {settingsTarget && (
        <ClubSettingsDialog
          club={settingsTarget} open={settingsOpen}
          onOpenChange={(o) => { setSettingsOpen(o); if (!o) setSettingsTarget(null) }}
          onUpdated={fetchClubs}
        />
      )}

      <ToastContainer />
    </main>
  )
}
