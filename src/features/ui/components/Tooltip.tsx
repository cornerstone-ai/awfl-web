import { useState, type ReactNode, useMemo } from 'react'

export type TooltipProps = {
  content: ReactNode
  children: ReactNode
  placement?: 'top' | 'bottom'
  align?: 'left' | 'center' | 'right'
  offset?: number
  disabled?: boolean
  wrapperStyle?: React.CSSProperties
  tooltipStyle?: React.CSSProperties
}

export function Tooltip({
  content,
  children,
  placement = 'bottom',
  align = 'center',
  offset = 6,
  disabled = false,
  wrapperStyle,
  tooltipStyle,
}: TooltipProps) {
  const [open, setOpen] = useState(false)

  const posStyle = useMemo<React.CSSProperties>(() => {
    const style: React.CSSProperties = { position: 'absolute' }
    if (placement === 'bottom') {
      style.top = `calc(100% + ${offset}px)`
    } else {
      style.bottom = `calc(100% + ${offset}px)`
    }

    if (align === 'left') {
      style.left = 0
      style.right = 'auto'
      style.transform = 'none'
    } else if (align === 'right') {
      style.right = 0
      style.left = 'auto'
      style.transform = 'none'
    } else {
      style.left = '50%'
      style.transform = 'translateX(-50%)'
    }

    return style
  }, [placement, align, offset])

  return (
    <span
      onMouseEnter={() => { if (!disabled) setOpen(true) }}
      onMouseLeave={() => setOpen(false)}
      style={{ position: 'relative', display: 'inline-flex', ...wrapperStyle }}
    >
      {children}
      {!disabled && open && (
        <div
          role="tooltip"
          style={{
            ...posStyle,
            background: '#111827',
            color: 'white',
            padding: '6px 8px',
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.3,
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            zIndex: 30,
            maxWidth: 300,
            whiteSpace: 'normal',
            ...tooltipStyle,
          }}
        >
          {content}
        </div>
      )}
    </span>
  )
}

export default Tooltip
