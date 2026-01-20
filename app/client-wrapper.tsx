'use client'

import dynamic from "next/dynamic"
import { Suspense } from "react"

// 在 Client Component 中進行動態導入，這樣可以使用 ssr: false
const HomeInteractive = dynamic(() => import("./home-interactive"), {
  ssr: false
})

const HomeHeaderControls = dynamic(() => 
  import("./home-interactive").then(mod => ({ default: mod.HomeHeaderControls })), {
  ssr: false
})

const WelcomeGuide = dynamic(() => import("@/components/welcome-guide").then(mod => ({ default: mod.WelcomeGuide })), {
  ssr: false
})

interface InventorySummary {
  shuttlecock_type_id: string;
  brand: string;
  name: string;
  is_active: boolean;
  total_restocked: number;
  total_picked: number;
  current_stock: number;
}

interface PickupRecord {
  id: string
  picker_name: string
  quantity: number
  created_at: string
  shuttlecock_types?: {
    brand: string
    name: string
  }
}

interface ClientWrapperProps {
  variant: 'header' | 'content'
  groupName?: string
  inventory?: InventorySummary[]
  records?: PickupRecord[]
  totalCurrentStock?: number
  currentStock?: number
}

export function ClientWrapper({ 
  variant, 
  groupName = "", 
  inventory = [], 
  records = [],
  totalCurrentStock = 0,
  currentStock = 0
}: ClientWrapperProps) {
  // 在客戶端定義處理函數
  const handleStartSetup = () => {
    // 這個邏輯會在客戶端處理，可以打開庫存管理對話框等
    // 由於 WelcomeGuide 是客戶端組件，它會自己處理交互
  }

  if (variant === 'header') {
    return (
      <Suspense fallback={<div className="w-32 h-10 bg-muted animate-pulse rounded-xl" />}>
        <HomeHeaderControls groupName={groupName} />
      </Suspense>
    )
  }

  if (variant === 'content') {
    return (
      <>
        {currentStock === 0 && (
          <Suspense fallback={null}>
            <WelcomeGuide 
              currentStock={0} 
              onStartSetup={handleStartSetup}
            />
          </Suspense>
        )}
        <Suspense fallback={
          <div className="flex flex-col gap-4">
            <div className="flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto">
              <div className="flex-1 h-12 bg-muted animate-pulse rounded-xl" />
              <div className="flex-1 h-12 bg-muted animate-pulse rounded-xl" />
              <div className="flex-1 h-12 bg-muted animate-pulse rounded-xl" />
            </div>
            <div className="w-full max-w-2xl mx-auto h-64 bg-muted animate-pulse rounded-xl" />
          </div>
        }>
          <HomeInteractive 
            groupName={groupName} 
            inventory={inventory}
            records={records}
            totalCurrentStock={totalCurrentStock}
            variant="content"
          />
        </Suspense>
      </>
    )
  }

  return null
}
