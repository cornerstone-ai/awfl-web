Features public surfaces and usage map

Purpose
- Track each feature module’s public surface (exports from public.ts[*]) and where they are imported.
- Keep this file updated when adding or modifying features to preserve encapsulation and help page authors discover the right import sites.

Conventions
- Pages import only from features/*/public and core/public.
- Cross-feature imports must go through the callee feature’s public.ts.
- public.ts here refers to the feature barrel file (public.ts or public.tsx as applicable).

Legend
- Exports: items re-exported by the feature barrel.
- Used in: import sites across src/ (pages, core, or other features via their barrels).

agents
- Exports
  - AgentModal
  - useAgentsApi
  - Types: AgentRecord, AgentUpsertInput
- Used in
  - src/pages/Sessions.tsx: AgentModal, useAgentsApi

exec
- Exports
  - useExecTrees
  - ExecGutter
  - Types/Utils: ExecParentMap, buildParentMapFromNodes, computeAdjacencyFromExecIds
- Used in
  - src/core/public.ts: re-exports useExecTrees
  - src/features/yoj/components/YojMessageList.tsx: ExecGutter

filesystem
- Exports
  - FileSystemSidebar
  - SelectionToolbar
  - Hooks: useFsList, useFsTree, useFsSelection
  - Utils: parseLsA1F
  - Types: filesystem-related types
- Used in
  - src/pages/Sessions.tsx: FileSystemSidebar

fileviewer
- Exports
  - FileEditorModal
- Used in
  - src/pages/Sessions.tsx: FileEditorModal

plain
- Exports
  - usePlainify
  - Types: PlainifyHelpers
- Used in
  - src/pages/Sessions.tsx: usePlainify

projects
- Exports
  - useProjectsList
  - Types: Project
- Used in
  - (no current imports in pages/core)

sessions
- Exports
  - Components: SessionSidebar, SessionDetail
  - Hooks: useSessionsList, useScrollHome, useSessionPolling
  - Utils: filterSessionsByQuery, mapTopicInfoToSession
  - Types: Session
- Used in
  - src/pages/Sessions.tsx: SessionSidebar, SessionDetail, useSessionsList, filterSessionsByQuery, mapTopicInfoToSession, type Session
  - src/hooks/public.ts: re-exports useSessionsList, useScrollHome, useSessionPolling

settings
- Exports
  - SettingsPage (and props)
  - Hooks: useCredsApi
  - Types: related to settings/credentials
- Used in
  - (no current imports in pages/core)

sidebar
- Exports
  - SidebarNav
- Used in
  - src/pages/Sessions.tsx: SidebarNav

tasks
- Exports
  - Hooks: useSessionTasks, useTasksCounts, useTasksList
  - Components: TaskModal
  - Types/Enums: TaskStatus
- Used in
  - src/pages/Sessions.tsx: TaskModal, useTasksCounts, useSessionTasks

tools
- Exports
  - Hooks: useToolExec
  - Components: ToolSelector (and props)
  - Types: ToolItem
- Used in
  - src/pages/Sessions.tsx: useToolExec, type ToolItem
  - src/hooks/useAgentsApi.ts: type ToolItem
  - src/types/public.ts: re-exports type ToolItem

workflows
- Exports
  - Hooks: useWorkflowsList
  - Components: WorkflowSelector (and props)
- Used in
  - src/features/agents/AgentModal.tsx: WorkflowSelector
  - src/features/agents/hooks/useAgentModalController.ts: useWorkflowsList

yoj
- Exports
  - Hooks: useTopicContextYoj
  - Components: YojMessageList
  - Types: YojMessage
- Used in
  - src/pages/Sessions.tsx: useTopicContextYoj

instructions
- Exports
  - InstructionsOverview
- Used in
  - src/App.tsx: InstructionsOverview

How to update
- When adding or changing a feature’s public API:
  1) Update the feature’s public.ts to reflect the intended surface.
  2) Add or edit the entry above with Exports and Used in lists.
  3) If new cross-feature usage is needed, ensure it imports via the callee feature’s public.ts.
- Validate with: npm run typecheck and npm run lint.

Notes
- This map is intentionally high level. Internal files should not be imported across features; only barrels appear here.

Appendix: Theming notes
- The Yoj message list and collapsed group card are themeable via CSS custom properties on a wrapping container.
- YojMessageList tokens: --yoj-user-bg, --yoj-user-border, --yoj-user-label; --yoj-system-bg, --yoj-system-border, --yoj-system-label; --yoj-assistant-bg, --yoj-assistant-border, --yoj-assistant-label; --yoj-toolcalls-bg, --yoj-toolcalls-border, --yoj-toolcalls-title, --yoj-toolcall-name; --yoj-code-bg; --yoj-meta.
- CollapsedGroupCard tokens: --yoj-cg-bg, --yoj-cg-border, --yoj-cg-radius, --yoj-cg-padding, --yoj-cg-label-color, --yoj-cg-desc-color; toggle: --yoj-cg-toggle-border, --yoj-cg-toggle-color, --yoj-cg-toggle-bg, --yoj-cg-toggle-bg-hover, --yoj-cg-toggle-bg-expanded, --yoj-cg-toggle-bg-expanded-hover; body: --yoj-cg-body-bg, --yoj-cg-body-border, --yoj-cg-body-radius, --yoj-cg-body-padding; toast: --yoj-cg-toast-bg, --yoj-cg-toast-color, --yoj-cg-toast-border.
- See the respective CSS modules for defaults and class structure.