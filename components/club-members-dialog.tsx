'use client'

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { showToast } from "@/components/ui/toast"
import { Users, Plus, Loader2, Trash2, EyeOff, Eye } from "lucide-react"

export interface ClubMember {
  id: string
  display_name: string
  default_fee: number
  is_free: boolean
  is_active: boolean
  note: string | null
}

export function ClubMembersDialog({
  clubId, open, onOpenChange, onChanged,
}: {
  clubId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged?: () => void
}) {
  const [members, setMembers] = useState<ClubMember[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 新增列
  const [newName, setNewName] = useState('')
  const [newFee, setNewFee] = useState('')
  const [newFree, setNewFree] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/members?all=true`)
      const data = await res.json()
      if (res.ok) setMembers(data)
      else showToast(data.error || '載入名冊失敗', 'error')
    } finally { setLoading(false) }
  }, [clubId])

  useEffect(() => { if (open) fetchMembers() }, [open, fetchMembers])

  const handleAdd = async () => {
    if (!newName.trim()) { showToast('請輸入姓名', 'warning'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: newName.trim(),
          defaultFee: newFee ? parseFloat(newFee) : 0,
          isFree: newFree,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || '新增失敗', 'error'); return }
      setNewName(''); setNewFee(''); setNewFree(false)
      await fetchMembers()
      onChanged?.()
    } finally { setSaving(false) }
  }

  const patch = async (m: ClubMember, updates: Partial<{
    displayName: string; defaultFee: number; isFree: boolean; isActive: boolean
  }>) => {
    const res = await fetch(`/api/clubs/${clubId}/members/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error || '更新失敗', 'error'); return }
    await fetchMembers()
    onChanged?.()
  }

  const handleDelete = async (m: ClubMember) => {
    if (!confirm(`確定從名冊移除「${m.display_name}」？\n過往活動的出席紀錄會保留姓名，不受影響。`)) return
    const res = await fetch(`/api/clubs/${clubId}/members/${m.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      showToast(data.error || '刪除失敗', 'error')
      return
    }
    showToast('已從名冊移除', 'success')
    await fetchMembers()
    onChanged?.()
  }

  const active = members.filter(m => m.is_active)
  const inactive = members.filter(m => !m.is_active)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> 球隊名冊
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          建立常來的隊員，之後新增活動時可直接勾選，不必每場重打姓名。
        </p>

        {/* 新增列 */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="姓名"
            className="h-9 flex-1 min-w-[120px] text-sm"
          />
          <Input
            type="number"
            value={newFee}
            onChange={e => setNewFee(e.target.value)}
            placeholder="預設費用"
            className="h-9 w-24 text-sm"
            disabled={newFree}
          />
          <button
            type="button"
            onClick={() => setNewFree(v => !v)}
            className={`h-9 px-2.5 rounded-md border text-xs transition-colors ${
              newFree
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                : 'text-muted-foreground border-input hover:bg-muted/50'
            }`}
          >
            免費
          </button>
          <Button onClick={handleAdd} disabled={saving} size="sm" className="h-9 gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            新增
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2 text-muted-foreground">
              <Users className="w-10 h-10 opacity-20" />
              <p className="text-sm">名冊還是空的，先加入常來的隊員吧</p>
            </div>
          ) : (
            <div className="space-y-1">
              {active.map(m => (
                <MemberRow key={m.id} member={m} onPatch={patch} onDelete={handleDelete} />
              ))}

              {inactive.length > 0 && (
                <>
                  <p className="pt-3 pb-1 px-1 text-[11px] font-semibold text-muted-foreground">
                    已停用（{inactive.length}）
                  </p>
                  {inactive.map(m => (
                    <MemberRow key={m.id} member={m} onPatch={patch} onDelete={handleDelete} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MemberRow({
  member: m, onPatch, onDelete,
}: {
  member: ClubMember
  onPatch: (m: ClubMember, u: Partial<{ displayName: string; defaultFee: number; isFree: boolean; isActive: boolean }>) => void
  onDelete: (m: ClubMember) => void
}) {
  const [fee, setFee] = useState(String(m.default_fee))

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${m.is_active ? 'bg-card' : 'bg-muted/40 opacity-60'}`}>
      <span className="flex-1 min-w-0 truncate text-sm font-medium">{m.display_name}</span>

      {m.is_free ? (
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 shrink-0">
          免費
        </span>
      ) : (
        <Input
          type="number"
          value={fee}
          onChange={e => setFee(e.target.value)}
          onBlur={() => {
            const v = parseFloat(fee)
            if (!Number.isNaN(v) && v !== Number(m.default_fee)) onPatch(m, { defaultFee: v })
          }}
          className="h-7 w-20 text-xs shrink-0"
          aria-label={`${m.display_name} 的預設費用`}
        />
      )}

      <button
        onClick={() => onPatch(m, { isFree: !m.is_free })}
        className="text-[11px] text-muted-foreground hover:text-foreground px-1 shrink-0"
        title={m.is_free ? '改為收費' : '設為免費'}
      >
        {m.is_free ? '收費' : '免費'}
      </button>

      <button
        onClick={() => onPatch(m, { isActive: !m.is_active })}
        className="text-muted-foreground hover:text-foreground p-1 shrink-0"
        title={m.is_active ? '停用（不再出現在勾選清單）' : '重新啟用'}
      >
        {m.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>

      <button
        onClick={() => onDelete(m)}
        className="text-muted-foreground hover:text-red-500 p-1 shrink-0"
        title="從名冊移除"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
