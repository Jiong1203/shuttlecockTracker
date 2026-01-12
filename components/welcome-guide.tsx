'use client'

import { useState, useEffect } from 'react'
import { Package, ArrowRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface WelcomeGuideProps {
  currentStock: number
  onDismiss?: () => void
  onStartSetup?: () => void
}

export function WelcomeGuide({ currentStock, onDismiss, onStartSetup }: WelcomeGuideProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Always show if stock is 0
    if (currentStock === 0) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [currentStock])

  const handleDismiss = () => {
    setOpen(false)
    onDismiss?.()
  }

  const handleStartSetup = () => {
    setOpen(false)
    onStartSetup?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="welcome-guide-icon w-12 h-12 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-2xl">
              歡迎使用羽球庫存共享小幫手！
            </DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed pt-2">
            請先完成以下步驟開始使用系統
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <ol className="text-sm text-foreground space-y-3 ml-4 list-decimal">
            <li className="pl-2">點擊「庫存管理」按鈕進入管理介面</li>
            <li className="pl-2">前往「球種」頁面建立您的羽球品牌與型號</li>
            <li className="pl-2">至「入庫」頁面進行庫存數量登錄</li>
          </ol>

          <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                入庫密碼提示
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                系統預設入庫密碼為：<span className="font-mono font-bold text-lg">1111</span>
              </p>
              <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                您可以稍後在「帳號設定」中修改此密碼
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            onClick={handleDismiss}
            variant="outline"
            className="w-full sm:w-auto"
          >
            稍後再說
          </Button>
          <Button
            onClick={handleStartSetup}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            立即設定
            <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
