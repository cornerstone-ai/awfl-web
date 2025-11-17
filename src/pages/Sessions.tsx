import { useMemo, useState, useRef, useEffect } from 'react'
import { useAuth } from '../auth/AuthProvider'

// Components
import { SessionSidebar, SessionDetail, useSessionSelection, filterSessionsByQuery, mapTopicInfoToSession, getWorkflowName } from '../features/sessions/public'
import { TaskModal } from '../features/tasks/public'
import { AgentModal, useAgentModalController, useSessionAgentConfig } from '../features/agents/public'
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
import { useScrollHome} from '../features/sessions/public'

const mockSessions: Session[] = []

export default function Sessions(props: { projectId?: string | null } = {}) {
  const { projectId = null } = props
  const { idToken, user } = useAuth()
  const [query, setQuery] = useState('')
  const [leftPanel, setLeftPanel] = useState<'sessions' | 'fs'>('sessions')

  // Mobile detection and pane state
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia('(max-width: 640px)').matches : false)
  useEffect(() => {
    if (!('matchMedia' in window)) return
    const mq = window.matchMedia('(max-width: 640px)')
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange)
    onChange()
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange)
    }
  }, [])
  const [pane, setPane] = useState<'list' | 'detail'>(isMobile ? 'list' : 'detail')
  useEffect(() => {
    setPane(isMobile ? 'list' : 'detail')
  }, [isMobile])

  // Load sessions via hook
  const { sessions, loading: loadingList, error: listError } = useSessionsList({
    userId: user?.uid,
    idToken,
    projectId,
    field: 'update_time',
    order: 'desc',
    start: 0,
    end: 4102444800,
    mapDocToSession: mapTopicInfoToSession,
  })

  // Debounce query to reduce recomputation during fast typing
  const debouncedQuery = useDebouncedValue(query, 200)

  const sourceSessions = sessions.length ? sessions : mockSessions

  // Filter sessions using shared helper
  const filtered = useMemo(() => filterSessionsByQuery(sourceSessions, debouncedQuery), [sourceSessions, debouncedQuery])

  // Selection lifecycle encapsulated in feature hook
  const { selectedId, setSelectedId, selected } = useSessionSelection({
    sessions,
    filtered,
    userId: user?.uid,
    idToken,
  })

  // If auth is missing, clear selection
  useEffect(() => {
    if (!idToken || !user?.uid) {
      setSelectedId(null)
    }
  }, [idToken, user?.uid, setSelectedId])

  // When project changes, clear selection immediately to avoid stale details flashing
  useEffect(() => {
    // Only clear if a projectId is provided (we avoid clearing on first mount when prop is undefined)
    if (projectId != null) setSelectedId(null)
  }, [projectId, setSelectedId])

  // When a selection changes on mobile, switch to detail; when cleared, switch to list
  useEffect(() => {
    if (!isMobile) return
    if (selectedId) setPane('detail')
    else setPane('list')
  }, [isMobile, selectedId])

  // Compute workflow name based on session and env
  const sessionWorkflowName = getWorkflowName(selected?.id)

  // Single shared workflow exec hook for this page
  const { status: wfStatus, running: wfRunning, error: wfError, start: startWf, stop: stopWf } = useWorkflowExec({
    sessionId: selected?.id,
    idToken,
    enabled: !!selected,
  })

  // Agent modal controller (encapsulated in features/agents)
  const agent = useAgentModalController({
    idToken,
    sessionId: selected?.id || null,
    workflowName: sessionWorkflowName || null,
    enabled: !!selected,
  })

  // Server-backed session agent config (single source of truth for agent + workflow)
  const agentConfig = useSessionAgentConfig({ idToken, sessionId: selected?.id, enabled: !!selected })

  // Effective workflow chosen from agent configuration, falling back to session-derived
  const effectiveWorkflowName = agentConfig.workflowName || sessionWorkflowName || null

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
    workflowName: effectiveWorkflowName || undefined,
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


  // Reusable auto-scroll behavior with "home" detection:
  const home: 'top' | 'bottom' = activeTaskStatus ? 'top' : 'bottom'
  const itemCount = activeTaskStatus ? (sessionTasks?.length || 0) : (messages?.length || 0)

  const viewKey = `${selected?.id || 'none'}:${activeTaskStatus ? `tasks:${activeTaskStatus}` : 'messages'}`

  useScrollHome({
    containerRef: scrollRef,
    anchorRef: home === 'bottom' ? bottomRef : undefined,
    itemCount,
    home,
    enabled: !!selected,
    key: viewKey,
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
    if (!effectiveWorkflowName) return
    try {
      setSubmitting(true)
      await startWf(effectiveWorkflowName, { query: text })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStop() {
    try {
      await stopWf({ includeDescendants: true, workflow: effectiveWorkflowName || undefined })
    } catch {}
  }

  // Disable timed polling; rely solely on event-driven refresh
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
          display: isMobile ? (pane === 'list' ? 'flex' : 'none') : 'flex',
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
                if (isMobile) setPane('detail')
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
          display: isMobile ? (pane === 'detail' ? 'flex' : 'none') : 'flex',
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
            promptPlaceholder={effectiveWorkflowName ? `Trigger workflow ${effectiveWorkflowName}…` : 'Select a session to trigger workflow'}
            wfStatus={wfStatus}
            wfRunning={wfRunning}
            submitting={submitting}
            onSubmit={handlePromptSubmit}
            onStop={handleStop}
            promptDisabled={!selected}
            onBack={isMobile ? () => setPane('list') : undefined}
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
        initial={agent.initial || { name: selected?.id || '', description: '', workflowName: sessionWorkflowName || '', tools: [] }}
        tools={agent.tools}
        workflows={agent.workflows}
        workflowsLoading={agent.workflowsLoading}
        onClose={() => agent.setOpen(false)}
        onSave={async (input) => {
          await agent.onSave(input)
          // Reload server-backed config so it reflects immediately and persists across reloads
          await agentConfig.reload()
        }}
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
