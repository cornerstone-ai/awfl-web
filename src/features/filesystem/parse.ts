import type { FsEntry, FsEntryType } from './types'

// Strictly handle the tools-CliTools execution response shape shared by the service:
// {
//   executionName: string,
//   state: 'SUCCEEDED' | string,
//   result: {
//     cost: number,
//     encoded: string // JSON string: { command, error, output, sessionId, timestamp }
//   }
// }
export function decodeEncodedResult(resp: any): { output: string; error: string } {
  try {
    const enc = resp?.result?.encoded
    if (typeof enc !== 'string') return { output: '', error: '' }
    const parsed = JSON.parse(enc)
    const output = typeof parsed?.output === 'string' ? parsed.output : ''
    const error = typeof parsed?.error === 'string' ? parsed.error : ''
    return { output, error }
  } catch (e) {
    return { output: '', error: '' }
  }
}

// Legacy helper kept for reference; not used by the Filesystem UI anymore.
export function extractStdout(_resp: any): string {
  return ''
}

function joinPath(base: string, name: string): string {
  if (!base || base === '.') return `./${name}`
  if (base.endsWith('/')) return `${base}${name}`
  return `${base}/${name}`
}

function classifyFromSuffix(line: string): { type: FsEntryType; executable?: boolean; name: string } {
  if (!line) return { type: 'other', name: '' }
  const last = line[line.length - 1]
  switch (last) {
    case '/':
      return { type: 'dir', name: line.slice(0, -1) }
    case '@':
      return { type: 'symlink', name: line.slice(0, -1) }
    case '*':
      return { type: 'file', executable: true, name: line.slice(0, -1) }
    case '=':
    case '|':
      return { type: 'other', name: line.slice(0, -1) }
    default:
      return { type: 'file', name: line }
  }
}

export function parseLsA1F(output: string, parentPath: string): FsEntry[] {
  if (!output) return []
  const lines = output.split(/\r?\n/)
  const out: FsEntry[] = []
  for (const raw of lines) {
    if (!raw) continue
    // Strip color codes if any slipped through
    const line = raw.replace(/\u001b\[[0-9;]*m/g, '')
    if (!line) continue
    const { type, name, executable } = classifyFromSuffix(line)
    if (!name) continue
    // Exclude hidden files/dirs (dot-prefixed)
    if (name.startsWith('.')) continue
    out.push({ name, type, executable, path: joinPath(parentPath, name) })
  }
  return out
}
