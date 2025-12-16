import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useGitIntegration } from '../../hooks/useGitIntegration'
import { ErrorBanner } from '../common/ErrorBanner'

export type GitHubIntegrationManagerProps = {
  initialProjectId?: string
  onProjectChange?: (projectId: string) => void
}

const OWNER_REPO_RE = /^[A-Za-z0-9_.-]+$/

function useProjectLocalList(userId?: string | null) {
  const key = userId ? `awfl.projects.${userId}` : 'awfl.projects'
  const [items, setItems] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
    setLoaded(true)
     
  }, [key])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(new Set(items)).filter(Boolean)))
    } catch {}
  }, [items, loaded, key])

  const add = (id: string) => {
    if (!id) return
    setItems((prev) => Array.from(new Set([...(prev || []), id])))
  }
  const remove = (id: string) => {
    setItems((prev) => (prev || []).filter((x) => x !== id))
  }

  return { items, add, remove }
}

export function GitHubIntegrationManager(props: GitHubIntegrationManagerProps) {
  const { initialProjectId, onProjectChange } = props
  const { idToken, user } = useAuth()

  const { items: savedProjects, add: addSavedProject, remove: removeSavedProject } = useProjectLocalList(user?.uid)

  const [projectId, setProjectId] = useState<string>(initialProjectId || '')

  useEffect(() => {
    if (initialProjectId) setProjectId(initialProjectId)
  }, [initialProjectId])

  const { config, loading, saving, testing, error, save, remove, test } = useGitIntegration({ idToken, projectId, enabled: !!projectId })

  const [form, setForm] = useState<{ owner: string; repo: string; defaultBranch: string; token: string }>({ owner: '', repo: '', defaultBranch: '', token: '' })
  const [testResult, setTestResult] = useState<any>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Sync form from loaded config (token remains empty)
  useEffect(() => {
    const next = {
      owner: config?.owner || '',
      repo: config?.repo || '',
      defaultBranch: config?.defaultBranch || '',
      token: '',
    }
    setForm(next)
  }, [config?.owner, config?.repo, config?.defaultBranch])

  const hasValidOwnerRepo = useMemo(() => {
    if (!form.owner || !form.repo) return false
    return OWNER_REPO_RE.test(form.owner) && OWNER_REPO_RE.test(form.repo)
  }, [form.owner, form.repo])

  function handleProjectChange(next: string) {
    setProjectId(next)
    setTestResult(null)
    setActionError(null)
    onProjectChange?.(next)
  }

  async function handleSave() {
    setActionError(null)
    if (!projectId) {
      setActionError('projectId is required')
      return
    }
    if (form.owner && !OWNER_REPO_RE.test(form.owner)) {
      setActionError('Owner contains invalid characters')
      return
    }
    if (form.repo && !OWNER_REPO_RE.test(form.repo)) {
      setActionError('Repo contains invalid characters')
      return
    }
    try {
      await save({ owner: form.owner || undefined, repo: form.repo || undefined, defaultBranch: form.defaultBranch || undefined, token: form.token || undefined })
      // Save project id into local list
      addSavedProject(projectId)
      setTestResult(null)
    } catch (e: any) {
      setActionError(e?.message || String(e))
    }
  }

  async function handleDelete() {
    setActionError(null)
    if (!projectId) {
      setActionError('projectId is required')
      return
    }
    const ok = window.confirm(`Delete GitHub config for project "${projectId}"?`)
    if (!ok) return
    try {
      await remove()
      setTestResult(null)
    } catch (e: any) {
      setActionError(e?.message || String(e))
    }
  }

  async function handleTest() {
    setActionError(null)
    if (!projectId) {
      setActionError('projectId is required')
      return
    }
    try {
      const json = await test(form.defaultBranch || undefined)
      setTestResult(json)
    } catch (e: any) {
      setTestResult(null)
      setActionError(e?.message || String(e))
    }
  }

  const updatedAtDisplay = config?.updatedAt ? new Date(config.updatedAt).toLocaleString() : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch', maxWidth: 720 }}>
      <h2 style={{ margin: 0 }}>GitHub integration</h2>

      {(error || actionError) && <ErrorBanner>{actionError || error || ''}</ErrorBanner>}

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <label htmlFor="projectId" style={{ width: 100 }}>Project</label>
          <input
            id="projectId"
            placeholder="Enter project id"
            value={projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            style={{ flex: 1, padding: '6px 8px' }}
          />
          <button onClick={() => projectId && addSavedProject(projectId)} disabled={!projectId} title="Save to list">Save</button>
        </div>
        {savedProjects?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {savedProjects.map((p) => (
              <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #e5e7eb', borderRadius: 12, padding: '2px 8px', cursor: 'pointer', background: p === projectId ? '#eef2ff' : '#fff' }}>
                <span onClick={() => handleProjectChange(p)}>{p}</span>
                <button aria-label={`Remove ${p}`} onClick={() => removeSavedProject(p)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </span>
            ))}
          </div>
        )}
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>Project id identifies a workspace or app context. If your account doesn't have a projects list, enter any id to start and Save to remember it locally.</div>
      </section>

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, opacity: projectId ? 1 : 0.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Repository</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 8, background: config?.hasToken ? '#ecfdf5' : '#fef2f2', color: config?.hasToken ? '#065f46' : '#991b1b' }}>
              {config?.hasToken ? 'Token set' : 'No token'}
            </span>
            {updatedAtDisplay && <span style={{ fontSize: 12, color: '#6b7280' }}>Updated {updatedAtDisplay}</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'center' }}>
          <label htmlFor="owner">Owner</label>
          <input id="owner" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="org or username" />

          <label htmlFor="repo">Repo</label>
          <input id="repo" value={form.repo} onChange={(e) => setForm((f) => ({ ...f, repo: e.target.value }))} placeholder="repository name" />

          <label htmlFor="defaultBranch">Default branch</label>
          <input id="defaultBranch" value={form.defaultBranch} onChange={(e) => setForm((f) => ({ ...f, defaultBranch: e.target.value }))} placeholder="e.g., main" />

          <label htmlFor="token">Token</label>
          <input id="token" type="password" value={form.token} onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))} placeholder="GitHub PAT (repo scope)" />
        </div>
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>Token is write-only. Use a GitHub Personal Access Token with repo access. Value will not be displayed after saving.</div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={handleSave} disabled={!projectId || saving || loading || !hasValidOwnerRepo}>Save</button>
          <button onClick={handleTest} disabled={!projectId || testing || loading}>Test connection</button>
          <button onClick={handleDelete} disabled={!projectId || saving} style={{ marginLeft: 'auto', color: '#b91c1c' }}>Delete config</button>
        </div>
      </section>

      {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}

      {testResult && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Connection result</h3>
            <span style={{ fontSize: 12, color: '#065f46' }}>OK</span>
          </div>
          <pre style={{ overflow: 'auto', maxHeight: 200, background: '#f9fafb', padding: 8, borderRadius: 6 }}>
            {typeof testResult === 'string' ? testResult : JSON.stringify(testResult, null, 2)}
          </pre>
        </section>
      )}
    </div>
  )
}

export default GitHubIntegrationManager
