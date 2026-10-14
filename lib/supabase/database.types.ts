/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Permissive database types for Supabase.
 *
 * Using `any` for Row/Insert/Update so that Supabase query results
 * can be cast to application types without intermediate `unknown` casts.
 *
 * Replace with generated types for full type safety:
 *   npx supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
 */

type AnyTable = {
  Row: any
  Insert: any
  Update: any
  Relationships: any[]
}

export type Database = {
  public: {
    Tables: { [key: string]: AnyTable }
    Views: { [key: string]: { Row: any; Relationships: any[] } }
    Functions: { [key: string]: { Args: any; Returns: any } }
    Enums: { [key: string]: string }
    CompositeTypes: { [key: string]: any }
  }
}
