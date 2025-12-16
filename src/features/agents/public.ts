// Agents feature barrel: agent modal, API hook, and related types

export { AgentModal } from './AgentModal'
export { useAgentsApi } from '../../hooks/useAgentsApi'
export { useAgentModalController } from './hooks/useAgentModalController'
export { useSessionAgentConfig } from './hooks/useSessionAgentConfig'
export { useAgentsList } from './hooks/useAgentsList'

// New: reusable agent→workflow helpers
// - resolveAgentWorkflow: pure util to compute { agentId, workflowName } from pendingAgentId/session/agents map
// - useAgentWorkflowExecute: small hook composing agents list + useWorkflowExec; exposes execute() using the resolved workflow
export { resolveAgentWorkflow } from './utils/resolveAgentWorkflow'
export { useAgentWorkflowExecute } from './hooks/useAgentWorkflowExecute'
export type { SessionLike } from './utils/resolveAgentWorkflow'

// Types
export type { AgentRecord, AgentUpsertInput } from '../../types/agent'