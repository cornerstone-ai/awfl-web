import { useEffect, useRef, useState } from 'react'
import { useAgentsApi } from '../../agents/public'

export type NewSessionAgent = {
  id: string
  name: string
}

export function useNewSessionAgents(params: { idToken?: string | null; enabled?: boolean }) {
  const { idToken, enabled = true } = params || {}
  const api = useAgentsApi({ idToken, enabled })

  const [agents, setAgents] = useState<NewSessionAgent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bumpRef = useRef(0)
  const [bump, setBump] = useState(0)

  const reload = () => {
    bumpRef.current++
    setBump(bumpRef.current)
  }

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
        const mapped: NewSessionAgent[] = Array.isArray(items)
          ? items.map((a) => ({ id: a.id, name: a.name }))
          : []
        setAgents(mapped)
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
