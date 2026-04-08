export default function Loading() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header skeleton */}
        <div className="bg-card p-5 md:p-6 rounded-2xl shadow-sm border border-border space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="space-y-2">
              <div className="h-8 w-64 bg-muted animate-pulse rounded-lg" />
              <div className="h-4 w-40 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="h-10 w-32 bg-muted animate-pulse rounded-xl" />
          </div>
          <div className="h-14 w-full bg-muted animate-pulse rounded-xl" />
        </div>

        {/* Inventory skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>

        {/* Buttons skeleton */}
        <div className="flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto">
          <div className="flex-1 h-14 bg-muted animate-pulse rounded-xl" />
          <div className="flex-1 h-14 bg-muted animate-pulse rounded-xl" />
          <div className="flex-1 h-14 bg-muted animate-pulse rounded-xl" />
        </div>

        {/* History skeleton */}
        <div className="w-full max-w-2xl mx-auto space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  )
}
