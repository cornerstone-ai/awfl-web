import { useCallback, useMemo, useState } from 'react'
import { useAgentsApi } from '../../../hooks/useAgentsApi'
import type { AgentUpsertInput } from '../../../types/agent'
import type { ToolItem } from '../../tools/public'
import { useWorkflowsList } from '../../workflows/public'

export type AgentModalController = {
  open: boolean
  mode: 'create' | 'edit'
  setOpen: (v: boolean) => void
  openEdit: () => Promise<void>
  initial: { id?: string; name: string; description?: string | null; workflowName?: string | null; tools?: string[] } | null
  tools: ToolItem[]
  workflows: string[]
  workflowsLoading: boolean
  onSave: (input: AgentUpsertInput & { id?: string }) => Promise<void>
  loading: boolean
  error: string | null
  // Expose the currently configured workflow name (if any) for the session's agent
  workflowName: string | null
}

export function useAgentModalController(params: { idToken?: string | null; sessionId: string | null; workflowName: string | null; enabled?: boolean }): AgentModalController {
  const { idToken, sessionId, workflowName, enabled = true } = params

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'create' | 'edit'>('edit')
  const [initial, setInitial] = useState<AgentModalController['initial']>(null)
  const [tools, setTools] = useState<ToolItem[]>([])
  const [agentWorkflowName, setAgentWorkflowName] = useState<string | null>(null)

  const { listTools, getAgentByName, getAgentById, listAgentTools, getSessionAgentMapping, linkSessionAgent, saveAgent, loading, error } = useAgentsApi({ idToken, enabled: open && enabled })

  // Load workflows list only while modal is open
  const { workflows, loading: workflowsLoading } = useWorkflowsList({ idToken, enabled: open && enabled })

  const openEdit = useCallback(async () => {
    if (!sessionId) return
    setOpen(true)
    setMode('edit')
    try {
      const [registryTools, mapping] = await Promise.all([listTools(), getSessionAgentMapping(sessionId)])
      setTools(registryTools)

      let existing: { id: string; name: string; description: string | null; workflowName: string | null; tools: string[] } | null = null
      if (mapping?.agentId) {
        existing = await getAgentById(mapping.agentId)
        if (!existing) existing = await getAgentByName(sessionId)
      } else {
        existing = await getAgentByName(sessionId)
      }

      let defaultTools: string[] = []
      if (!existing) {
        try {
          defaultTools = await listAgentTools('default')
        } catch {
          defaultTools = []
        }
      }

      const init = existing
        ? { id: existing.id, name: existing.name, description: existing.description ?? '', workflowName: existing.workflowName ?? (workflowName || ''), tools: existing.tools || [] }
        : { name: sessionId, description: '', workflowName: workflowName || '', tools: defaultTools }
      setInitial(init)
      // Keep the controller's current workflow in sync with what's configured (or default)
      setAgentWorkflowName(existing?.workflowName ?? (workflowName || null))
    } catch {
      const init = { name: sessionId, description: '', workflowName: workflowName || '', tools: [] }
      setInitial(init)
      setTools([])
      setAgentWorkflowName(workflowName || null)
    }
  }, [sessionId, workflowName, listTools, getSessionAgentMapping, getAgentById, getAgentByName, listAgentTools])

  const onSave = useCallback(
    async (input: AgentUpsertInput & { id?: string }) => {
      const saved = await saveAgent(input)
      if (saved && sessionId) {
        try { await linkSessionAgent(sessionId, saved.id) } catch {}
      }
      // Update the exposed workflowName so callers can use the new value immediately
      setAgentWorkflowName(input.workflowName ?? null)
      // Also reflect in initial for next open
      setInitial((prev) => {
        const base = prev ?? { name: sessionId || '', description: '' }
        return { ...base, id: input.id ?? (prev as any)?.id, name: input.name ?? (prev as any)?.name, description: input.description ?? (prev as any)?.description ?? '', workflowName: input.workflowName ?? null, tools: (input as any).tools ?? (prev as any)?.tools ?? [] }
      })
    },
    [saveAgent, sessionId, linkSessionAgent]
  )

  return useMemo(
    () => ({ open, mode, setOpen, openEdit, initial, tools, workflows, workflowsLoading, onSave, loading, error, workflowName: agentWorkflowName }),
    [open, mode, openEdit, initial, tools, workflows, workflowsLoading, onSave, loading, error, agentWorkflowName]
  )
}
