import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAgentsApi } from '../../../hooks/useAgentsApi'
import type { AgentRecord } from '../../../types/agent'

export type SessionAgentConfig = {
  mapping: { sessionId: string; agentId: string } | null
  agent: AgentRecord | null
  workflowName: string | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useSessionAgentConfig(params: { idToken?: string | null; sessionId: string | null | undefined; enabled?: boolean }): SessionAgentConfig {
  const { idToken, sessionId, enabled = true } = params
  const [mapping, setMapping] = useState<SessionAgentConfig['mapping']>(null)
  const [agent, setAgent] = useState<AgentRecord | null>(null)
  const [workflowName, setWorkflowName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bump, setBump] = useState(0)

  const { getSessionAgentMapping, getAgentById, getAgentByName } = useAgentsApi({ idToken, enabled })

  const reload = useCallback(async () => {
    setBump((n) => n + 1)
  }, [])

  useEffect(() => {
    let aborted = false
    const ac = new AbortController()

    async function run() {
      if (!enabled || !sessionId) {
        setLoading(false)
        setError(null)
        setMapping(null)
        setAgent(null)
        setWorkflowName(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const map = await getSessionAgentMapping(sessionId)
        if (aborted || ac.signal.aborted) return

        let ag: AgentRecord | null = null
        if (map?.agentId) {
          ag = await getAgentById(map.agentId)
        }
        if (!ag) {
          // Fallback: agent named after session
          ag = await getAgentByName(sessionId)
        }
        if (aborted || ac.signal.aborted) return

        setMapping(map)
        setAgent(ag)
        setWorkflowName(ag?.workflowName ?? null)
      } catch (e: any) {
        if (aborted || ac.signal.aborted) return
        setError(e?.message || 'Failed to load session agent config')
        setMapping(null)
        setAgent(null)
        setWorkflowName(null)
      } finally {
        if (!aborted && !ac.signal.aborted) setLoading(false)
      }
    }

    run()

    return () => {
      aborted = true
      ac.abort()
    }
  }, [sessionId, idToken, enabled, getSessionAgentMapping, getAgentById, getAgentByName, bump])

  return useMemo(
    () => ({ mapping, agent, workflowName, loading, error, reload }),
    [mapping, agent, workflowName, loading, error, reload]
  )
}
