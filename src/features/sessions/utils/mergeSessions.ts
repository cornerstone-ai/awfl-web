import type { Session } from '../types/session'

// Merge ephemeral and server sessions for UI rendering
// - De-dupe by id
// - Server wins on conflicts (ephemeral item dropped)
// - Ephemeral-only items are placed before server items so they appear immediately
export function mergeSessions(
  serverSessions?: Session[] | null,
  ephemeralSessions?: Session[] | null,
): Session[] {
  const server = Array.isArray(serverSessions) ? serverSessions : []
  const eph = Array.isArray(ephemeralSessions) ? ephemeralSessions : []
  if (server.length === 0 && eph.length === 0) return []

  const serverIds = new Set(server.map(s => s?.id).filter(Boolean) as string[])
  const ephOnly = eph.filter(s => s && s.id && !serverIds.has(s.id))

  return [...ephOnly, ...server]
}
