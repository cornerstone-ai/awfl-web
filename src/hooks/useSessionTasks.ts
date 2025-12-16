import { useCallback, useEffect, useRef, useState } from 'react'
import { makeApiClient } from '../api/apiClient'
import { useTasksList, type TaskRecord } from './useTasksList'
import type { TaskStatus } from '../types/tasks'

function parseSkipAuth(): boolean {
  const raw = (import.meta as any)?.env?.VITE_SKIP_AUTH
  if (typeof raw === 'string') return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
  return !!raw
}

export type StartWfFn = (workflowName: string, payload: Record<string, any>) => Promise<any> | void

interface UseSessionTasksOptions {
  sessionId?: string | null
  idToken?: string | null
  workflowName?: string | null
  startWf?: StartWfFn
  enabled?: boolean
  // Called after create/update/delete to refresh counts in the header
  reloadTaskCounts?: () => void
}

export interface UseSessionTasksResult {
  // Status selection controlling inline list
  activeTaskStatus: TaskStatus | null
  setActiveTaskStatus: (s: TaskStatus | null) => void

  // Inline tasks list
  sessionTasks?: TaskRecord[]
  loadingTasks: boolean
  tasksError?: string | null
  reloadTasks: () => void

  // Task modal state/controls
  taskModalOpen: boolean
  taskModalMode: 'create' | 'edit'
  editingTask: TaskRecord | null
  openAddTask: () => void
  handleEditTask: (t: TaskRecord) => void
  closeTaskModal: () => void
  handleSaveTask: (input: { title?: string; description?: string; status?: string }) => Promise<void>
  handleDeleteTask: (t: TaskRecord) => Promise<void>
}

export function useSessionTasks({
  sessionId,
  idToken,
  workflowName,
  startWf,
  enabled = false,
  reloadTaskCounts,
}: UseSessionTasksOptions): UseSessionTasksResult {
  const [activeTaskStatus, setActiveTaskStatus] = useState<TaskStatus | null>(null)

  // Inline tasks list based on selected status
  const { tasks: sessionTasks, loading: loadingTasks, error: tasksError, reload: reloadTasks } = useTasksList({
    idToken: idToken ?? undefined,
    sessionId: sessionId ?? undefined,
    status: activeTaskStatus ?? undefined,
    enabled: !!enabled && !!sessionId && !!activeTaskStatus,
    limit: 500,
    order: 'desc',
  })

  // Reset status when session changes
  const lastSessionIdRef = useRef<string | null | undefined>(null)
  useEffect(() => {
    if (sessionId && lastSessionIdRef.current && lastSessionIdRef.current !== sessionId) {
      setActiveTaskStatus(null)
    }
    lastSessionIdRef.current = sessionId
  }, [sessionId])

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskModalMode, setTaskModalMode] = useState<'create' | 'edit'>('create')
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null)

  const openAddTask = useCallback(() => {
    setTaskModalMode('create')
    setEditingTask(null)
    setTaskModalOpen(true)
  }, [])

  const handleEditTask = useCallback((t: TaskRecord) => {
    setTaskModalMode('edit')
    setEditingTask(t)
    setTaskModalOpen(true)
  }, [])

  const closeTaskModal = useCallback(() => setTaskModalOpen(false), [])

  const skipAuth = parseSkipAuth()

  const handleDeleteTask = useCallback(async (t: TaskRecord) => {
    if (!t?.id) return
    const ok = window.confirm('Delete this task? This cannot be undone.')
    if (!ok) return
    const client = makeApiClient({ idToken: idToken ?? undefined, skipAuth })
    await client.taskDelete(t.id)
    // Refresh counts and inline tasks if visible
    reloadTaskCounts?.()
    if (activeTaskStatus) reloadTasks()
  }, [idToken, reloadTaskCounts, activeTaskStatus, reloadTasks, skipAuth])

  const handleSaveTask = useCallback(async (input: { title?: string; description?: string; status?: string }) => {
    const client = makeApiClient({ idToken: idToken ?? undefined, skipAuth })
    if (taskModalMode === 'create') {
      await client.taskCreate({ sessionId: sessionId ?? undefined, ...input })

      // Only trigger the workflow when a new task is created with status 'In Progress'.
      const shouldTrigger = ((input?.status ?? '').toString().trim() === 'In Progress')
      if (shouldTrigger && workflowName && startWf) {
        const queryParts = [
          'Proceed with the newly added task.',
          input?.title ? `Title: ${input.title}.` : '',
          input?.description ? `Description: ${input.description}.` : '',
          input?.status ? `Status: ${input.status}.` : '',
        ].filter(Boolean)
        const query = queryParts.join(' ')
        try {
          void startWf(workflowName, { query })
        } catch (e) {
          if (import.meta?.env?.DEV) {
             
            console.debug('[useSessionTasks] startWf after task create scheduling failed', e)
          }
        }
      }
    } else if (taskModalMode === 'edit' && editingTask?.id) {
      await client.taskUpdate({ id: editingTask.id, ...input })
      // Do not trigger workflow when editing a task
    }
    // Refresh counts and inline tasks if visible
    reloadTaskCounts?.()
    if (activeTaskStatus) reloadTasks()
    setTaskModalOpen(false)
  }, [idToken, taskModalMode, editingTask?.id, reloadTaskCounts, activeTaskStatus, reloadTasks, sessionId, workflowName, startWf, skipAuth])

  return {
    activeTaskStatus,
    setActiveTaskStatus,

    sessionTasks,
    loadingTasks,
    tasksError,
    reloadTasks,

    taskModalOpen,
    taskModalMode,
    editingTask,
    openAddTask,
    handleEditTask,
    closeTaskModal,
    handleSaveTask,
    handleDeleteTask,
  }
}
