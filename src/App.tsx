import { useEffect, useState, type ChangeEvent } from 'react'
import './App.css'
import Sessions from './pages/Sessions'
import Tasks from './pages/Tasks'
import IntegrationsGitHub from './pages/IntegrationsGitHub'
import { useAuth } from './auth/AuthProvider'
import { getCookie, setCookie } from './utils/cookies'
import { useProjectsList } from './features/projects/public'
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

  // GitHub project selection (header dropdown)
  const [projectId, setProjectId] = useState<string>(getCookie('awfl.projectId') || '')

  // Load projects from API (encapsulated in features/projects)
  const { projects, loading: loadingProjects } = useProjectsList({ idToken, enabled: true })

  // Ensure cookie is applied on mount if present
  useEffect(() => {
    if (projectId) setCookie('awfl.projectId', projectId)
  }, [])

  function handleProjectSelect(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    if (next === '__manage__') {
      setRoute('integrations-github')
      return
    }
    setProjectId(next)
    if (next) setCookie('awfl.projectId', next)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <img src="/awfl.svg" alt="AWFL" width={28} height={28} style={{ display: 'block', flexShrink: 0 }} />
          <strong>AWFL</strong>
        </div>
        <nav style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
        <AuthControls />
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {route === 'home' ? (
          <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
            <Home />
          </div>
        ) : loading ? (
          <div style={{ color: '#6b7280', padding: 16 }}>Loading auth…</div>
        ) : user ? (
          route === 'sessions' ? (
            <Sessions />
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
