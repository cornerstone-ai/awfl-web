import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeApiClient } from '../api/apiClient'

export type LatestExecItem = {
  execId: string
  created?: number
  status?: string
  error?: string
  // other fields may be present
}

export type UseWorkflowExecParams = {
  sessionId?: string
  idToken?: string | null
  enabled?: boolean
  pollMs?: number
  // Optional agent context; when provided, executions will include this agentId
  agentId?: string | null
}

export type UseWorkflowExecResult = {
  latest: LatestExecItem | null
  status: string | null
  running: boolean
  error: string | null
  reload: () => void
  // Optional ctx allows overriding session/agent for one-shot starts (e.g., immediately after creating a new session)
  start: (
    workflowName: string,
    params?: Record<string, any>,
    ctx?: { sessionId?: string; agentId?: string }
  ) => Promise<void>
  stop: (opts?: { includeDescendants?: boolean; workflows?: string[]; workflow?: string }) => Promise<void>
}

function normalizeStatus(s?: string | null): string | null {
  if (!s) return null
  const u = String(s).trim()
  if (!u) return null
  return u.charAt(0).toUpperCase() + u.slice(1).toLowerCase()
}

export function useWorkflowExec(params: UseWorkflowExecParams): UseWorkflowExecResult {
  const { sessionId, idToken, enabled = true, pollMs = 8000, agentId: hookAgentId } = params

  const [latest, setLatest] = useState<LatestExecItem | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, setLoading] = useState(false)
  const bump = useRef(0)

  const skipAuth = (import.meta as any)?.env?.VITE_SKIP_AUTH === '1'

  const reload = useCallback(() => {
    bump.current++
  }, [])

  const client = useMemo(() => makeApiClient({ idToken: idToken ?? undefined, skipAuth }), [idToken, skipAuth])

  // Reset only on identity/enable changes
  useEffect(() => {
    // When the selected session or enabled flag changes, clear preserved states
    if (!enabled || !sessionId) {
      setLatest(null)
      setStatus(null)
      setError(null)
    }
  }, [sessionId, enabled])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()

    async function fetchLatest() {
      setError(null)
      if (!enabled || !sessionId || (!idToken && !skipAuth)) {
        // Do not fetch when disabled; reset is handled by the sessionId/enabled effect
        return
      }
      setLoading(true)
      try {
        const json: any = await client.workflowsStatusLatest(sessionId, 1, { signal: ac.signal })
        const item = Array.isArray(json?.items) && json.items.length > 0 ? json.items[0] : null
        if (cancelled) return
        if (item) {
          // Update latest when we have an item
          setLatest(item)
          // Update status only when defined & non-empty
          const ns = normalizeStatus(item.status)
          if (ns) setStatus(ns)
        } else {
          // No items returned: preserve prior latest/status to avoid UI flicker
        }
      } catch (e: any) {
        // 404 or transient errors: surface error but preserve last known latest/status
        const msg = e?.message || String(e)
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchLatest()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [sessionId, idToken, enabled, client, bump.current])

  // Polling
  useEffect(() => {
    if (!enabled || !sessionId) return
    const t = setInterval(() => {
      reload()
    }, pollMs)
    return () => clearInterval(t)
  }, [enabled, sessionId, pollMs, reload])

  const running = status === 'Running'

  const start = useCallback(
    async (
      workflowName: string,
      params?: Record<string, any>,
      ctx?: { sessionId?: string; agentId?: string }
    ) => {
      const sId = ctx?.sessionId || sessionId
      if (!sId) return
      setError(null)
      // Prefer agentId provided via ctx, else from hook param, else from params
      const aId = ctx?.agentId || hookAgentId || (params as any)?.agentId

      // Defensively normalize params: require query and drop unsupported fields like `reason`
      const rawParams = { ...(params || {}) }
      if ('reason' in rawParams) delete (rawParams as any).reason
      const modelValue = rawParams?.model ?? 'gpt-5'
      const fundValue = rawParams?.fund ?? 1
      const finalParams = {
        ...rawParams,
        query: typeof rawParams?.query === 'string' ? rawParams.query : '',
        model: modelValue,
        fund: fundValue,
      }

      // Inject session/agent context into params per API contract; do not send at top-level
      const execParams = {
        ...finalParams,
        sessionId: sId,
        ...(aId ? { agentId: aId } : {}),
      }

      client
        .workflowsExecute({
          workflowName,
          params: execParams,
        })
        .then(() => {
          reload()
        })
        .catch((e: any) => {
          setError(e?.message || String(e))
        })
    },
    [client, sessionId, hookAgentId, reload]
  )

  const stop = useCallback(
    async (opts?: { includeDescendants?: boolean; workflows?: string[]; workflow?: string }) => {
      setError(null)
      const execId = latest?.execId
      if (!execId) {
        setError('No execution to stop')
        return
      }
      try {
        await client.workflowsStop({
          execId,
          includeDescendants: opts?.includeDescendants ?? true,
          ...(opts?.workflow ? { workflow: opts.workflow } : {}),
          ...(Array.isArray(opts?.workflows) ? { workflows: opts!.workflows } : {}),
        })
        reload()
      } catch (e: any) {
        setError(e?.message || String(e))
      }
    },
    [client, latest?.execId, reload]
  )

  return { latest, status, running, error, reload, start, stop }
}
