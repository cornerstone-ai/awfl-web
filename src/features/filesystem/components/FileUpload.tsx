import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToolExec } from '../../tools/public'
import { decodeEncodedResult } from '../parse'

/**
 * FileUpload (filesystem feature)
 *
 * Minimal, reusable file-upload UI component that writes a selected File to the
 * provided target path using the tools UPDATE_FILE helper via useToolExec.
 *
 * Usage:
 *   <FileUpload
 *     idToken={idToken}
 *     targetPath="plain/uploads/" // if endsWith('/'), filename is appended
 *     onSuccess={(res, filepath) => console.log('uploaded', filepath, res)}
 *     onError={(err) => console.error(err)}
 *   />
 *
 * Notes:
 * - Uses AbortController to cancel in-flight upload on unmount or prop change.
 * - Requires a single file selection (multiple not supported).
 * - Content is read as UTF-8 text before upload. For binary use-cases, consider
 *   base64-encoding upstream and extending UPDATE_FILE semantics accordingly.
 */
export function FileUpload(props: {
  idToken?: string | null
  enabled?: boolean
  targetPath?: string // If ends with '/', filename will be appended; if falsy, uses file.name at project root
  accept?: string
  onSuccess?: (result: any, filepath: string) => void
  onError?: (message: string) => void
  // style slots
  containerClassName?: string
  inputClassName?: string
  buttonClassName?: string
  progressClassName?: string
  errorClassName?: string
  containerStyle?: React.CSSProperties
  inputStyle?: React.CSSProperties
  buttonStyle?: React.CSSProperties
  progressStyle?: React.CSSProperties
  errorStyle?: React.CSSProperties
}) {
  const {
    idToken,
    enabled = true,
    targetPath = '',
    accept,
    onSuccess,
    onError,
    containerClassName,
    inputClassName,
    buttonClassName,
    progressClassName,
    errorClassName,
    containerStyle,
    inputStyle,
    buttonStyle,
    progressStyle,
    errorStyle,
  } = props

  const { updateFile } = useToolExec({ idToken, enabled })

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)

  const acRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => {
      if (acRef.current) acRef.current.abort()
    }
  }, [])

  const resolvedPath = useCallback(
    (f: File): string => {
      const base = targetPath || ''
      if (!base) return f.name
      if (base.endsWith('/')) return `${base}${f.name}`
      return base
    },
    [targetPath]
  )

  const canUpload = useMemo(() => enabled && !!file && !loading, [enabled, file, loading])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    setError(null)
    setProgress(0)
  }, [])

  const readFileAsText = useCallback((f: File, signal?: AbortSignal) => {
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.min(100, Math.round((ev.loaded / ev.total) * 100))
          setProgress(pct)
        }
      }
      fr.onerror = () => reject(fr.error || new Error('File read failed'))
      fr.onabort = () => reject(new Error('File read aborted'))
      fr.onload = () => {
        const text = typeof fr.result === 'string' ? fr.result : ''
        setProgress(100)
        resolve(text)
      }
      if (signal) {
        const onAbort = () => fr.abort()
        signal.addEventListener('abort', onAbort, { once: true })
      }
      fr.readAsText(f)
    })
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file || !enabled) return
    setLoading(true)
    setError(null)

    const ac = new AbortController()
    acRef.current = ac

    try {
      const content = await readFileAsText(file, ac.signal)
      const filepath = resolvedPath(file)
      const resp = await updateFile(filepath, content, { signal: ac.signal, background: true })
      const { error: toolErr } = decodeEncodedResult(resp)
      if (toolErr) throw new Error(toolErr)
      onSuccess?.(resp, filepath)
    } catch (e: any) {
      const msg = e?.message || String(e)
      if (import.meta && (import.meta as any).env?.DEV) console.error('[FileUpload] failed', msg, e)
      setError(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
      acRef.current = null
    }
  }, [enabled, file, onError, onSuccess, readFileAsText, resolvedPath, updateFile])

  return (
    <div className={containerClassName} style={containerStyle}>
      <input
        type="file"
        accept={accept}
        onChange={onFileChange}
        disabled={!enabled || loading}
        className={inputClassName}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={handleUpload}
        disabled={!canUpload}
        className={buttonClassName}
        style={buttonStyle}
        aria-busy={loading || undefined}
      >
        {loading ? 'Uploading…' : 'Upload'}
      </button>
      {loading ? (
        <div className={progressClassName} style={progressStyle} aria-live="polite">
          {progress}%
        </div>
      ) : null}
      {error ? (
        <div className={errorClassName} style={errorStyle} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  )
}

export default FileUpload
