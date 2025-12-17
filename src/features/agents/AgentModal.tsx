import { useEffect, useMemo, useState } from 'react'
import { ToolSelector } from '../tools/public'
import type { ToolItem } from '../tools/public'
import { WorkflowSelector } from '../workflows/public'

export type AgentModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  initial: { id?: string; name: string; description?: string | null; workflowName?: string | null; tools?: string[] }
  tools: ToolItem[]
  workflows: string[]
  workflowsLoading?: boolean
  onClose: () => void
  onSave: (input: { id?: string; name: string; description?: string | null; workflowName?: string | null; tools?: string[] }) => Promise<void>
}

export function AgentModal({ open, mode, initial, tools, workflows, workflowsLoading, onClose, onSave }: AgentModalProps) {
  const [description, setDescription] = useState<string>('')
  const [workflowName, setWorkflowName] = useState<string>('')
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDescription(initial?.description || '')
    setWorkflowName(initial?.workflowName || '')
    setSelectedTools(Array.isArray(initial?.tools) ? [...(initial.tools!)] : [])
    setError(null)
    setSubmitting(false)
  }, [open, initial])

  const heading = useMemo(() => (mode === 'edit' ? 'Edit agent' : 'Create agent'), [mode])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 'min(760px, 96vw)',
          maxHeight: 'calc(100vh - 32px)',
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontWeight: 600 }}>{heading}</div>
          <button
            onClick={onClose}
            style={{
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 12, overflow: 'auto', flex: 1, minHeight: 0 }}>
          {error ? (
            <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: 8, borderRadius: 6, textAlign: 'left' }}>
              {error}
            </div>
          ) : null}

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>Agent name</span>
            <input
              type="text"
              value={initial?.name || ''}
              readOnly
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '8px 10px',
                outline: 'none',
                background: '#f9fafb',
                color: '#6b7280',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details about this agent"
              rows={4}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '8px 10px',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </label>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: '#374151' }}>Workflow</div>
            <WorkflowSelector workflows={workflows} value={workflowName} onChange={setWorkflowName} loading={!!workflowsLoading} />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#374151' }}>Tools</div>
            <ToolSelector tools={tools} value={selectedTools} onChange={setSelectedTools} />
          </div>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
              borderRadius: 6,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setError(null)
              try {
                setSubmitting(true)
                await onSave({ id: initial?.id, name: initial?.name, description, workflowName, tools: selectedTools })
                onClose()
              } catch (e: any) {
                setError(e?.message || String(e))
              } finally {
                setSubmitting(false)
              }
            }}
            disabled={submitting}
            style={{
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: '#fff',
              borderRadius: 6,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
