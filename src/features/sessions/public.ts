// Sessions feature barrel: session list, UI, scroll/polling utilities, and helpers

// Components (re-export via local wrappers)
export { SessionSidebar } from './components/SessionSidebar'
export { SessionDetail } from './components/SessionDetail'

// Hooks (re-export via local wrappers)
export { useSessionsList } from './hooks/useSessionsList'
export { useScrollHome } from './hooks/useScrollHome'
export { useSessionPolling } from './hooks/useSessionPolling'
export { useStickyScroll } from './hooks/useStickyScroll'

// Utils and mappers (re-export via local wrappers)
export { filterSessionsByQuery } from './utils/filterSessionsByQuery'
export { mapTopicInfoToSession } from './utils/mapTopicInfoToSession'

// Types (re-export via local wrapper)
export type { Session } from './types/session'