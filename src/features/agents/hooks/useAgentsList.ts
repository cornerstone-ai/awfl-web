import { useEffect, useRef, useState } from 'react'
import { useAgentsApi } from '../../../hooks/useAgentsApi'
import type { AgentRecord } from '../../../types/agent'

export function useAgentsList(params: { idToken?: string | null; enabled?: boolean }) {
  const { idToken, enabled = true } = params || {}
  const api = useAgentsApi({ idToken, enabled })

  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bumpRef = useRef(0)

  const reload = () => {
    bumpRef.current++
    // trigger effect below
    setBump(bumpRef.current)
  }

  const [bump, setBump] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let aborted = false
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    api
      .listAgents()
      .then((items) => {
        if (aborted) return
        setAgents(Array.isArray(items) ? items : [])
      })
      .catch((e) => {
        if (aborted) return
        setError(e?.message || 'Failed to load agents')
      })
      .finally(() => {
        if (aborted) return
        setLoading(false)
      })
    return () => {
      aborted = true
      ac.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idToken, bump])

  return { agents, loading, error, reload }
}
