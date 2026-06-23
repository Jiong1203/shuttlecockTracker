'use client'

import dynamic from "next/dynamic"
import { Suspense, useState } from "react"

const HomeInteractive = dynamic(() => import("./home-interactive"))

const HomeHeaderControls = dynamic(() =>
  import("./home-interactive").then(mod => ({ default: mod.HomeHeaderControls }))
)

const WelcomeGuide = dynamic(() =>
  import("@/components/welcome-guide").then(mod => ({ default: mod.WelcomeGuide }))
)

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
}

export function ClientWrapper({
  variant,
  groupName = "",
  inventory = [],
  records = [],
  totalCurrentStock = 0
}: ClientWrapperProps) {
  const [inventoryManagerOpen, setInventoryManagerOpen] = useState(false)

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
        {totalCurrentStock === 0 && (
          <Suspense fallback={null}>
            <WelcomeGuide
              currentStock={0}
              onStartSetup={() => setInventoryManagerOpen(true)}
            />
          </Suspense>
        )}
        <Suspense fallback={
          // 鏡像 HomeInteractive 的真實輸出（按鈕列 + 領取紀錄）以避免 chunk 載入時的版面位移
          <>
            <div className="flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto">
              <div className="flex-1 min-w-[120px] h-14 bg-muted animate-pulse rounded-md" />
              <div className="flex-1 min-w-[120px] h-14 bg-muted animate-pulse rounded-md" />
              <div className="flex-1 min-w-[120px] h-14 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="w-full max-w-2xl mx-auto mt-8">
              <div className="h-7 w-40 bg-muted animate-pulse rounded-md mb-4 ml-2" />
              <div className="h-80 bg-muted animate-pulse rounded-xl border border-border" />
            </div>
          </>
        }>
          <HomeInteractive
            groupName={groupName}
            inventory={inventory}
            records={records}
            totalCurrentStock={totalCurrentStock}
            variant="content"
            inventoryManagerOpen={inventoryManagerOpen}
            onInventoryManagerOpenChange={setInventoryManagerOpen}
          />
        </Suspense>
      </>
    )
  }

  return null
}
