import type React from 'react'

export type UseWorkflowsListResult = {
  workflows: string[]
  loading: boolean
  error: string | null
  reload: () => void
}

export type WorkflowSelectorProps = {
  workflows: string[]
  value?: string | null
  onChange: (name: string) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  style?: React.CSSProperties
}
