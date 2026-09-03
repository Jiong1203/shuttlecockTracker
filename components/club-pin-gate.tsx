'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, Loader2 } from "lucide-react"


export function ClubPinGate({ clubId, clubName, onVerified }: { clubId: string; clubName: string; onVerified: () => void }) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async () => {
    if (!pin) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/clubs/${clubId}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'PIN 碼錯誤'); return }
      sessionStorage.setItem(`club_verified_${clubId}`, 'true')
      onVerified()
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl border shadow-sm p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-black text-foreground">進入 {clubName}</h2>
            <p className="text-sm text-muted-foreground">請輸入球隊 PIN 碼以進入</p>
          </div>
          <div className="space-y-3">
            <Input
              type="password" placeholder="輸入 PIN 碼" value={pin} autoFocus
              onChange={e => { setPin(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              className="text-center text-lg tracking-widest h-12"
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <Button className="w-full h-11 gap-2" onClick={handleVerify} disabled={loading || !pin}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}確認進入
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
