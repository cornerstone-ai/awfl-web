import { useEffect, useRef, type Ref } from 'react'
import { TasksList } from '../tasks/TasksList'
import { YojMessageList } from './YojMessageList'
import { ErrorBanner } from '../common/ErrorBanner'
import type { TaskRecord } from '../../hooks/useTasksList'
import type { TaskStatus } from '../../types/tasks'

interface SessionItemsViewProps {
  activeTaskStatus: TaskStatus | null
  // Tasks props
  tasksError?: string | null
  loadingTasks: boolean
  sessionTasks?: TaskRecord[]
  onEditTask: (t: TaskRecord) => void
  onDeleteTask: (t: TaskRecord) => void
  // Messages props
  messages: any[]
  running: boolean
  execError?: string | null
  assistantName?: string
  hideExecGutter?: boolean
  // Refs for scroll/anchor management
  containerRef: Ref<HTMLDivElement | null>
  bottomRef?: Ref<HTMLDivElement | null>
  topRef?: Ref<HTMLDivElement | null>
  // Identity for collapse state persistence
  sessionId?: string | null
  idToken?: string | null
}

export function SessionItemsView({
  activeTaskStatus,
  tasksError,
  loadingTasks,
  sessionTasks,
  onEditTask,
  onDeleteTask,
  messages,
  running,
  execError,
  assistantName,
  hideExecGutter,
  containerRef,
  bottomRef,
  topRef,
  sessionId,
  idToken,
}: SessionItemsViewProps) {
  const hasTasks = (sessionTasks?.length || 0) > 0

  // Show the loading indicator only once per status selection when there are no tasks yet.
  const initialLoadingShownRef = useRef(false)
  useEffect(() => {
    initialLoadingShownRef.current = false
  }, [activeTaskStatus])
  const showInitialLoading = !!activeTaskStatus && loadingTasks && !hasTasks && !initialLoadingShownRef.current
  useEffect(() => {
    if (showInitialLoading) initialLoadingShownRef.current = true
  }, [showInitialLoading])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        boxSizing: 'border-box',
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
        maxWidth: '100%',
        scrollbarGutter: 'stable',
      }}
    >
      <div
        style={{
          boxSizing: 'border-box',
          minWidth: 0,
          overflowX: 'hidden',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          width: '100%',
          maxWidth: '100%',
          hyphens: 'auto',
          padding: 12,
          display: 'block',
          margin: 0,
          alignSelf: 'stretch',
        }}
      >
        {/* Top sentinel for IO-less top stick detection */}
        <div ref={topRef as any} style={{ height: 1 }} />

        {activeTaskStatus ? (
          <div>
            {/* Visible mode switch header so first click is obvious */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  color: '#111827',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: 999,
                  padding: '2px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                Tasks • {activeTaskStatus}
              </span>
              {showInitialLoading ? (
                <span role="status" style={{ fontSize: 12, color: '#6b7280' }}>
                  Loading…
                </span>
              ) : null}
            </div>

            {tasksError ? (
              <ErrorBanner style={{ marginBottom: 8 }}>{tasksError}</ErrorBanner>
            ) : null}

            {/* Keep list mounted during background reloads to avoid flash and scroll reset */}
            {showInitialLoading ? (
              <div style={{ color: '#6b7280', textAlign: 'left' }}>Loading tasks…</div>
            ) : null}

            {hasTasks ? (
              <TasksList tasks={sessionTasks ?? []} onEdit={onEditTask} onDelete={onDeleteTask} />
            ) : null}

            {!loadingTasks && !hasTasks ? (
              <div style={{ color: '#6b7280', textAlign: 'left' }}>
                No tasks in “{activeTaskStatus}”.
              </div>
            ) : null}
          </div>
        ) : messages.length === 0 && !running && !execError ? (
          <div style={{ color: '#6b7280', textAlign: 'left' }}>No messages returned.</div>
        ) : (
          <YojMessageList
            messages={messages as any}
            sessionId={sessionId || undefined}
            idToken={idToken || undefined}
            assistantName={assistantName}
            hideExecGutter={hideExecGutter}
          />
        )}
        {/* Bottom sentinel for IO-driven near-bottom detection; disable overflow anchoring here */}
        <div ref={bottomRef as any} style={{ height: 1, overflowAnchor: 'none' as any }} />
      </div>
    </div>
  )
}
