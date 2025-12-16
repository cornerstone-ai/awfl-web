import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeApiClient } from '../../../api/apiClient'
import type { UseWorkflowsListResult } from '../types'

export function useWorkflowsList(params: { idToken?: string | null; enabled?: boolean; location?: string | null }): UseWorkflowsListResult {
  const { idToken, enabled = true, location = null } = params || {}
  const [workflows, setWorkflows] = useState<string[]>([])
  // Show loading immediately when enabled flips true (pre-request)
  const [loading, setLoading] = useState<boolean>(!!enabled)
  const [error, setError] = useState<string | null>(null)
  const bumpRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  // When enabled becomes true, reflect loading state right away to avoid "No workflows" flash
  useEffect(() => {
    if (enabled) {
      setLoading(true)
      setError(null)
    }
  }, [enabled])

  const api = useMemo(() => makeApiClient({ idToken: idToken || undefined }), [idToken])

  const load = useCallback(async () => {
    if (!enabled) return
    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setError(null)
    try {
      const json = await api.listWorkflows(location ? { location } : undefined, { signal: ac.signal })
      let list: any = json
      // Accept shapes: { workflows: [...] }, { items: [...] }, or string[]
      if (list && typeof list === 'object') {
        if (Array.isArray(list.workflows)) list = list.workflows
        else if (Array.isArray(list.items)) list = list.items
      }
      if (!Array.isArray(list)) list = []

      const names: string[] = []
      for (const item of list) {
        try {
          if (typeof item === 'string') {
            names.push(item)
          } else if (item && typeof item === 'object') {
            // Prefer short id; fall back to name/fullName/workflow/slug
            const name = (item.id || item.name || item.fullName || item.workflow || item.slug) as any
            if (typeof name === 'string') names.push(name)
          }
        } catch {
          // swallow per-item mapping errors
        }
      }
      if (mountedRef.current) setWorkflows(names)
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      if (mountedRef.current) setError(e?.message || String(e))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [api, enabled, location])

  useEffect(() => {
    if (!enabled) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idToken, location, bumpRef.current])

  const reload = useCallback(() => {
    bumpRef.current++
    load()
  }, [load])

  return { workflows, loading, error, reload }
}
