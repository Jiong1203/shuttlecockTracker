export default function Loading() {
  // 此骨架刻意鏡像 app/page.tsx 的真實版面（sticky h-14 工具列、flex-wrap 庫存大卡、
  // h-14 操作按鈕、標題 + 表格卡的領取紀錄），避免骨架切換為真實內容時造成版面位移（CLS）。
  return (
    <div className="min-h-screen bg-background">
      {/* 工具列骨架 — 對齊 page.tsx 的 sticky h-14 header */}
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-14 flex items-center gap-3">
          {/* 品牌標題為靜態文字，直接渲染以完全對齊真實 header，減少位移 */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="text-sm font-black tracking-tight text-foreground whitespace-nowrap">羽球庫存共享小幫手</h1>
            <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wider uppercase">Beta</span>
          </div>
          {/* 右側操作按鈕佔位 */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-9 h-9 bg-muted animate-pulse rounded-md" />
            <div className="w-9 h-9 bg-muted animate-pulse rounded-md" />
            <div className="w-9 h-9 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* 庫存卡骨架 — 對齊 InventoryDisplay 的 flex-wrap 大卡 */}
          <div className="w-full max-w-4xl mx-auto flex flex-wrap justify-center gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="w-full md:w-[calc(50%-0.5rem)] h-[240px] bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>

          {/* 操作按鈕骨架 — 3 顆 h-14（對齊 HomeInteractive 的領取/結算/庫存按鈕） */}
          <div className="flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-1 min-w-[120px] h-14 bg-muted animate-pulse rounded-md" />
            ))}
          </div>

          {/* 領取紀錄骨架 — 對齊 PickupHistory（標題 + 表格卡，含 mt-8） */}
          <div className="w-full max-w-2xl mx-auto mt-8">
            <div className="h-7 w-40 bg-muted animate-pulse rounded-md mb-4 ml-2" />
            <div className="h-80 bg-muted animate-pulse rounded-xl border border-border" />
          </div>

          <footer className="py-12 text-center text-slate-300 text-sm">
            &copy; 2026 動資訊有限公司 MovIT. All rights reserved.
          </footer>
        </div>
      </main>
    </div>
  )
}
