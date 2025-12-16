import { useMemo, useCallback } from 'react'
import { makeApiClient } from '../../api/apiClient'
import type { ToolItem } from './types'

function uuidv4() {
  try {
    const c: any = (globalThis as any)?.crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {}
  // Fallback simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export type ExecOptions = {
  sessionId?: string
  background?: boolean
  cost?: number
  signal?: AbortSignal
}

export function useToolExec(params: { idToken?: string | null; enabled?: boolean }) {
  const { idToken, enabled = true } = params
  const skipAuth = (import.meta as any)?.env?.VITE_SKIP_AUTH === '1'

  const client = useMemo(() => makeApiClient({ idToken: idToken ?? undefined, skipAuth }), [idToken, skipAuth])

  const execTool = useCallback(
    async (tool: ToolItem | { workflowName: string; function: { name: string } }, args: Record<string, any>, opts?: ExecOptions) => {
      if (!enabled) throw new Error('useToolExec: disabled')
      const workflowName = tool.workflowName
      const toolName = tool.function.name
      const background = opts?.background ?? false // default false for generic tools; callers can override
      const sid = opts?.sessionId || uuidv4()

      const tool_call = {
        id: uuidv4(),
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(args || {}),
        },
      }

      const body = {
        workflowName,
        params: {
          sessionId: sid,
          tool_call,
          cost: typeof opts?.cost === 'number' ? opts!.cost : 0.0,
          background,
        },
      }

      return await client.workflowsExecute(body, { signal: opts?.signal })
    },
    [client, enabled]
  )

  const runCommand = useCallback(
    async (command: string, opts?: ExecOptions) => {
      const tool: { workflowName: string; function: { name: string } } = { workflowName: 'tools-CliTools', function: { name: 'RUN_COMMAND' } }
      // Critical: CLI tools expect background=true by default. Allow explicit override via opts.background.
      const background = opts?.background !== undefined ? opts.background : true
      const merged: ExecOptions = { ...opts, background }
      return await execTool(tool as ToolItem, { command }, merged)
    },
    [execTool]
  )

  // New helpers for file tools under tools-CliTools
  const readFile = useCallback(
    async (filepath: string, opts?: ExecOptions) => {
      const tool: { workflowName: string; function: { name: string } } = { workflowName: 'tools-CliTools', function: { name: 'READ_FILE' } }
      // Default background=true for CLI tools unless explicitly overridden
      const background = opts?.background !== undefined ? opts.background : true
      const merged: ExecOptions = { ...opts, background }
      return await execTool(tool as ToolItem, { filepath }, merged)
    },
    [execTool]
  )

  const updateFile = useCallback(
    async (filepath: string, content: string, opts?: ExecOptions) => {
      const tool: { workflowName: string; function: { name: string } } = { workflowName: 'tools-CliTools', function: { name: 'UPDATE_FILE' } }
      // Default background=true for CLI tools unless explicitly overridden
      const background = opts?.background !== undefined ? opts.background : true
      const merged: ExecOptions = { ...opts, background }
      return await execTool(tool as ToolItem, { filepath, content }, merged)
    },
    [execTool]
  )

  return { execTool, runCommand, readFile, updateFile }
}
