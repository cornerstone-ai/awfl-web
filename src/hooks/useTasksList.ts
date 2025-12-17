import { useCallback, useEffect, useMemo, useState } from 'react'
import { makeApiClient } from '../api/apiClient'

export type UseTasksListParams = {
  sessionId?: string | null
  status?: string | null
  idToken?: string | null
  enabled?: boolean
  limit?: number
  order?: 'asc' | 'desc'
}

export type TaskRecord = {
  id: string
  status?: string
  title?: string
  description?: string
  sessionId?: string
  createdAt?: string | number | Date | null
  updatedAt?: string | number | Date | null
  raw?: any
}

export type UseTasksListResult = {
  tasks: TaskRecord[]
  loading: boolean
  error: string | null
  reload: () => void
}

function parseSkipAuth(): boolean {
  const raw = (import.meta as any)?.env?.VITE_SKIP_AUTH
  if (typeof raw === 'string') return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
  return !!raw
}

function coerceDate(v: any): string | number | Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v === 'number') return v
  if (typeof v === 'string') return v
  if (v?._seconds) return v._seconds * 1000
  if (v?.seconds) return v.seconds * 1000
  return null
}

function mapAnyToTask(obj: any): TaskRecord | null {
  try {
    if (!obj || typeof obj !== 'object') return null
    const id = obj.id || obj.taskId || obj.task_id || obj.name || obj.uid || obj._id
    if (!id) return null
    const status = obj.status || obj.state || obj.phase || obj.result || obj.outcome
    const title = obj.title || obj.name || obj.summary || obj.description || (typeof obj.prompt === 'string' ? obj.prompt.slice(0, 80) : undefined)
    const description = obj.description || undefined
    const sessionId = obj.sessionId || obj.session_id || obj.topicId || obj.topic_id || obj.convoId || obj.convo_id
    const createdAt = coerceDate(obj.createdAt || obj.created_at || obj.create_time || obj.created || obj.start_time)
    const updatedAt = coerceDate(obj.updatedAt || obj.updated_at || obj.update_time || obj.updated || obj.end_time)
    return { id: String(id), status, title, description, sessionId, createdAt, updatedAt, raw: obj }
  } catch (e) {
    if ((import.meta as any)?.env?.DEV) {
       
      console.debug('[useTasksList] mapAnyToTask failed', e, obj)
    }
    return null
  }
}

export function useTasksList(params: UseTasksListParams): UseTasksListResult {
  const { sessionId, status, idToken, enabled = true, limit = 100, order = 'desc' } = params
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bump, setBump] = useState(0)

  const reload = useCallback(() => setBump((x) => x + 1), [])

  const skipAuth = useMemo(parseSkipAuth, [])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()

    async function load() {
      setError(null)
      if (!enabled || (!idToken && !skipAuth)) {
        if ((import.meta as any)?.env?.DEV) {
           
          console.debug('[useTasksList] skip load', { enabled, hasToken: !!idToken, skipAuth })
        }
        setTasks([])
        return
      }
      setLoading(true)
      try {
        const client = makeApiClient({ idToken: idToken ?? undefined, skipAuth })
        const q: any = { limit, order }
        if (sessionId) q.sessionId = sessionId
        const st = typeof status === 'string' && status.trim() ? status.trim() : undefined
        if (st && st.toLowerCase() !== 'all') q.status = st

        if ((import.meta as any)?.env?.DEV) {
           
          console.debug('[useTasksList] loading', q)
        }

        const { tasks: raw } = await client.tasksList(q, { signal: ac.signal })
        const mapped: TaskRecord[] = []
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const t = mapAnyToTask(item)
            if (t) mapped.push(t)
          }
        }
        if (!cancelled) setTasks(mapped)
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
  }, [sessionId, status, idToken, enabled, limit, order, bump, skipAuth])

  return { tasks, loading, error, reload }
}
