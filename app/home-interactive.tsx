'use client'

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { GroupSettingsDialog } from "@/components/group-settings-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { PickupForm } from "@/components/pickup-form"
import { SettlementDialog } from "@/components/settlement-dialog"
import { InventoryManagerDialog } from "@/components/inventory-manager-dialog"
import { PickupHistory } from "@/components/pickup-history"
import { ToastContainer } from "@/components/ui/toast"
import { LogOut } from "lucide-react"

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
  groupName?: string
  inventory?: InventorySummary[]
  records?: PickupRecord[]
  totalCurrentStock?: number
  variant?: 'header' | 'content'
}

export function HomeHeaderControls({ groupName }: { groupName: string }) {
  const [group, setGroup] = useState<{ name: string } | null>(groupName ? { name: groupName } : null)
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const refreshData = () => {
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-xl border border-border/50">
      <ThemeToggle />
      <GroupSettingsDialog 
        currentGroupName={group?.name || ""} 
        onUpdateSuccess={(newName) => {
          if (newName) {
            setGroup(prev => prev ? { ...prev, name: newName } : null)
          }
          refreshData()
        }} 
      />
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleLogout}
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 transition-all px-2 md:px-3"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden md:inline">登出系統</span>
      </Button>
    </div>
  )
}

export default function HomeInteractive({ 
  groupName = "", 
  inventory = [], 
  records = [],
  totalCurrentStock = 0,
  variant = 'content'
}: HomeInteractiveProps) {
  const [inventoryManagerOpen, setInventoryManagerOpen] = useState(false)
  const [currentInventory] = useState<InventorySummary[]>(inventory)
  const [currentRecords] = useState<PickupRecord[]>(records)

  const refreshData = () => {
    window.location.reload()
  }

  if (variant === 'header') {
    return <HomeHeaderControls groupName={groupName} />
  }

  return (
    <>
      <div className="flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto">
        <PickupForm onSuccess={refreshData} disabled={totalCurrentStock === 0} />
        <SettlementDialog records={currentRecords} types={currentInventory || []} />
        <InventoryManagerDialog 
          open={inventoryManagerOpen} 
          onOpenChange={setInventoryManagerOpen}
          onUpdate={refreshData} 
          initialTab="overview"
        />
      </div>
      <div className="w-full max-w-2xl mx-auto">
        <PickupHistory records={currentRecords} onDelete={refreshData} />
      </div>
      <ToastContainer />
    </>
  )
}
