'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PickupForm } from "@/components/pickup-form"
import { SettlementDialog } from "@/components/settlement-dialog"
import { InventoryManagerDialog } from "@/components/inventory-manager-dialog"
import { PickupHistory } from "@/components/pickup-history"
import { ToastContainer } from "@/components/ui/toast"

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

interface HomeInteractiveProps {
  inventory?: InventorySummary[]
  records?: PickupRecord[]
  totalCurrentStock?: number
  inventoryManagerOpen?: boolean
  onInventoryManagerOpenChange?: (open: boolean) => void
}

export default function HomeInteractive({
  inventory = [],
  records = [],
  totalCurrentStock = 0,
  inventoryManagerOpen: controlledOpen,
  onInventoryManagerOpenChange
}: HomeInteractiveProps) {
  const router = useRouter()
  const [localOpen, setLocalOpen] = useState(false)
  const inventoryManagerOpen = controlledOpen ?? localOpen
  const setInventoryManagerOpen = onInventoryManagerOpenChange ?? setLocalOpen

  const refreshData = () => {
    router.refresh()
  }

  const derivedTypes = inventory.map(item => ({
    id: item.shuttlecock_type_id,
    brand: item.brand,
    name: item.name,
    is_active: item.is_active,
  }))

  return (
    <>
      <div className="flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto">
        <PickupForm onSuccess={refreshData} disabled={totalCurrentStock === 0} initialTypes={derivedTypes} />
        <SettlementDialog records={records} types={inventory} />
        <InventoryManagerDialog
          open={inventoryManagerOpen}
          onOpenChange={setInventoryManagerOpen}
          onUpdate={refreshData}
          initialTab="overview"
          initialTypes={derivedTypes}
        />
      </div>
      <div className="w-full max-w-2xl mx-auto">
        <PickupHistory records={records} onDelete={refreshData} />
      </div>
      <ToastContainer />
    </>
  )
}
