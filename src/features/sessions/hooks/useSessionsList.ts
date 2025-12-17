import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '../types/session'
import { makeApiClient } from '../../../api/apiClient'

export type UseSessionsListParams = {
  userId?: string | null
  idToken?: string | null
  // Optional: current project id. Used only to trigger refetch when it changes.
  projectId?: string | null
  collection?: string
  field?: string
  order?: 'asc' | 'desc'
  start?: number
  end?: number
  limit?: number
  fieldType?: 'number' | 'timestamp' | 'string'
  enabled?: boolean
  mapDocToSession: (doc: any) => Session
}

export type UseSessionsListResult = {
  sessions: Session[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useSessionsList(params: UseSessionsListParams): UseSessionsListResult {
  const {
    userId,
    idToken,
    projectId,
    collection = 'convo.sessions',
    field = 'update_time',
    order = 'desc',
    start = 0,
    end = 4102444800,
    limit,
    fieldType,
    enabled = true,
    mapDocToSession,
  } = params

  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bump = useRef(0)

  const prevProjectIdRef = useRef<string | null | undefined>(undefined)
  const firstLoadRef = useRef(true)

  const reload = useCallback(() => {
    bump.current++
  }, [])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()

    async function load() {
      setError(null)

      const skipAuth = (import.meta as any)?.env?.VITE_SKIP_AUTH === '1'
      if (!enabled || (!idToken && !skipAuth)) {
        setSessions([])
        return
      }

      const projectChanged = prevProjectIdRef.current !== projectId
      const hardLoad = firstLoadRef.current || projectChanged

      // Hard loads (first load or project switch) show loading and may clear stale sessions
      if (hardLoad) {
        setLoading(true)
        if (projectChanged && projectId != null) {
          setSessions([])
        }
      }

      try {
        const client = makeApiClient({ idToken: idToken ?? undefined, skipAuth })
        const body: any = { collection, field, order, start, end }
        if (typeof limit === 'number') body.limit = limit
        if (fieldType) body.fieldType = fieldType
        // Do not send userId/user_id in /api paths; rely on Authorization header

        const json: any = await client.listSessions(body, { signal: ac.signal })

        // Accept multiple shapes from backend
        let rawDocs: any[] = []
        if (Array.isArray(json?.documents)) rawDocs = json.documents
        else if (Array.isArray(json?.items)) rawDocs = json.items
        else if (Array.isArray(json?.docs)) rawDocs = json.docs
        else if (Array.isArray(json)) rawDocs = json

        // Flatten common Firestore-adapter shapes into a simple object for mapping
        const flattened = rawDocs.map((d: any) => ({ id: d?.id, ...(d?.data || {}), ...(d?.data?.value || {}), ...(d?.value || {}) }))

        const mapped = flattened
          .map((d) => {
            try {
              return mapDocToSession(d)
            } catch {
              return null
            }
          })
          .filter(Boolean) as Session[]

        if (!cancelled) setSessions(mapped)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e))
      } finally {
        if (!cancelled) {
          // Only toggle loading off if we previously turned it on for a hard load
          if (firstLoadRef.current || prevProjectIdRef.current !== projectId) {
            setLoading(false)
          }
          firstLoadRef.current = false
          prevProjectIdRef.current = projectId
        }
      }
    }

    load()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [userId, idToken, projectId, collection, field, order, start, end, limit, fieldType, enabled, mapDocToSession, bump.current])

  return { sessions, loading, error, reload }
}
