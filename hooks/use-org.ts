"use client"

import { useUser } from "@/hooks/use-user"

/**
 * The single workspace org id. Multi-organization support was removed —
 * everyone lives in one workspace — so this simply returns the current
 * employee's org (with a stable fallback).
 */
export function useOrg() {
  const { employee } = useUser()
  return employee?.org_id ?? "ORG-001"
}
