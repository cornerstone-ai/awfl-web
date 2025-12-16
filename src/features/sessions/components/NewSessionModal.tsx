import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { WorkflowSelector } from '../../workflows/public'

export type NewSessionAgent = { id: string; name: string }

export type NewSessionCreateInput = {
  agentId?: string | null
  workflowName?: string | null
}

export type NewSessionModalProps = {
  open: boolean
  agents: NewSessionAgent[]
  agentsLoading?: boolean
  agentsError?: string | null
  workflows?: string[]
  workflowsLoading?: boolean
  workflowsError?: string | null
  defaultAgentName?: string | null
  defaultWorkflowName?: string | null
  onClose: () => void
  onCreate: (input: NewSessionCreateInput) => void
}

export function NewSessionModal(props: NewSessionModalProps) {
  const {
    open,
    agents,
    agentsLoading = false,
    agentsError = null,
    workflows = [],
    workflowsLoading = false,
    workflowsError = null,
    defaultAgentName = null,
    defaultWorkflowName = null,
    onClose,
    onCreate,
  } = props

  const defaultAgentId = useMemo<'none' | string>(() => {
    if (!defaultAgentName) return 'none'
    const match = agents.find(a => a.name === defaultAgentName)
    return match?.id ?? 'none'
  }, [agents, defaultAgentName])

  const [agentId, setAgentId] = useState<string | 'none'>('none')
  const [workflowName, setWorkflowName] = useState<string | ''>('')

  useEffect(() => {
    if (!open) return
    // Default on open to newest-session-aligned selections when provided
    setAgentId(defaultAgentId)
    setWorkflowName(defaultWorkflowName || '')
  }, [open, defaultAgentId, defaultWorkflowName])

  if (!open) return null

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  }
  const modalStyle: CSSProperties = {
    width: 'min(520px, 92vw)',
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    boxShadow: '0 10px 24px rgba(0,0,0,0.15)',
    padding: 16,
  }

  // Only disable create if the user chose a path that depends on still-loading data
  const disableCreate = (agentsLoading && agentId !== 'none') || (workflowsLoading && !!workflowName)

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Create new session">
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>New Session</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0, color: '#6b7280' }}>Choose an existing agent or create a new one from a workflow.</p>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>Existing agent</span>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value as any)}
              disabled={agentsLoading}
              style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
            >
              <option value="none">No agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          {agentsLoading && <div style={{ color: '#6b7280' }}>Loading agents…</div>}
          {!!agentsError && (
            <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: 8, borderRadius: 6 }}>
              Failed to load agents: {agentsError}
            </div>
          )}

          <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>Or create new agent via workflow</span>
            <WorkflowSelector
              workflows={workflows}
              value={workflowName || null}
              onChange={(name) => {
                // If user selects a workflow, clear any existing agent selection
                setAgentId('none')
                setWorkflowName(name)
              }}
              placeholder={workflowsLoading ? 'Loading workflows…' : 'Select a workflow (optional)'}
              // Do not disable while loading; show loading message inside the dropdown instead
              disabled={false}
              loading={workflowsLoading}
              style={{ width: '100%' }}
            />
          </label>

          {!!workflowsError && (
            <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: 8, borderRadius: 6 }}>
              Failed to load workflows: {workflowsError}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate({ agentId: agentId === 'none' ? null : agentId, workflowName: workflowName || null })}
            disabled={disableCreate}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: disableCreate ? 'not-allowed' : 'pointer' }}
          >
            Create Session
          </button>
        </div>
      </div>
    </div>
  )
}
