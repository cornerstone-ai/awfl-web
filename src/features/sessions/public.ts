// Sessions feature barrel: session list, UI, scroll/polling utilities, and helpers

// Components (re-export via local wrappers)
export { SessionSidebar } from './components/SessionSidebar.tsx'
export { SessionDetail } from './components/SessionDetail'
export { NewSessionModal } from './components/NewSessionModal'

// Hooks (re-export via local wrappers)
export { useSessionsList } from './hooks/useSessionsList'
export { useScrollHome } from './hooks/useScrollHome'
export { useSessionPolling } from './hooks/useSessionPolling'
export { useSessionSelection } from './hooks/useSessionSelection'
export { useNewSessionAgents } from './hooks/useNewSessionAgents'
export { useNewSessionCreation } from './hooks/useNewSessionCreation'

// Utils and mappers (re-export via local wrappers)
export { filterSessionsByQuery } from './utils/filterSessionsByQuery'
export { mapTopicInfoToSession } from './utils/mapTopicInfoToSession'
export { getWorkflowName } from './utils/getWorkflowName'
export { mergeSessions } from './utils/mergeSessions'

// Types (re-export via local wrapper)
export type { Session } from './types/session'