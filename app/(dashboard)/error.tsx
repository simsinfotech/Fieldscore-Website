"use client"

import { TbAlertTriangle } from "react-icons/tb"

export default function DashboardError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  unstable_retry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="glass rounded-2xl p-8 text-center max-w-md space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center">
          <TbAlertTriangle className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => unstable_retry()}
          className="px-6 py-2.5 rounded-xl bg-[#00BCD4] text-white hover:bg-[#00ACC1] transition-all text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
