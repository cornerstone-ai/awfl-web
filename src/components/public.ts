// Public surface for UI components (presentational only)
// Import from this module in pages/hooks instead of deep relative paths.

export { SessionSidebar } from './sessions'
export { SessionDetails as SessionDetail } from './sessions'
export { SessionHeader } from './sessions/SessionHeader'
export { YojMessageList } from './sessions/YojMessageList'

export { TaskModal } from './tasks/TaskModal'
// Legacy AgentModal export removed; use features/agents/public instead

export { ErrorBanner } from './common/ErrorBanner'
export { Collapsible } from './common/Collapsible'
export { Chevrons } from './common/Chevrons'

export { PromptInput } from './PromptInput'