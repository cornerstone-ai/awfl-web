import { useEffect, useState, type ChangeEvent, useRef } from 'react'
import './App.css'
import Sessions from './pages/Sessions'
import Tasks from './pages/Tasks'
import IntegrationsGitHub from './pages/IntegrationsGitHub'
import { useAuth } from './auth/AuthProvider'
import { useProjectsList, getSelectedProjectId, setSelectedProjectId, NewProjectModal } from './features/projects/public'
import { SettingsPage, useCredsApi } from './features/settings/public'
import { InstructionsOverview } from './features/instructions/public'
import { ConsumerStatusPill } from './features/consumers/public'

type Route = 'home' | 'sessions' | 'tasks' | 'integrations-github' | 'settings'

function Home() {
  return (
    <div style={{ padding: 0 }}>
      <InstructionsOverview />
    </div>
  )
}

function App() {
  const [route, setRoute] = useState<Route>('home')
  const { user, loading, signIn, signOut, idToken } = useAuth() as any

  // GitHub project selection (header dropdown) — tab-specific via sessionStorage, fallback to cookie
  const [projectId, setProjectId] = useState<string>(getSelectedProjectId() || '')

  // Load projects from API (encapsulated in features/projects)
  const { projects, loading: loadingProjects, reload: reloadProjects } = useProjectsList({ idToken, enabled: true })

  function handleProjectSelect(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    if (next === '__manage__') {
      setRoute('integrations-github')
      setMobileOpen(false)
      return
    }
    setProjectId(next)
    setSelectedProjectId(next)
  }

  const AuthControls = () => {
    // Load creds to determine if we should show an alert indicator near Settings
    const { creds, loading: credsLoading } = useCredsApi({ idToken, enabled: !!user })

    // Show indicator if there are no saved credentials (no provider with a value)
    const noSavedCreds = !credsLoading && (!Array.isArray(creds) || !creds.some(c => c.hasValue))

    const [tipOpen, setTipOpen] = useState(false)

    return (
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {loading ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>Auth…</span>
        ) : user ? (
          <>
            <span style={{ fontSize: 12, color: '#374151' }}>
              {user.displayName || user.email || 'Signed in'}
            </span>
            <button
              onClick={() => setRoute('settings')}
              title="Open settings"
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: route === 'settings' ? '#eef2ff' : 'white', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              Settings
            </button>
            {noSavedCreds && (
              <div
                onMouseEnter={() => setTipOpen(true)}
                onMouseLeave={() => setTipOpen(false)}
                style={{ position: 'relative', display: 'inline-flex' }}
              >
                <span
                  aria-label="Add an API key in Settings to use agents"
                  style={{ width: 18, height: 18, borderRadius: '50%', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, cursor: 'default' }}
                >
                  !
                </span>
                {tipOpen && (
                  <div
                    role="tooltip"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      // Anchor to the right edge of the trigger to avoid viewport cutoff
                      right: 0,
                      left: 'auto',
                      transform: 'none',
                      background: '#111827',
                      color: 'white',
                      padding: '6px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      lineHeight: 1.3,
                      boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                      marginTop: 6,
                      zIndex: 20,
                      maxWidth: 280,
                      width: 'max-content',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    You need to add an OpenAI API key in Settings to use agents
                  </div>
                )}
              </div>
            )}
            <button
              onClick={signOut}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white' }}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={signIn}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white' }}
          >
            Sign in with Google
          </button>
        )}
      </div>
    )
  }

  // Mobile menu state and a11y helpers
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // New project modal state
  const [newOpen, setNewOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    const prev = (document.activeElement as HTMLElement | null) || null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    // Focus close button on open
    setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [mobileOpen])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        {/* Brand (hidden on mobile via CSS) */}
        <div className="app-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <img src="/awfl.svg" alt="AWFL" width={28} height={28} style={{ display: 'block', flexShrink: 0 }} />
          <strong>AWFL</strong>
        </div>

        {/* Hamburger (mobile only via CSS) */}
        <button
          className="app-hamburger"
          aria-label="Open menu"
          aria-controls="app-mobile-menu"
          aria-expanded={mobileOpen || undefined}
          onClick={() => setMobileOpen(true)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white' }}
        >
          ☰
        </button>

        {/* Left nav (hidden on small screens via CSS) */}
        <nav className="app-nav-left" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setRoute('home')}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: route === 'home' ? '#eef2ff' : 'white' }}
          >
            Home
          </button>
          <button
            onClick={() => setRoute('sessions')}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: route === 'sessions' ? '#eef2ff' : 'white' }}
          >
            Sessions
          </button>
          <button
            onClick={() => setRoute('tasks')}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: route === 'tasks' ? '#eef2ff' : 'white' }}
          >
            Tasks
          </button>

          {/* GitHub project dropdown replaces the old button */}
          <select
            value={projectId || ''}
            onChange={handleProjectSelect}
            title="Select GitHub project or manage settings"
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white' }}
          >
            <option value="">{loadingProjects ? 'Loading…' : projects.length ? 'Select project…' : 'No projects'}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.remote || p.id}</option>
            ))}
            <option value="__manage__">Manage…</option>
          </select>

          {/* Consumer status pill (only when authed and a project is selected) */}
          {user && projectId ? (
            <ConsumerStatusPill idToken={idToken} projectId={projectId} enabled={true} />
          ) : null}
        </nav>

        {/* New project button — persist on mobile (placed outside nav-left) */}
        <button
          onClick={() => setNewOpen(true)}
          title="Create a new project"
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #1d4ed8', background: '#2563eb', color: 'white' }}
        >
          New
        </button>

        <AuthControls />
      </header>

      {/* Mobile drawer menu */}
      {mobileOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setMobileOpen(false)} />
          <div
            ref={panelRef}
            className="drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            id="app-mobile-menu"
          >
            <div className="drawer-header">
              <strong>Menu</strong>
              <button ref={closeBtnRef} onClick={() => setMobileOpen(false)} aria-label="Close menu" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white' }}>
                ✕
              </button>
            </div>
            <div className="drawer-body">
              <button
                onClick={() => { setRoute('home'); setMobileOpen(false) }}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: route === 'home' ? '#eef2ff' : 'white', textAlign: 'left' }}
              >
                Home
              </button>
              <button
                onClick={() => { setRoute('sessions'); setMobileOpen(false) }}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: route === 'sessions' ? '#eef2ff' : 'white', textAlign: 'left' }}
              >
                Sessions
              </button>
              <button
                onClick={() => { setRoute('tasks'); setMobileOpen(false) }}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: route === 'tasks' ? '#eef2ff' : 'white', textAlign: 'left' }}
              >
                Tasks
              </button>

              <label style={{ fontSize: 12, color: '#374151' }}>Project</label>
              <select
                value={projectId || ''}
                onChange={handleProjectSelect}
                title="Select GitHub project or manage settings"
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white' }}
              >
                <option value="">{loadingProjects ? 'Loading…' : projects.length ? 'Select project…' : 'No projects'}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || p.remote || p.id}</option>
                ))}
                <option value="__manage__">Manage…</option>
              </select>

              {user && projectId ? (
                <div>
                  <ConsumerStatusPill idToken={idToken} projectId={projectId} enabled={true} />
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* New project modal */}
      <NewProjectModal
        idToken={idToken}
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(proj) => {
          setSelectedProjectId(proj.id)
          setProjectId(proj.id)
          reloadProjects()
        }}
      />

      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {route === 'home' ? (
          <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
            <Home />
          </div>
        ) : loading ? (
          <div style={{ color: '#6b7280', padding: 16 }}>Loading auth…</div>
        ) : user ? (
          route === 'sessions' ? (
            <Sessions projectId={projectId || null} />
          ) : route === 'tasks' ? (
            <Tasks />
          ) : route === 'integrations-github' ? (
            <IntegrationsGitHub />
          ) : route === 'settings' ? (
            <SettingsPage idToken={idToken} />
          ) : (
            <IntegrationsGitHub />
          )
        ) : (
          <div style={{ display: 'grid', gap: 8, padding: 16 }}>
            <div style={{ color: '#374151' }}>Please sign in to view {route === 'sessions' ? 'Sessions' : route === 'tasks' ? 'Tasks' : route === 'settings' ? 'Settings' : 'GitHub'}.</div>
            <div>
              <button
                onClick={signIn}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white' }}
              >
                Sign in with Google
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
