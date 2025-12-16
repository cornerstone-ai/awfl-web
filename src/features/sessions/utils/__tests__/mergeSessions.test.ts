import { describe, it, expect } from 'vitest'
import type { Session } from '../../types/session'
import { mergeSessions } from '../mergeSessions'

function s(id: string, title?: string): Session {
  return { id, title: title ?? id, updatedAt: '2024-01-01T00:00:00.000Z' }
}

describe('mergeSessions', () => {
  it('returns empty when both inputs are empty', () => {
    expect(mergeSessions([], [])).toEqual([])
  })

  it('returns server list when no ephemeral provided', () => {
    const server = [s('a'), s('b')]
    expect(mergeSessions(server, [])).toEqual(server)
  })

  it('places ephemeral-only items before server items', () => {
    const server = [s('a'), s('b')]
    const ephemeral = [s('x'), s('y')]
    expect(mergeSessions(server, ephemeral).map(x => x.id)).toEqual(['x', 'y', 'a', 'b'])
  })

  it('de-dupes by id; server wins on conflict', () => {
    const server = [s('a', 'server a'), s('b', 'server b')]
    const ephemeral = [s('a', 'ephemeral a'), s('c', 'ephemeral c')]
    const merged = mergeSessions(server, ephemeral)
    expect(merged.map(x => x.id)).toEqual(['c', 'a', 'b'])
    // ensure the server item is the retained one for id "a"
    const a = merged.find(x => x.id === 'a')!
    expect(a.title).toBe('server a')
  })
})
