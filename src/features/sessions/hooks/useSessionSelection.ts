import { useEffect, useMemo, useState } from 'react'
import type { Session } from '../types/session'

export function useSessionSelection(params: {
  sessions: Session[]
  filtered: Session[]
  userId?: string | null
  idToken?: string | null
}) {
  const { sessions, filtered, userId, idToken } = params

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Clear selection when auth is missing
  useEffect(() => {
    if (!idToken || !userId) setSelectedId(null)
  }, [idToken, userId])

  // Ensure selectedId is valid against the full list and auto-select first on load
  useEffect(() => {
    if (!sessions.length) return
    if (selectedId == null) {
      setSelectedId(sessions[0].id)
      return
    }
    // Do not override a non-null selectedId if it doesn't exist in sessions;
    // this allows selecting items not yet present in the server-backed list (e.g., ephemeral sessions)
  }, [sessions, selectedId])

  // Selected object resolved within the currently filtered list
  const selected = useMemo(() => {
    if (!filtered.length) return null
    const cur = selectedId ? filtered.find((s) => s.id === selectedId) : null
    // Do not fall back to the first filtered item when not found;
    // keep null to prevent unintended jumps to another session.
    return cur ?? null
  }, [filtered, selectedId])

  return { selectedId, setSelectedId, selected }
}
