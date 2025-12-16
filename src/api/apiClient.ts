import { postJson, patchJson, putJson, deleteJson, deleteWithBodyJson, getJson, normalizeTasksArray } from './http'
import type { ApiClientOptions, RequestOptions } from './http'
export type { ApiClientOptions, RequestOptions } from './http'

export function makeApiClient(opts: ApiClientOptions) {
  return {
    async listSessions(body: any, ropts?: RequestOptions) {
      // Endpoint for listing sessions within a time range
      return await postJson('/workflows/context/sessions/list', body, opts, ropts)
    },
    async topicContextYoj(body: any, ropts?: RequestOptions) {
      // Endpoint for running TopicContextYoj
      const json = await postJson('/workflows/context/topicContextYoj/run', body, opts, ropts)
      // Normalize: ensure top-level yoj exists if only nested under lastExec/output
      if (!(json as any)?.yoj) {
        const nested = (json as any)?.lastExec?.output?.yoj || (json as any)?.lastExec?.result?.yoj || (json as any)?.result?.yoj
        if (Array.isArray(nested)) (json as any).yoj = nested
      }
      return json
    },
    async workflowsExecute(body: any, ropts?: RequestOptions) {
      // POST /workflows/execute via public API proxy
      // Do not force sync=true; default to false unless provided by caller
      const payload: any = body && typeof body === 'object' ? { ...body } : {}
      if (payload.sync == null) payload.sync = false
      return await postJson('/workflows/execute', payload, opts, ropts)
    },
    async workflowsStatusLatest(sessionId: string, limit = 1, ropts?: RequestOptions) {
      const q = typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : ''
      return await getJson(`/workflows/exec/status/latest/${encodeURIComponent(sessionId)}${q}`, opts, ropts)
    },
    async workflowsStop(body: any, ropts?: RequestOptions) {
      // POST /workflows/exec/stop via public API proxy
      return await postJson('/workflows/exec/stop', body, opts, ropts)
    },
    async workflowsExecTree(body: { sessionId?: string; execId?: string; includeStatus?: boolean } | null, ropts?: RequestOptions) {
      // Return execution tree for a session or a particular exec id
      return await postJson('/workflows/exec/tree', body || {}, opts, ropts)
    },

    // Workflows service under /workflows
    async listWorkflows(params?: { location?: string | null }, ropts?: RequestOptions) {
      const q = new URLSearchParams()
      if (params?.location) q.set('location', params.location)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return await getJson(`/workflows/list${qs}`, opts, ropts)
    },

    // Projects service under /workflows/projects
    async projectsList(params?: { limit?: number; order?: 'asc' | 'desc' }, ropts?: RequestOptions) {
      const q = new URLSearchParams()
      if (params?.limit != null) q.set('limit', String(params.limit))
      if (params?.order) q.set('order', params.order)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return await getJson(`/workflows/projects${qs}`, opts, ropts)
    },
    async projectsCreate(body: { remote?: string | null; name?: string | null; live?: boolean | null }, ropts?: RequestOptions) {
      // Create a project via POST /workflows/projects
      // Accept optional name/remote/live; server generates id and returns { project } or the project object
      const payload: any = {}
      if (body && typeof body === 'object') {
        if (body.remote != null && body.remote !== '') payload.remote = body.remote
        if (body.name != null && String(body.name).trim() !== '') payload.name = String(body.name).trim()
        if (body.live != null) payload.live = !!body.live
      }
      return await postJson('/workflows/projects', payload, opts, ropts)
    },

    // Consumer lock status under /workflows/projects/:projectId/consumer-lock/status
    async consumerLockStatus(projectId: string, ropts?: RequestOptions) {
      if (!projectId) throw new Error('consumerLockStatus: projectId is required')
      const path = `/workflows/projects/${encodeURIComponent(projectId)}/consumer-lock/status`
      return await getJson(path, opts, ropts)
    },

    // Producer controls under /workflows/producer
    async producerStart(body?: any, ropts?: RequestOptions) {
      // POST /workflows/producer/start — requires Authorization and X-Project-Id headers
      // Optional JSON body supports { sessionId, since_id, since_time, leaseMs, eventsHeartbeatMs, reconnectBackoffMs, workspaceId, workspaceTtlMs, localDocker, localDockerImage, localDockerArgs }
      const payload = body && typeof body === 'object' ? body : {}
      return await postJson('/workflows/producer/start', payload, opts, ropts)
    },
    async producerStop(ropts?: RequestOptions) {
      // POST /workflows/producer/stop — requires Authorization and X-Project-Id headers
      return await postJson('/workflows/producer/stop', {}, opts, ropts)
    },

    // Tasks service under /workflows/tasks
    async tasksList(
      params: { sessionId?: string; status?: string; limit?: number; order?: 'asc' | 'desc' },
      ropts?: RequestOptions
    ) {
      const q = new URLSearchParams()
      if (params?.sessionId) q.set('sessionId', params.sessionId)
      if (params?.status) q.set('status', params.status)
      if (typeof params?.limit === 'number') q.set('limit', String(params.limit))
      if (params?.order) q.set('order', params.order)
      const qs = q.toString() ? `?${q.toString()}` : ''

      const json = await getJson(`/workflows/tasks${qs}`, opts, ropts)
      const arr = normalizeTasksArray(json) || []
      return { tasks: arr }
    },
    async tasksListBySession(
      params: { sessionId: string; status?: string; limit?: number; order?: 'asc' | 'desc' },
      ropts?: RequestOptions
    ) {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      if (typeof params?.limit === 'number') q.set('limit', String(params.limit))
      if (params?.order) q.set('order', params.order)
      const qs = q.toString() ? `?${q.toString()}` : ''
      const path = `/workflows/tasks/by-session/${encodeURIComponent(params.sessionId)}${qs}`
      const json = await getJson(path, opts, ropts)
      const arr = normalizeTasksArray(json) || []
      return { tasks: arr }
    },
    async taskCreate(body: { sessionId?: string; title?: string; description?: string; status?: string }, ropts?: RequestOptions) {
      // Create a task; server returns created record
      return await postJson('/workflows/tasks', body, opts, ropts)
    },
    async taskUpdate(body: { id: string; title?: string; description?: string; status?: string }, ropts?: RequestOptions) {
      // Update a task by id using PATCH /workflows/tasks/:id
      const { id, ...fields } = body || ({} as any)
      if (!id) throw new Error('taskUpdate: id is required')
      return await patchJson(`/workflows/tasks/${encodeURIComponent(id)}`, fields, opts, ropts)
    },
    async taskStatusUpdate(body: { id: string; status: string }, ropts?: RequestOptions) {
      const { id, status } = body || ({} as any)
      if (!id) throw new Error('taskStatusUpdate: id is required')
      return await postJson(`/workflows/tasks/${encodeURIComponent(id)}/status`, { status }, opts, ropts)
    },
    async taskDelete(id: string, ropts?: RequestOptions) {
      if (!id) throw new Error('taskDelete: id is required')
      return await deleteJson(`/workflows/tasks/${encodeURIComponent(id)}`, opts, ropts)
    },

    // Agents service under /workflows/agents
    async agentsList(ropts?: RequestOptions) {
      return await getJson('/workflows/agents', opts, ropts)
    },
    async agentCreate(body: { name: string; description?: string | null; workflowName?: string | null; tools?: string[] }, ropts?: RequestOptions) {
      return await postJson('/workflows/agents', body, opts, ropts)
    },
    async agentUpdate(body: { id: string; name?: string | null; description?: string | null; workflowName?: string | null }, ropts?: RequestOptions) {
      const { id, ...fields } = body || ({} as any)
      if (!id) throw new Error('agentUpdate: id is required')
      return await patchJson(`/workflows/agents/${encodeURIComponent(id)}`, fields, opts, ropts)
    },
    async agentDelete(id: string, ropts?: RequestOptions) {
      if (!id) throw new Error('agentDelete: id is required')
      return await deleteJson(`/workflows/agents/${encodeURIComponent(id)}`, opts, ropts)
    },
    async agentToolsAdd(id: string, tools: string[] | string, ropts?: RequestOptions) {
      if (!id) throw new Error('agentToolsAdd: id is required')
      const payload = { tools }
      return await postJson(`/workflows/agents/${encodeURIComponent(id)}/tools`, payload, opts, ropts)
    },
    async agentToolsRemove(id: string, tools: string[] | string, ropts?: RequestOptions) {
      if (!id) throw new Error('agentToolsRemove: id is required')
      const payload = { tools }
      return await deleteWithBodyJson(`/workflows/agents/${encodeURIComponent(id)}/tools`, payload, opts, ropts)
    },
    async agentToolsList(id: string, ropts?: RequestOptions) {
      if (!id) throw new Error('agentToolsList: id is required')
      return await getJson(`/workflows/agents/${encodeURIComponent(id)}/tools`, opts, ropts)
    },

    // Agent-session mapping under /workflows/agents/session
    async agentsSessionLink(sessionId: string, agentId: string, ropts?: RequestOptions) {
      if (!sessionId) throw new Error('agentsSessionLink: sessionId is required')
      if (!agentId) throw new Error('agentsSessionLink: agentId is required')
      return await putJson(`/workflows/agents/session/${encodeURIComponent(sessionId)}`, { agentId }, opts, ropts)
    },
    async agentsSessionGet(sessionId: string, ropts?: RequestOptions) {
      if (!sessionId) throw new Error('agentsSessionGet: sessionId is required')
      return await getJson(`/workflows/agents/session/${encodeURIComponent(sessionId)}`, opts, ropts)
    },
    async agentsSessionDelete(sessionId: string, ropts?: RequestOptions) {
      if (!sessionId) throw new Error('agentsSessionDelete: sessionId is required')
      return await deleteJson(`/workflows/agents/session/${encodeURIComponent(sessionId)}`, opts, ropts)
    },

    // Tools registry service under /workflows/tools
    async toolsList(params?: { names?: string[] }, ropts?: RequestOptions) {
      const q = new URLSearchParams()
      const names = params?.names || []
      if (names.length) q.set('names', JSON.stringify(names))
      const qs = q.toString() ? `?${q.toString()}` : ''
      return await getJson(`/workflows/tools/list${qs}`, opts, ropts)
    },

    // Git service under /workflows/services/git
    async gitConfigGet(projectId: string, ropts?: RequestOptions) {
      if (!projectId) throw new Error('gitConfigGet: projectId is required')
      const q = new URLSearchParams()
      q.set('projectId', projectId)
      const qs = `?${q.toString()}`
      return await getJson(`/workflows/services/git/config${qs}`, opts, ropts)
    },
    async gitConfigPut(body: { projectId: string; owner?: string; repo?: string; defaultBranch?: string; token?: string }, ropts?: RequestOptions) {
      const { projectId, ...rest } = body || ({} as any)
      if (!projectId) throw new Error('gitConfigPut: projectId is required')
      return await putJson('/workflows/services/git/config', { projectId, ...rest }, opts, ropts)
    },
    async gitConfigDelete(projectId: string, ropts?: RequestOptions) {
      if (!projectId) throw new Error('gitConfigDelete: projectId is required')
      const q = new URLSearchParams()
      q.set('projectId', projectId)
      const qs = `?${q.toString()}`
      return await getJson(`/workflows/services/git/config${qs}`, opts, ropts)
    },
    async gitTree(params: { projectId: string; ref?: string; recursive?: boolean }, ropts?: RequestOptions) {
      const q = new URLSearchParams()
      if (!params?.projectId) throw new Error('gitTree: projectId is required')
      q.set('projectId', params.projectId)
      if (params?.ref) q.set('ref', params.ref)
      if (params?.recursive) q.set('recursive', '1')
      const qs = `?${q.toString()}`
      return await getJson(`/workflows/services/git/tree${qs}`, opts, ropts)
    },
    async gitList(params: { projectId?: string; path?: string; ref?: string }, ropts?: RequestOptions) {
      const q = new URLSearchParams()
      if (params?.projectId) q.set('projectId', params.projectId)
      if (typeof params?.path === 'string') q.set('path', params.path)
      if (params?.ref) q.set('ref', params.ref)
      const qs = q.toString() ? `?${q.toString()}` : ''
      return await getJson(`/workflows/services/git/list${qs}`, opts, ropts)
    },
    async gitRead(params: { projectId?: string; path: string; ref?: string }, ropts?: RequestOptions) {
      if (!params?.path) throw new Error('gitRead: path is required')
      const q = new URLSearchParams()
      if (params?.projectId) q.set('projectId', params.projectId)
      q.set('path', params.path)
      if (params?.ref) q.set('ref', params.ref)
      const qs = `?${q.toString()}`
      return await getJson(`/workflows/services/git/read${qs}`, opts, ropts)
    },
    async gitWrite(body: { projectId?: string; path: string; content: string; message?: string; branch?: string; sha?: string }, ropts?: RequestOptions) {
      const { path: filePath, content, ...rest } = body || ({} as any)
      if (!filePath) throw new Error('gitWrite: path is required')
      if (typeof content !== 'string') throw new Error('gitWrite: content is required')
      return await putJson('/workflows/services/git/write', { path: filePath, content, ...rest }, opts, ropts)
    },
    async gitDelete(body: { projectId?: string; path: string; message?: string; branch?: string; sha?: string }, ropts?: RequestOptions) {
      const { path: filePath, ...rest } = body || ({} as any)
      if (!filePath) throw new Error('gitDelete: path is required')
      return await deleteWithBodyJson('/workflows/services/git/delete', { path: filePath, ...rest }, opts, ropts)
    },

    // Collapsed group state under /workflows/context/collapse/state
    async collapseStateSet(body: { sessionId: string; group: string; expanded: boolean; responseId?: string | null }, ropts?: RequestOptions) {
      if (!body?.sessionId) throw new Error('collapseStateSet: sessionId is required')
      if (!body?.group) throw new Error('collapseStateSet: group is required')
      const payload = { sessionId: body.sessionId, group: body.group, expanded: !!body.expanded, ...(body.responseId ? { responseId: body.responseId } : {}) }

      return await postJson('/workflows/context/collapse/state/set', payload, opts, ropts)
    },
    // Note: GET endpoint for hydration will be added in a follow-up task (z4EMEMZKuk8scCfpsF76)

    // Credentials service under /workflows/creds
    async credsList(ropts?: RequestOptions) {
      return await getJson('/workflows/creds', opts, ropts)
    },
    async credsSet(provider: string, value: string, ropts?: RequestOptions) {
      if (!provider) throw new Error('credsSet: provider is required')
      if (typeof value !== 'string' || !value) throw new Error('credsSet: value is required')
      return await postJson(`/workflows/creds/${encodeURIComponent(provider)}`, { value }, opts, ropts)
    },
    async credsDelete(provider: string, ropts?: RequestOptions) {
      if (!provider) throw new Error('credsDelete: provider is required')
      return await deleteJson(`/workflows/creds/${encodeURIComponent(provider)}`, opts, ropts)
    },
  }
}
