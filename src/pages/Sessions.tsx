import { useMemo, useState, useRef } from 'react'
import { useAuth } from '../auth/AuthProvider'

// Components
import { SessionSidebar, SessionDetail, useSessionSelection, filterSessionsByQuery, mapTopicInfoToSession, getWorkflowName } from '../features/sessions/public'
import { TaskModal } from '../features/tasks/public'
import { AgentModal, useAgentModalController } from '../features/agents/public'
import { SidebarNav } from '../features/sidebar/public'
import { FileSystemSidebar } from '../features/filesystem/public'
import { FileEditorModal, useFileEditorController } from '../features/fileviewer/public'

// Types
import type { Session } from '../features/sessions/public'

// Hooks
import { useSessionsList } from '../features/sessions/public'
import { useTopicContextYoj } from '../features/yoj/public'
import { useWorkflowExec, useDebouncedValue, useSessionPolling } from '../core/public'
import { useTasksCounts, useSessionTasks } from '../features/tasks/public'
import { usePlainify } from '../features/plain/public'
import { useWorkspaceId, useProjectId } from '../features/workspace/public'
import { useStickyScroll } from '../features/sessions/public'

const mockSessions: Session[] = []

export default function Sessions() {
  const { idToken, user } = useAuth()
  const [query, setQuery] = useState('')
  const [leftPanel, setLeftPanel] = useState<'sessions' | 'fs'>('sessions')

  // Load sessions via hook
  const { sessions, loading: loadingList, error: listError } = useSessionsList({
    userId: user?.uid,
    idToken,
    field: 'update_time',
    order: 'desc',
    start: 0,
    end: 4102444800,
    mapDocToSession: mapTopicInfoToSession,
  })

  // If auth is missing, clear selection
  useEffect(() => {
    if (!idToken || !user?.uid) {
      setSelectedId(null)
    }
  }, [idToken, user?.uid])

  // Initialize/reset selection when sessions change
  useEffect(() => {
    if (!selectedId && sessions.length) {
      setSelectedId(sessions[0].id)
    } else if (selectedId && sessions.length && !sessions.find(s => s.id === selectedId)) {
      // Previously selected session is no longer present; select first
      setSelectedId(sessions[0].id)
    }
  }, [sessions, selectedId])

  const sourceSessions = sessions.length ? sessions : mockSessions

  // Debounce query to reduce recomputation during fast typing
  const debouncedQuery = useDebouncedValue(query, 200)

  // Filter sessions using shared helper
  const filtered = useMemo(() => filterSessionsByQuery(sourceSessions, debouncedQuery), [sourceSessions, debouncedQuery])

  // Selection lifecycle encapsulated in feature hook
  const { selectedId, setSelectedId, selected } = useSessionSelection({
    sessions,
    filtered,
    userId: user?.uid,
    idToken,
  })

  // Compute workflow name based on session and env
  const workflowName = getWorkflowName(selected?.id)

  // Resolve workspace (project/session scoped)
  const projectId = useProjectId()
  const { data: workspaceId } = useWorkspaceId({
    projectId,
    sessionId: selected?.id,
    idToken,
    enabled: !!selected?.id && !!projectId,
  })

  // Single shared workflow exec hook for this page
  const { status: wfStatus, running: wfRunning, error: wfError, start: startWf, stop: stopWf } = useWorkflowExec({
    sessionId: selected?.id,
    idToken,
    enabled: !!selected,
  })

  // Task counts for selected session
  const { counts: taskCounts, reload: reloadTaskCounts } = useTasksCounts({
    sessionId: selected?.id,
    idToken,
    enabled: !!selected,
  })

  // Session tasks logic (status selection, inline list, modal CRUD)
  const {
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
  } = useSessionTasks({
    sessionId: selected?.id,
    idToken,
    workflowName,
    startWf,
    enabled: !!selected,
    reloadTaskCounts,
  })

  // Topic context messages for selected session (disabled while viewing tasks)
  const { messages, running, error: execError, reload } = useTopicContextYoj({
    sessionId: selected?.id,
    idToken,
    windowSeconds: 3600,
    enabled: !!selected && !activeTaskStatus,
  })

  // Scroll container/anchor refs
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const topRef = useRef<HTMLDivElement | null>(null)

  // Sticky scroll: bottom for messages, top for tasks
  const stickTo: 'top' | 'bottom' = activeTaskStatus ? 'top' : 'bottom'

  // Identify the tail for autoscroll triggers
  const viewKey = `${selected?.id || 'none'}:${activeTaskStatus ? `tasks:${activeTaskStatus}` : 'messages'}`
  const tailKey = useMemo(() => {
    if (activeTaskStatus) {
      const first = sessionTasks && sessionTasks.length > 0 ? sessionTasks[0] : null
      const k = first?.id || (first?.updatedAt as any) || (first?.createdAt as any)
      return `${viewKey}:top:${k ?? 'none'}:${sessionTasks?.length || 0}`
    } else {
      const last = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null
      const id = (last as any)?.id || (last as any)?.name || (last as any)?.uid
      const ts = (last as any)?.create_time || (last as any)?.timestamp || (last as any)?.time
      return `${viewKey}:bottom:${id ?? ts ?? 'none'}:${messages?.length || 0}`
    }
  }, [activeTaskStatus, sessionTasks, messages, viewKey])

  useStickyScroll({
    containerRef: scrollRef,
    bottomRef: bottomRef,
    topRef: topRef,
    tailKey,
    stickTo,
    enabled: !!selected,
    key: viewKey,
    threshold: 8,
  })

  // Plainify: encapsulated hook
  const {
    pendingCount: plainifyPending,
    plainify: handleFsPlainify,
    errorCount: plainifyErrorCount,
    dismissErrors: handlePlainifyDismissErrors,
  } = usePlainify({
    sessionId: selected?.id,
    idToken,
    enabled: !!selected,
  })

  const [submitting, setSubmitting] = useState(false)

  async function handlePromptSubmit(text: string) {
    if (!workflowName) return
    try {
      setSubmitting(true)
      await startWf(workflowName, { query: text })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStop() {
    try {
      await stopWf({ includeDescendants: true, workflow: workflowName || undefined })
    } catch {}
  }

  // Encapsulated polling for messages/tasks and counts
  useSessionPolling({
    enabled: !!selected?.id,
    sessionId: selected?.id,
    activeTaskStatus,
    running: !!running,
    reloadMessages: reload,
    reloadTaskCounts,
    reloadInlineTasks: reloadTasks,
    intervalMs: 1500,
  })

  // Agent modal controller (encapsulated in features/agents)
  const agent = useAgentModalController({
    idToken,
    sessionId: selected?.id || null,
    workflowName: workflowName || null,
    enabled: !!selected,
  })

  // File editor controller (encapsulated in features/fileviewer)
  const fileEditor = useFileEditorController({ idToken, enabled: !!selected, sessionId: selected?.id || null })

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        boxSizing: 'border-box',
        minHeight: 0,
        overflow: 'hidden',
        overflowX: 'hidden',
        padding: 16,
        gap: 16,
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <SidebarNav
          items={[
            { key: 'sessions', label: 'S', title: 'Sessions' },
            { key: 'fs', label: 'F', title: 'Filesystem' },
          ]}
          selectedKey={leftPanel}
          onSelect={(key: string) => setLeftPanel(key === 'fs' ? 'fs' : 'sessions')}
        />
        <div
          style={{
            height: '100%',
            minHeight: 0,
            overflow: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          {leftPanel === 'sessions' ? (
            <SessionSidebar
              sessions={filtered}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id)
                setActiveTaskStatus(null)
              }}
              loading={loadingList}
              error={listError}
              query={query}
              onQueryChange={setQuery}
            />
          ) : (
            <FileSystemSidebar
              sessionId={selected?.id}
              idToken={idToken}
              pendingCount={plainifyPending}
              errorCount={plainifyErrorCount}
              onDismissError={handlePlainifyDismissErrors}
              onPlainify={handleFsPlainify}
              onOpenFile={fileEditor.open}
            />
          )}
        </div>
      </div>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'stretch',
          overflow: 'hidden',
          maxWidth: '100%',
        }}
      >
        {!selected ? (
          <div style={{ color: '#6b7280', textAlign: 'left' }}>Select a session to view details.</div>
        ) : (
          <SessionDetail
            title={selected.title}
            updatedAt={selected.updatedAt}
            counts={taskCounts || undefined}
            onTitleClick={activeTaskStatus ? () => setActiveTaskStatus(null) : undefined}
            onCountClick={(status) => setActiveTaskStatus(status)}
            activeStatus={activeTaskStatus}
            onAddTask={openAddTask}
            onEditAgent={agent.openEdit}
            execError={execError}
            wfError={wfError}
            running={running}
            messages={messages as any}
            tasksError={tasksError}
            loadingTasks={loadingTasks}
            sessionTasks={sessionTasks}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            containerRef={scrollRef}
            bottomRef={bottomRef}
            topRef={topRef}
            // Identity for collapse state persistence
            sessionId={selected.id}
            idToken={idToken}
            promptPlaceholder={workflowName ? `Trigger workflow ${workflowName}…` : 'Select a session to trigger workflow'}
            wfStatus={wfStatus}
            wfRunning={wfRunning}
            submitting={submitting}
            onSubmit={handlePromptSubmit}
            onStop={handleStop}
            promptDisabled={!selected}
          />
        )}
      </main>

      <TaskModal
        open={taskModalOpen}
        mode={taskModalMode}
        initial={editingTask ?? undefined}
        onClose={closeTaskModal}
        onSave={handleSaveTask}
      />

      <AgentModal
        open={agent.open}
        mode={agent.mode}
        initial={agent.initial || { name: selected?.id || '', description: '', workflowName: workflowName || '', tools: [] }}
        tools={agent.tools}
        onClose={() => agent.setOpen(false)}
        onSave={agent.onSave}
      />

      <FileEditorModal
        open={fileEditor.opened}
        path={fileEditor.path || undefined}
        onClose={fileEditor.close}
        load={fileEditor.load}
        onSave={fileEditor.save}
        readOnly={false}
      />
    </div>
  )
}
