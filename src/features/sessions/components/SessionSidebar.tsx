import type { Session } from '../types/session'

export type SessionSidebarProps = {
  sessions: Session[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
  error: string | null
  query: string
  onQueryChange: (q: string) => void
  onCreateNew?: () => void
  [key: string]: any
}

export function SessionSidebar(props: SessionSidebarProps) {
  const { sessions, selectedId, onSelect, loading, error, query, onQueryChange, onCreateNew } = props

  return (
    <div style={{ width: 320, maxWidth: '100%', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
        <input
          type="search"
          placeholder="Search sessions…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <button
          type="button"
          title="New session"
          aria-label="Create new session"
          onClick={onCreateNew}
          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: onCreateNew ? 'pointer' : 'default', opacity: onCreateNew ? 1 : 0.5 }}
        >
          +
        </button>
      </div>

      {error && (
        <div style={{ margin: 12, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: 8, borderRadius: 6 }}>
          {error}
        </div>
      )}

      <div style={{ overflow: 'auto', flex: 1 }}>
        {loading ? (
          <div style={{ padding: 12, color: '#6b7280' }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: 12, color: '#6b7280' }}>No sessions</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sessions.map((s) => {
              const selected = s.id === selectedId
              const titleText = s.title && s.title.trim().length > 0 ? s.title : s.id
              let subtitleText: string = s.updatedAt
              try {
                const d = new Date(s.updatedAt)
                if (!Number.isNaN(d.getTime())) {
                  subtitleText = d.toLocaleString()
                }
              } catch {
                // keep raw updatedAt if parsing fails
              }

              return (
                <li key={s.id}>
                  <button
                    onClick={() => onSelect(s.id)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      textAlign: 'left',
                      padding: 12,
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      background: selected ? '#eef2ff' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleText}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitleText}</div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default SessionSidebar
