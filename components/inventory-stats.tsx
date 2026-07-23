import { Boxes, AlertTriangle, PackageMinus, Layers } from "lucide-react"

export interface InventoryStatsData {
  /** 目前總庫存（桶）— 僅計啟用球種 */
  totalStock: number
  /** 啟用球種數 */
  activeTypeCount: number
  /** 全部球種數（含停用） */
  totalTypeCount: number
  /** 低庫存品項數（與低庫存通知同準則：啟用 + 曾進貨 + 低於門檻） */
  lowStockCount: number
  /** 本月取用總量（桶） */
  monthlyPickupQty: number
  /** 本月取用筆數 */
  monthlyPickupCount: number
}

function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
  stripe,
  valueClass = "text-foreground",
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  unit?: string
  sub: string
  stripe: string
  valueClass?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 w-1 ${stripe}`} aria-hidden />
      <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm font-medium">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${valueClass}`}>
          {value}
        </span>
        {unit && <span className="text-sm font-normal text-muted-foreground">{unit}</span>}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground truncate">{sub}</p>
    </div>
  )
}

export function InventoryStats({
  totalStock,
  activeTypeCount,
  totalTypeCount,
  lowStockCount,
  monthlyPickupQty,
  monthlyPickupCount,
}: InventoryStatsData) {
  const hasLowStock = lowStockCount > 0

  return (
    <section
      aria-label="庫存總覽"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
    >
      <StatCard
        icon={<Boxes className="h-4 w-4" />}
        label="目前總庫存"
        value={totalStock}
        unit="桶"
        sub={`跨 ${activeTypeCount} 種啟用球種`}
        stripe="bg-primary"
      />
      <StatCard
        icon={<AlertTriangle className="h-4 w-4" />}
        label="低庫存品項"
        value={lowStockCount}
        unit="項"
        sub={hasLowStock ? "建議盡快補貨" : "庫存充足"}
        stripe={hasLowStock ? "bg-amber-500" : "bg-primary"}
        valueClass={hasLowStock ? "text-amber-600 dark:text-amber-400" : "text-foreground"}
      />
      <StatCard
        icon={<PackageMinus className="h-4 w-4" />}
        label="本月取用"
        value={monthlyPickupQty}
        unit="桶"
        sub={`共 ${monthlyPickupCount} 筆領用紀錄`}
        stripe="bg-sky-500"
      />
      <StatCard
        icon={<Layers className="h-4 w-4" />}
        label="球種數"
        value={activeTypeCount}
        unit="種"
        sub={`共 ${totalTypeCount} 種（含停用）`}
        stripe="bg-slate-400 dark:bg-slate-600"
      />
    </section>
  )
}
