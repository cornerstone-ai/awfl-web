import { useMemo, useState, useRef, useEffect } from 'react'
import { useAuth } from '../auth/AuthProvider'

// Components & hooks from features
import {
  SessionSidebar,
  SessionDetail,
  useSessionSelection,
  filterSessionsByQuery,
  mapTopicInfoToSession,
  getWorkflowName,
  NewSessionModal,
  useNewSessionAgents,
  useNewSessionCreation,
  mergeSessions,
} from '../features/sessions/public'
import { TaskModal } from '../features/tasks/public'
import { AgentModal, useAgentModalController, useSessionAgentConfig, useAgentsApi, useAgentWorkflowExecute } from '../features/agents/public'
import { SidebarNav } from '../features/sidebar/public'
import { FileSystemSidebar } from '../features/filesystem/public'
import { FileEditorModal, useFileEditorController } from '../features/fileviewer/public'
import { useWorkflowsList } from '../features/workflows/public'

// Types
import type { Session } from '../features/sessions/public'

// Hooks
import { useSessionsList } from '../features/sessions/public'
import { useTopicContextYoj } from '../features/yoj/public'
import { useWorkflowExec, useDebouncedValue, useSessionPolling } from '../core/public'
import { useTasksCounts, useSessionTasks } from '../features/tasks/public'
import { usePlainify } from '../features/plain/public'
import { useScrollHome} from '../features/sessions/public'

