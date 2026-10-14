"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useActivityHeartbeat, type IdleState } from "@/hooks/use-activity-heartbeat"

const IdleStateContext = createContext<IdleState>({
  isIdle: false,
  idleSince: null,
})

export function ActivityHeartbeatProvider({ children }: { children: ReactNode }) {
  const idleState = useActivityHeartbeat()

  return (
    <IdleStateContext.Provider value={idleState}>
      {children}
    </IdleStateContext.Provider>
  )
}

export function useIdleState(): IdleState {
  return useContext(IdleStateContext)
}
