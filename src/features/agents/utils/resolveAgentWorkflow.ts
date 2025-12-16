import type { AgentRecord } from '../../../types/agent'

export type SessionLike = {
  agentId?: string | null
  // Optional: some callers may store a workflow key on the session; used as a fallback
  workflowName?: string | null
} | null | undefined

export function resolveAgentWorkflow(params: {
  pendingAgentId?: string | null
  session?: SessionLike
  agentsById?: Record<string, AgentRecord> | null | undefined
}): { agentId: string | null; workflowName: string | null } {
  const agentsById = params.agentsById || undefined
  const session = params.session || undefined

  const agentId = params.pendingAgentId ?? session?.agentId ?? null

  const fromAgent = (() => {
    if (!agentId || !agentsById) return null
    const rec = agentsById[agentId]
    const name = rec?.workflowName
    if (typeof name !== 'string') return null
    const trimmed = name.trim()
    return trimmed ? trimmed : null
  })()

  if (fromAgent) return { agentId, workflowName: fromAgent }

  const fallback = (() => {
    const name = session?.workflowName
    if (typeof name !== 'string') return null
    const trimmed = name.trim()
    return trimmed ? trimmed : null
  })()

  return { agentId, workflowName: fallback }
}
