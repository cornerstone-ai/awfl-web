import { useCallback, useEffect, useMemo, useState } from 'react'
import { makeApiClient } from '../../../api/apiClient'

export type ExecNode = {
  id: string
  parentId?: string | null
  // Optional timing metadata if backend supplies it
  start?: number | string | null
  end?: number | string | null
  [key: string]: any
}

export type UseExecTreesParams = {
  sessionId?: string | null
  execId?: string | null
  idToken?: string | null
  enabled?: boolean
}

export type UseExecTreesResult = {
  trees: ExecNode[]
  loading: boolean
  error: string | null
  reload: () => void
}

function normalizeExecNodes(input: any): ExecNode[] {
  const arr = Array.isArray(input) ? input : Array.isArray(input?.trees) ? input.trees : Array.isArray(input?.nodes) ? input.nodes : Array.isArray(input?.data) ? input.data : []
  const out: ExecNode[] = []
  for (const item of arr) {
    try {
      const id = (item?.id ?? item?.execId ?? item?.exec_id)
      if (!id) continue
      const parentId = item?.parentId ?? item?.parent_id ?? item?.parent ?? null
      const node: ExecNode = {
        ...(item || {}),
        id: String(id),
        parentId: parentId == null ? null : String(parentId),
      }
      out.push(node)
    } catch (e) {
      // skip bad item
       
      console.warn('normalizeExecNodes: skipped bad item', e)
    }
  }
  return out
}

export function useExecTrees(params: UseExecTreesParams): UseExecTreesResult {
  const { sessionId, execId, idToken, enabled = true } = params

  const [trees, setTrees] = useState<ExecNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bump, setBump] = useState(0)

  const reload = useCallback(() => setBump((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()

    async function load() {
      setError(null)

      const skipAuth = (import.meta as any)?.env?.VITE_SKIP_AUTH === '1'
      if (!enabled || (!sessionId && !execId) || (!idToken && !skipAuth)) {
        setTrees([])
        return
      }

      setLoading(true)
      try {
        const client = makeApiClient({ idToken: idToken ?? undefined, skipAuth })
        const body = { sessionId: sessionId ?? undefined, execId: execId ?? undefined, includeStatus: false }
        const json = await client.workflowsExecTree(body, { signal: ac.signal })
        const nodes = normalizeExecNodes(json)
        if (!cancelled) setTrees(nodes)
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
  }, [sessionId, execId, idToken, enabled, bump])

  // Ensure stable reference to trees array across rerenders unless content changes
  const stableTrees = useMemo(() => trees, [trees])

  return { trees: stableTrees, loading, error, reload }
}
