import GitHubIntegrationManager from '../components/integrations/GitHubIntegrationManager'
import { getSelectedProjectId, setSelectedProjectId } from '../features/projects/public'

export default function IntegrationsGitHub() {
  const initial = getSelectedProjectId() || ''

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
      <GitHubIntegrationManager
        initialProjectId={initial}
        onProjectChange={(id) => setSelectedProjectId(id)}
      />
    </div>
  )
}
