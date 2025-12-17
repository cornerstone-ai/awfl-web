import { useEffect, useState } from 'react'
import type { Session } from '../types/session'
import { getWorkflowName } from '../utils/getWorkflowName'

export type NewSessionCreateInput = { agentId?: string | null; workflowName?: string | null }

function generateUuid() {
  try {
    // modern browsers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (globalThis as any).crypto?.randomUUID
    if (typeof g === 'function') return g()
  } catch {}
  // fallback
  const s: string[] = []
  const hex = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  for (let i = 0; i < hex.length; i++) {
    const c = hex[i]
    if (c === 'x' || c === 'y') {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      s.push(v.toString(16))
    } else {
      s.push(c)
    }
  }
  return s.join('')
}

export function useNewSessionCreation(params: {
  userId?: string | null
  projectId?: string | null
  // startWf(workflowName, { query }, { sessionId, agentId? })
  startWf: (workflowName: string, input: { query: string }, opts?: { sessionId?: string; agentId?: string }) => Promise<any>
  // minimal surface used from agents api
  agentsApi: {
    linkSessionAgent: (sessionId: string, agentId: string) => Promise<any>
    getAgentById: (agentId: string) => Promise<{ workflowName?: string | null } | null>
    listAgentTools: (name: string) => Promise<string[]>
    saveAgent: (input: { name: string; description: string; workflowName: string; tools: string[] }) => Promise<{ id?: string | null }>
  }
  autoStart?: boolean
}) {
  const { userId, projectId, startWf, agentsApi, autoStart = true } = params

  const [ephemeralSessions, setEphemeralSessions] = useState<Session[]>([])

  // Clear ephemeral sessions when user changes or project changes
  useEffect(() => {
    setEphemeralSessions([])
  }, [userId])
  useEffect(() => {
    if (projectId != null) setEphemeralSessions([])
  }, [projectId])

  async function createNewSession(input: NewSessionCreateInput = {}) {
    const { agentId, workflowName } = input
    const id = generateUuid()

    // Insert ephemeral session so it appears immediately in the sidebar
    const nowIso = new Date().toISOString()
    // Default title to sessionId (id)
    setEphemeralSessions(prev => [{ id, title: id, updatedAt: nowIso }, ...prev])

    try {
      // Prefer linking to an existing agent if explicitly selected
      if (agentId) {
        await agentsApi.linkSessionAgent(id, agentId)
        // Attempt to resolve agent's configured workflow for optional initial kick-off
        let wfName: string | null = null
        try {
          const ag = await agentsApi.getAgentById(agentId)
          wfName = (ag?.workflowName as string) || null
        } catch {
          wfName = null
        }
        // Fallback to session-derived workflow if agent does not declare one
        if (!wfName) wfName = getWorkflowName(id) || null
        if (autoStart && wfName) {
          await startWf(wfName, { query: '' }, { sessionId: id, agentId: agentId || undefined })
        }
        return { id, agentId, workflowName: wfName }
      }

      // If a workflow is selected, create a new agent (name autofilled from workflow) and link
      if (workflowName) {
        // Load default tools to persist with the newly created agent (backend does not add them automatically)
        let defaultTools: string[] = []
        try {
          // some implementations use a sentinel name like 'default' to fetch the base toolset
          defaultTools = await agentsApi.listAgentTools('default')
        } catch {
          defaultTools = []
        }
        const newAgent = await agentsApi.saveAgent({ name: workflowName, description: '', workflowName, tools: defaultTools })
        if (newAgent?.id) {
          await agentsApi.linkSessionAgent(id, newAgent.id)
          // Optionally kick off the selected workflow via the newly created agent
          if (autoStart) {
            await startWf(workflowName, { query: '' }, { sessionId: id, agentId: newAgent.id || undefined })
          }
          return { id, agentId: newAgent.id || null, workflowName }
        }
        // Could not create/link an agent; still return the intended workflowName for immediate use
        return { id, agentId: null, workflowName }
      }
    } catch (e) {
      // soft-fail; keep the ephemeral session so the user has an entry
      console.warn('Failed to set up agent/workflow execution for new session', e)
    }

    return { id }
  }

  return { ephemeralSessions, createNewSession }
}
