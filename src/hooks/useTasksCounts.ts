import { useCallback, useEffect, useState } from 'react'
import { makeApiClient } from '../api/apiClient'

export type TasksCounts = {
  queued: number
  inProgress: number
  done: number
  stuck: number
}

export type UseTasksCountsParams = {
  sessionId?: string | null
  idToken?: string | null
  enabled?: boolean
}

export type UseTasksCountsResult = {
  counts: TasksCounts | null
  loading: boolean
  error: string | null
  reload: () => void
}

// Map backend status variants to our four buckets
function bucketForStatus(status: unknown): keyof TasksCounts | null {
  if (!status) return null
  const s = String(status).toLowerCase().replace(/\s+/g, '_')
  if (['queued', 'queue', 'pending', 'todo', 'new'].includes(s)) return 'queued'
  if (['in_progress', 'progress', 'running', 'active', 'processing', 'started'].includes(s)) return 'inProgress'
  if (['done', 'completed', 'complete', 'success', 'succeeded', 'ok', 'finished'].includes(s)) return 'done'
  if (['stuck', 'blocked', 'failed', 'error', 'halted'].includes(s)) return 'stuck'
  return null
}

export function useTasksCounts(params: UseTasksCountsParams): UseTasksCountsResult {
  const { sessionId, idToken, enabled = true } = params
  const [counts, setCounts] = useState<TasksCounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Use state bump so reload reliably re-triggers effect
  const [bump, setBump] = useState(0)

  const reload = useCallback(() => {
    setBump((v) => v + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()

    async function load() {
      setError(null)
      const rawSkip = (import.meta as any)?.env?.VITE_SKIP_AUTH
      const skipAuth = typeof rawSkip === 'string'
        ? ['1', 'true', 'yes', 'on'].includes(rawSkip.toLowerCase())
        : !!rawSkip

      if (!enabled || !sessionId || (!idToken && !skipAuth)) {
        if ((import.meta as any)?.env?.DEV) {
           
          console.debug('[useTasksCounts] skip load', { enabled, sessionId, hasToken: !!idToken, skipAuth })
        }
        setCounts(null)
        return
      }

      setLoading(true)
      try {
        const client = makeApiClient({ idToken: idToken ?? undefined, skipAuth })
        if ((import.meta as any)?.env?.DEV) {
           
          console.debug('[useTasksCounts] loading counts', { sessionId })
        }
        // Prefer by-session endpoint without status first, then bucket client-side
        let next: TasksCounts = { queued: 0, inProgress: 0, done: 0, stuck: 0 }
        let loaded = false
        try {
          const { tasks } = await client.tasksListBySession({ sessionId, limit: 1000, order: 'desc' }, { signal: ac.signal })
          if (Array.isArray(tasks)) {
            for (const t of tasks) {
              const b = bucketForStatus((t as any)?.status ?? (t as any)?.state ?? (t as any)?.phase ?? (t as any)?.result)
              if (b) next[b]++
            }
            loaded = true
          }
        } catch (e) {
          if ((import.meta as any)?.env?.DEV) {
             
            console.debug('[useTasksCounts] by-session aggregate failed, falling back to per-status', e)
          }
          // fall through to per-status queries
        }

        if (!loaded) {
          // Fallback: query each status explicitly via by-session endpoint
          const statuses = ['Queued', 'In Progress', 'Done', 'Stuck'] as const
          const results = await Promise.all(
            statuses.map(async (status) => {
              try {
                const { tasks } = await client.tasksListBySession(
                  { sessionId, status, limit: 1000, order: 'desc' },
                  { signal: ac.signal }
                )
                return Array.isArray(tasks) ? tasks.length : 0
              } catch (err) {
                if ((import.meta as any)?.env?.DEV) {
                   
                  console.debug('[useTasksCounts] per-status request failed', { status, err })
                }
                return 0
              }
            })
          )
          next = { queued: results[0], inProgress: results[1], done: results[2], stuck: results[3] }
        }

        if (!cancelled) setCounts(next)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [sessionId, idToken, enabled, bump])

  return { counts, loading, error, reload }
}
