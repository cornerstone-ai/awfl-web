// Agents feature barrel: agent modal, API hook, and related types

export { AgentModal } from './AgentModal'
export { useAgentsApi } from '../../hooks/useAgentsApi'
export { useAgentModalController } from './hooks/useAgentModalController'
export { useSessionAgentConfig } from './hooks/useSessionAgentConfig'

// Types
export type { AgentRecord, AgentUpsertInput } from '../../types/agent'