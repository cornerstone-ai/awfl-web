import { useCallback, useMemo, useState, type Ref, type FormEvent } from 'react'
import { SessionHeader } from '../../../components/sessions/SessionHeader'
import { SessionItemsView } from '../../../components/sessions/SessionItemsView'
import { ErrorBanner } from '../../../components/common/ErrorBanner'
import type { TaskRecord } from '../../../hooks/useTasksList'
import type { TaskStatus } from '../../tasks/public'

export interface SessionDetailProps {
  // Header
  title: string
  updatedAt?: number | string | Date | null
  counts?: Record<string, number> | null
  onTitleClick?: () => void
  onCountClick?: (status: TaskStatus) => void
  onAddTask?: () => void
  onEditAgent?: () => void
  activeStatus: TaskStatus | null
  onBack?: () => void

  // Items (messages/tasks)
  execError?: string | null
  wfError?: string | null
  running: boolean
  messages: any[]
  tasksError?: string | null
  loadingTasks: boolean
  sessionTasks?: TaskRecord[]
  onEditTask: (t: TaskRecord) => void
  onDeleteTask: (t: TaskRecord) => void
  assistantName?: string
  hideExecGutter?: boolean

  // Scrolling
  containerRef: Ref<HTMLDivElement | null>
  bottomRef?: Ref<HTMLDivElement | null>
  topRef?: Ref<HTMLDivElement | null>

  // Identity for collapse state persistence
  sessionId?: string | null
  idToken?: string | null

  // Prompt/workflow controls
  promptPlaceholder?: string
  promptDisabled?: boolean
  wfStatus?: string | null
  wfRunning?: boolean
  submitting?: boolean
  onSubmit: (text: string) => void | Promise<void>
  onStop: () => void | Promise<void>

  // Latest exec status error (e.g., when status === Failed)
  execStatusError?: string | null
}

export function SessionDetail(props: SessionDetailProps) {
  const {
    title,
    updatedAt,
    counts,
    onTitleClick,
    onCountClick,
    onAddTask,
    onEditAgent,
    activeStatus,
    onBack,
    execError,
    wfError,
    running,
    messages,
    tasksError,
    loadingTasks,
    sessionTasks,
    onEditTask,
    onDeleteTask,
    assistantName,
    hideExecGutter,
    containerRef,
    bottomRef,
    topRef,
    sessionId,
    idToken,
    promptPlaceholder,
    promptDisabled,
    wfStatus,
    wfRunning,
    submitting,
    onSubmit,
    onStop,
    execStatusError,
  } = props

  const [text, setText] = useState('')

  // Rolling avg $/hr computed over the loaded messages window (SegKala: default 60m).
  // Span is based ONLY on messages that have a defined cost; summary/other messages
  // without cost are ignored for both total and span.
  const avgUsdPerHourText = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return null
    let total = 0
    let minTs: number | null = null
    let maxTs: number | null = null
    let counted = 0

    for (const m of messages) {
      const rawCost: any = (m as any)?.cost
      const c = typeof rawCost === 'number' ? rawCost : typeof rawCost === 'string' ? parseFloat(rawCost) : NaN
      if (!isFinite(c)) continue // ignore messages without cost

      const ct: any = (m as any)?.create_time
      let ts: number | null = null
      if (typeof ct === 'number' && isFinite(ct)) {
        ts = ct // seconds epoch
      } else if (typeof ct === 'string') {
        const ms = Date.parse(ct)
        if (isFinite(ms)) ts = Math.floor(ms / 1000)
      }

      if (ts == null) continue // require a timestamp for span and inclusion

      total += c
      counted += 1
      if (minTs == null || ts < minTs) minTs = ts
      if (maxTs == null || ts > maxTs) maxTs = ts
    }

    if (!(counted > 0 && minTs != null && maxTs != null)) return null
    const span = Math.max(0, maxTs - minTs)
    if (!(total > 0 && span > 0)) return null

    const ratePerHour = total / (span / 3600)
    try {
      const nf = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      return `${nf.format(ratePerHour)}/hr`
    } catch {
      return `$${ratePerHour.toFixed(2)}/hr`
    }
  }, [messages])

  // Allow submitting even while a submission is in flight or workflow is running; backend queues queries.
  const canSubmit = useMemo(() => {
    return !promptDisabled && (text?.trim()?.length ?? 0) > 0
  }, [promptDisabled, text])

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!canSubmit) return
      const payload = text.trim()
      setText('')
      await onSubmit(payload)
    },
    [canSubmit, onSubmit, text]
  )

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'stretch',
        minHeight: 0,
        maxWidth: '100%',
      }}
    >
      <SessionHeader
        title={title}
        updatedAt={updatedAt}
        counts={counts || undefined}
        activeStatus={activeStatus || undefined}
        onTitleClick={onTitleClick}
        onCountClick={onCountClick}
        onAddTask={onAddTask}
        onEditAgent={onEditAgent}
        avgUsdPerHourText={avgUsdPerHourText || undefined}
        onBack={onBack}
      />

      {execError ? (
        <ErrorBanner variant="strong">{execError}</ErrorBanner>
      ) : null}
      {wfError ? (
        <ErrorBanner style={{ marginTop: execError ? 4 : 0 }}>{wfError}</ErrorBanner>
      ) : null}

      <SessionItemsView
        activeTaskStatus={activeStatus}
        tasksError={tasksError}
        loadingTasks={loadingTasks}
        sessionTasks={sessionTasks}
        onEditTask={onEditTask}
        onDeleteTask={onDeleteTask}
        messages={messages}
        running={running}
        execError={execError}
        assistantName={assistantName}
        hideExecGutter={hideExecGutter}
        containerRef={containerRef}
        bottomRef={bottomRef}
        topRef={topRef}
        sessionId={sessionId || undefined}
        idToken={idToken || undefined}
      />

      {/* Latest exec status error banner (e.g., when status === Failed) */}
      {execStatusError ? (
        <ErrorBanner variant="strong">{execStatusError}</ErrorBanner>
      ) : null}

      {/* Prompt composer */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder={promptPlaceholder || 'Type a prompt…'}
            disabled={!!promptDisabled}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 8,
              border: '1px solid #d1d5db',
              padding: '8px 10px',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                // let form handler manage submit; avoid adding newline
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              borderRadius: 8,
              border: '1px solid #10b981',
              background: canSubmit ? '#10b981' : '#a7f3d0',
              color: canSubmit ? 'white' : '#064e3b',
              padding: '8px 12px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
            aria-busy={submitting || undefined}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
          {wfRunning ? (
            <button
              type="button"
              onClick={() => onStop?.()}
              style={{
                borderRadius: 8,
                border: '1px solid #b91c1c',
                background: '#fee2e2',
                color: '#7f1d1d',
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Stop
            </button>
          ) : null}
          {!!wfStatus && (
            <span
              title="Workflow status"
              style={{
                fontSize: 12,
                color: '#111827',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 999,
                padding: '2px 8px',
                whiteSpace: 'nowrap',
                alignSelf: 'center',
              }}
            >
              {wfStatus}
            </span>
          )}
        </div>
      </form>
    </section>
  )
}