export default function Sessions(props: { projectId?: string | null } = {}) {
  const { projectId = null } = props
  const { idToken, user } = useAuth()
  const [query, setQuery] = useState('')
  const [leftPanel, setLeftPanel] = useState<'sessions' | 'fs'>('sessions')

  // New Session modal state
  const [newOpen, setNewOpen] = useState(false)
  const { agents: newAgents, loading: newAgentsLoading, error: newAgentsError } = useNewSessionAgents({ idToken, enabled: newOpen })
  const { workflows, loading: workflowsLoading, error: workflowsError } = useWorkflowsList({ idToken, enabled: newOpen })
  const agentsApi = useAgentsApi({ idToken })

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
  const { sessions, loading: loadingList, error: listError, reload: reloadSessions } = useSessionsList({
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

  // startWf ref indirection so we can provide it to new-session creation before exec hook is ready
  const startWfRef = useRef<(
    workflowName: string,
    input: { query: string },
    opts?: { sessionId?: string; agentId?: string }
  ) => Promise<any>>(() => Promise.resolve(undefined))

  // Use new session creation hook (manages ephemeral sessions, agent linking, optional kickoff)
  const { ephemeralSessions, createNewSession } = useNewSessionCreation({
    userId: user?.uid || null,
    projectId,
    // delegate to the ref (will be populated after exec hook mounts); autostart disabled here
    startWf: (workflowName, input, opts) => startWfRef.current(workflowName, input, opts),
    agentsApi,
    autoStart: false,
  })

  // Merge ephemeral + server sessions via shared utility
  const mergedSessions = useMemo<Session[]>(() => mergeSessions(sessions, ephemeralSessions), [sessions, ephemeralSessions])

  // Filter sessions using shared helper
  const filtered = useMemo(() => filterSessionsByQuery(mergedSessions, debouncedQuery), [mergedSessions, debouncedQuery])

  // Single selection state resolved against merged + filtered lists
  const { selectedId, setSelectedId, selected: sel } = useSessionSelection({
    sessions: mergedSessions,
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

  // Track the most recently created session's agent + workflow to avoid falling back to sessionId workflow before config loads
  const [pendingNew, setPendingNew] = useState<{ sessionId: string; agentId?: string | null; workflowName?: string | null } | null>(null)
  // Clear pending if selection moves to a different session
  useEffect(() => {
    if (!sel?.id) {
      setPendingNew(null)
      return
    }
    if (pendingNew && pendingNew.sessionId !== sel.id) {
      setPendingNew(null)
    }
  }, [sel?.id])

  // Server-backed session agent config (single source of truth for agent + workflow)
  const agentConfig = useSessionAgentConfig({ idToken, sessionId: sel?.id, enabled: !!sel })

  // Compute pending hints and session-like fallback
  const pendingAgentForSel = sel?.id && pendingNew?.sessionId === sel.id ? pendingNew?.agentId ?? null : null
  const pendingWfForSel = sel?.id && pendingNew?.sessionId === sel.id ? pendingNew?.workflowName ?? null : null
  const sessionWorkflowName = getWorkflowName(sel?.id)

  const sessionLike = useMemo(() => ({
    agentId: agentConfig.mapping?.agentId ?? null,
    workflowName: agentConfig.workflowName || pendingWfForSel || sessionWorkflowName || null,
  }), [agentConfig.mapping?.agentId, agentConfig.workflowName, pendingWfForSel, sessionWorkflowName])

  // Resolve effective agent/workflow and provide execution helpers via agents feature
  const awx = useAgentWorkflowExecute({
    sessionId: sel?.id,
    idToken,
    enabled: !!sel,
    pendingAgentId: pendingAgentForSel,
    session: sessionLike,
  })

  const effectiveWorkflowName = awx.workflowName || null
  const effectiveAgentId = awx.agentId || null

  // Single shared workflow exec for arbitrary workflow names (used by tasks + new-session hook)
  const genericExec = useWorkflowExec({
    sessionId: sel?.id,
    idToken,
    enabled: !!sel,
    agentId: effectiveAgentId || null,
  })

  // Keep a ref of the current selected session id to avoid stale captures in handlers
  const currentSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    currentSessionIdRef.current = sel?.id || null
  }, [sel?.id])

  // Populate startWfRef with the real implementation once available
  useEffect(() => {
    startWfRef.current = (workflowName: string, input: { query: string }, opts?: { sessionId?: string; agentId?: string }) => {
      const sid = opts?.sessionId ?? currentSessionIdRef.current ?? undefined
      return genericExec.start(
        workflowName,
        { query: input?.query ?? '' },
        { ...opts, sessionId: sid }
      )
    }
  }, [genericExec.start])

  // Agent modal controller (encapsulated in features/agents)
  const agent = useAgentModalController({
    idToken,
    sessionId: sel?.id || null,
    workflowName: sessionWorkflowName || null,
    enabled: !!sel,
  })

  // Assistant label: prefer configured agent name; fallback to "Assistant"
  const assistantName = (agentConfig.agent?.name?.trim?.() || '').trim() || 'Assistant'

  // Task counts for selected session
  const { counts: taskCounts, reload: reloadTaskCounts } = useTasksCounts({
    sessionId: sel?.id,
    idToken,
    enabled: !!sel,
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
    sessionId: sel?.id,
    idToken,
    workflowName: effectiveWorkflowName || undefined,
    startWf: (wf: string, payload: Record<string, any>) => startWfRef.current(wf, { query: (payload as any)?.query ?? '' }, { agentId: effectiveAgentId || undefined }),
    enabled: !!sel,
    reloadTaskCounts,
  })

  // Topic context messages for selected session (disabled while viewing tasks)
  const { messages, running, error: execError, reload } = useTopicContextYoj({
    sessionId: sel?.id,
    idToken,
    windowSeconds: 3600,
    enabled: !!sel && !activeTaskStatus,
  })

  // Derive latest exec error when latest status is Failed
  const execStatusError = awx.status === 'Failed' ? (awx.latest?.error || 'Execution failed') : null

  // Scroll container/anchor refs
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const topRef = useRef<HTMLDivElement | null>(null)

  // Reusable auto-scroll behavior with "home" detection:
  const home: 'top' | 'bottom' = activeTaskStatus ? 'top' : 'bottom'
  const itemCount = activeTaskStatus ? (sessionTasks?.length || 0) : (messages?.length || 0)
  const viewKey = `${sel?.id || 'none'}:${activeTaskStatus ? `tasks:${activeTaskStatus}` : 'messages'}`

  useScrollHome({
    containerRef: scrollRef,
    anchorRef: home === 'bottom' ? bottomRef : undefined,
    itemCount,
    home,
    enabled: !!sel,
    key: viewKey,
  })

  // Plainify: encapsulated hook
  const {
    pendingCount: plainifyPending,
    plainify: handleFsPlainify,
    errorCount: plainifyErrorCount,
    dismissErrors: handlePlainifyDismissErrors,
  } = usePlainify({
    sessionId: sel?.id,
    idToken,
    enabled: !!sel,
  })

  const [submitting, setSubmitting] = useState(false)

  async function handlePromptSubmit(text: string) {
    if (!effectiveWorkflowName) return
    try {
      setSubmitting(true)
      await awx.execute({ query: text })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStop() {
    try {
      await awx.stop({ includeDescendants: true, workflow: effectiveWorkflowName || undefined })
    } catch {}
  }

  // Timed polling to keep messages, tasks, counts, and session titles in sync
  useSessionPolling({
    enabled: !!sel?.id,
    sessionId: sel?.id,
    activeTaskStatus,
    running: !!running,
    reloadMessages: reload,
    reloadTaskCounts,
    reloadInlineTasks: reloadTasks,
    reloadSessions,
    intervalMs: 1500,
  })

  // File editor controller (encapsulated in features/fileviewer)
  const fileEditor = useFileEditorController({ idToken, enabled: !!sel, sessionId: sel?.id || null })

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
              sessions={filterSessionsByQuery(mergedSessions, debouncedQuery)}
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
              onCreateNew={() => setNewOpen(true)}
            />
          ) : (
            <FileSystemSidebar
              sessionId={sel?.id}
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
        {!sel ? (
          <div style={{ color: '#6b7280', textAlign: 'left' }}>Select a session to view details.</div>
        ) : (
          <SessionDetail
            title={sel.title}
            updatedAt={sel.updatedAt}
            counts={taskCounts || undefined}
            onTitleClick={activeTaskStatus ? () => setActiveTaskStatus(null) : undefined}
            onCountClick={(status) => setActiveTaskStatus(status)}
            activeStatus={activeTaskStatus}
            onAddTask={openAddTask}
            onEditAgent={agent.openEdit}
            execError={execError}
            wfError={awx.error}
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
            sessionId={sel.id}
            idToken={idToken}
            promptPlaceholder={effectiveWorkflowName ? `Trigger workflow ${effectiveWorkflowName}…` : 'Select a session to trigger workflow'}
            wfStatus={awx.status}
            wfRunning={awx.running}
            submitting={submitting}
            onSubmit={handlePromptSubmit}
            onStop={handleStop}
            promptDisabled={!sel}
            onBack={isMobile ? () => setPane('list') : undefined}
            assistantName={assistantName}
            hideExecGutter={isMobile}
            execStatusError={execStatusError}
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
        initial={agent.initial || { name: agentConfig.workflowName || sessionWorkflowName || '', description: '', workflowName: sessionWorkflowName || '', tools: [] }}
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

      <NewSessionModal
        open={newOpen}
        agents={newAgents}
        agentsLoading={newAgentsLoading}
        agentsError={newAgentsError}
        workflows={workflows}
        workflowsLoading={workflowsLoading}
        workflowsError={workflowsError}
        defaultAgentName={(useSessionAgentConfig({ idToken, sessionId: (mergedSessions[0] || null)?.id || null, enabled: newOpen && !!(mergedSessions[0] || null)?.id })).agent?.name || null}
        defaultWorkflowName={(useSessionAgentConfig({ idToken, sessionId: (mergedSessions[0] || null)?.id || null, enabled: newOpen && !!(mergedSessions[0] || null)?.id })).workflowName || getWorkflowName((mergedSessions[0] || null)?.id || '') || null}
        onClose={() => setNewOpen(false)}
        onCreate={async (input) => {
          const { id, agentId, workflowName } = await createNewSession(input)
          setSelectedId(id)
          setPendingNew({ sessionId: id, agentId: agentId ?? null, workflowName: workflowName ?? null })
          setActiveTaskStatus(null)
          setNewOpen(false)
          if (isMobile) setPane('detail')
        }}
      />
    </div>
  )
}
