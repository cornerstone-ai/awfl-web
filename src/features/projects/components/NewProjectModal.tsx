import { useEffect, useRef, useState } from 'react'
import { useProjectCreate } from '../hooks/useProjectCreate'
import type { Project } from '../types/project'

export type NewProjectModalProps = {
  idToken?: string | null
  open: boolean
  onClose: () => void
  onCreated?: (project: Project) => void
}

export function NewProjectModal(props: NewProjectModalProps) {
  const { idToken, open, onClose, onCreated } = props
  const [name, setName] = useState('')
  const [remote, setRemote] = useState('')
  const { create, loading, error } = useProjectCreate({ idToken, enabled: open })
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => firstFieldRef.current?.focus(), 0)
    } else {
      setName('')
      setRemote('')
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const proj = await create({ name: trimmed, remote: remote.trim() || undefined })
    if (proj) {
      onCreated?.(proj)
      onClose()
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="New project" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.5)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '20%', transform: 'translateX(-50%)', background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', width: 'min(520px, calc(100vw - 32px))', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
            <strong>New project</strong>
            <button type="button" onClick={onClose} aria-label="Close" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gap: 10, padding: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#374151' }}>Name<span aria-hidden>*</span></span>
              <input ref={firstFieldRef} value={name} onChange={e => setName(e.target.value)} placeholder="Project name" required disabled={loading} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#374151' }}>Git remote (optional)</span>
              <input value={remote} onChange={e => setRemote(e.target.value)} placeholder="https://github.com/owner/repo.git" disabled={loading} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
            </label>
            {error ? (
              <div role="alert" style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 8px', borderRadius: 6 }}>
                {error}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
            <button type="button" onClick={onClose} disabled={loading} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white' }}>Cancel</button>
            <button type="submit" disabled={loading || !name.trim()} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #1d4ed8', background: '#2563eb', color: 'white' }}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
