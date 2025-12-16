// Projects feature public surface

export { useProjectsList } from './hooks/useProjectsList'
export { useProjectCreate } from './hooks/useProjectCreate'
export { NewProjectModal } from './components/NewProjectModal'
export type { Project } from './types/project'

// Project selection helpers (tab-specific via sessionStorage; cookie fallback)
export { getSelectedProjectId, setSelectedProjectId } from './utils/projectSelection'
