"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  SESSION_REFRESH_INTERVAL_MS,
  SESSION_STALE_THRESHOLD_MS,
} from "@/lib/attendance/constants"
import type { Employee } from "@/types"
import type { AuthChangeEvent, User } from "@supabase/supabase-js"

interface UseUserReturn {
  user: User | null
  employee: Employee | null
  isAdmin: boolean
  isLoading: boolean
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UseUserReturn>({
  user: null,
  employee: null,
  isAdmin: false,
  isLoading: true,
  refreshUser: async () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const hiddenAtRef = useRef<number>(0)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" })
      const data = await res.json()
      setUser(data.user)
      setEmployee(data.employee)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Auth state listener + visibility handler + periodic refresh
  useEffect(() => {
    const supabase = createClient()

    // 1. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "SIGNED_OUT") {
        setUser(null)
        setEmployee(null)
        router.replace("/login")
      } else if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        fetchUser()
      }
    })

    // 2. Visibility change handler — re-validate session after waking
    async function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now()
        return
      }

      // Tab became visible — check if we were hidden long enough to warrant a refresh
      if (
        hiddenAtRef.current > 0 &&
        Date.now() - hiddenAtRef.current > SESSION_STALE_THRESHOLD_MS
      ) {
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user) {
          setUser(null)
          setEmployee(null)
          router.replace("/login")
        } else {
          fetchUser()
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // 3. Periodic session refresh as a safety net
    const intervalId = setInterval(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setUser(null)
        setEmployee(null)
        router.replace("/login")
      }
    }, SESSION_REFRESH_INTERVAL_MS)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(intervalId)
    }
  }, [fetchUser, router])

  return (
    <UserContext.Provider
      value={{
        user,
        employee,
        isAdmin: employee?.is_admin ?? false,
        isLoading,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UseUserReturn {
  return useContext(UserContext)
}
