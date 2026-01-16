'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ShieldCheck, Users } from 'lucide-react'
import Image from 'next/image'
import { ThemeToggle } from '@/components/theme-toggle'
import { logLogin } from '@/app/actions/auth-logging'

export default function LoginPage() {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [rememberAccount, setRememberAccount] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  // Load remembered account on mount
  useEffect(() => {
    const savedAccount = localStorage.getItem('remembered_shuttle_account')
    if (savedAccount) {
      setAccount(savedAccount)
      setRememberAccount(true)
    }
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 內部轉換：將簡單帳號補上虛構域名以符合 Supabase Auth 的 Email 格式要求
    const internalEmail = account.includes('@') ? account : `${account}@shuttletracker.com`

    // 前端預先檢查密碼長度，提供更及時的中文提示
    if (password.length < 6) {
      alert('密碼長度至少需要 6 個字元')
      setLoading(false)
      return
    }

    try {
      if (isSignUp) {
        // Sign Up
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: internalEmail,
          password,
        })

        if (authError) throw authError

        if (authData.user) {
          // Create Group
          const { data: groupData, error: groupError } = await supabase
            .from('groups')
            .insert({ 
              name: groupName || "我的羽球團",
              created_by: authData.user.id,
              // 未來若有真實信箱可在此設定，目前先留空
              contact_email: account.includes('@') ? account : null
            })
            .select()
            .single()

          if (groupError) throw groupError

          // Create Profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              group_id: groupData.id,
              full_name: account,
            })

          if (profileError) throw profileError

          // Inventory Config is deprecated, using restock_records (initial record not strictly needed, or can be added if design requires)
          // await supabase.from('inventory_config').insert(...) 

          // Log Sign Up Success
          await logLogin(internalEmail)
          
          alert('球團帳號建立成功！現在可以使用該帳號進行登入。')
          setIsSignUp(false)
        }
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email: internalEmail,
          password,
        })

        if (error) throw error

        // Handle Remember Me
        if (rememberAccount) {
          localStorage.setItem('remembered_shuttle_account', account)
        } else {
          localStorage.removeItem('remembered_shuttle_account')
        }

        // Log Sign In Success (Non-blocking)
        logLogin(internalEmail)

        router.push('/')
        router.refresh()
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      let message = err?.message || '發生未知錯誤'
      
      // 錯誤訊息中文化
      if (message.includes('Password should be at least 6 characters')) {
        message = '密碼長度至少需要 6 個字元'
      } else if (message.includes('Invalid login credentials')) {
        message = '帳號或密碼錯誤'
      } else if (message.includes('User already registered')) {
        message = '此帳號已被註冊'
      } else if (message.includes('Email not confirmed')) {
        message = '帳號尚未驗證'
      } else if (message.includes('is invalid')) {
        message = '帳號格式不正確'
      }

      alert(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Theme Toggle in top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-[30%] h-[30%] bg-blue-400/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[10%] right-[15%] w-[30%] h-[30%] bg-indigo-400/10 blur-[100px] rounded-full" />
      </div>

      <Card className="w-full max-w-md border-border bg-card shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />
        
        <CardHeader className="space-y-2 pt-10 pb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-1 bg-card rounded-2xl ring-1 ring-border shadow-sm overflow-hidden flex items-center justify-center">
              <Image 
                src="/icon.png" 
                alt="App Icon" 
                width={64} 
                height={64} 
                className="object-contain" 
              />
            </div>
          </div>
          <CardTitle className="text-3xl font-black tracking-tight text-foreground">
            {isSignUp ? '建立您的球團' : '羽球庫存共享小幫手'}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base font-medium">
            {isSignUp ? '註冊後即可開始管理球團庫存' : '請登入球團帳號以繼續'}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-6 pb-2">
            {isSignUp && (
              <div className="space-y-2.5">
                <Label htmlFor="group" className="text-foreground font-bold text-sm ml-1 select-none">球團名稱</Label>
                <div className="relative">
                  <Input 
                    id="group" 
                    placeholder="例如：週二羽球社" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    required
                    className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:ring-blue-500/20 focus:border-blue-500 pl-10 h-12 rounded-xl transition-all"
                  />
                  <Users className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            )}
            <div className="space-y-2.5">
              <Label htmlFor="account" className="text-foreground font-bold text-sm ml-1 select-none">球團帳號</Label>
              <Input 
                id="account" 
                placeholder="例如：mygroup_admin" 
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:ring-blue-500/20 focus:border-blue-500 h-12 rounded-xl transition-all"
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-foreground font-bold text-sm ml-1 select-none">密碼</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="請輸入您的密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:ring-blue-500/20 focus:border-blue-500 h-12 rounded-xl transition-all"
              />
            </div>

            {!isSignUp && (
              <div className="flex items-center space-x-2 ml-1">
                <input
                  type="checkbox"
                  id="remember"
                  className="h-4 w-4 rounded border-border bg-muted/50 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                  checked={rememberAccount}
                  onChange={(e) => setRememberAccount(e.target.checked)}
                />
                <label
                  htmlFor="remember"
                  className="text-sm font-semibold text-muted-foreground cursor-pointer select-none"
                >
                  記住球團帳號
                </label>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-6 pb-10 pt-8 text-center px-6">
            <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50"
                disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                isSignUp ? '立即註冊' : '登入系統'
              )}
            </Button>
            
            <button 
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setAccount('')
                setPassword('')
                setGroupName('')
              }}
              className="text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold transition-colors duration-200 py-1"
            >
              {isSignUp ? '已經有球團帳號？點此登入' : '還沒有建立球團？點此註冊新帳號'}
            </button>
          </CardFooter>
        </form>

        <div className="bg-muted/50 py-4 flex items-center justify-center gap-2 text-[10px] text-foreground uppercase tracking-widest border-t border-border">
          <ShieldCheck className="w-3.5 h-3.5" />
          Secure Enterprise Authentication
        </div>
      </Card>

      <footer className="mt-8 py-4 text-center text-muted-foreground text-xs">
        &copy; 2025 動資訊有限公司 MovIT. All rights reserved.
      </footer>
    </div>
  )
}
