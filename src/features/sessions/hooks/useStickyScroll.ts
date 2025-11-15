import { useEffect, useMemo, useRef, useState } from 'react'

export type UseStickyScrollOptions = {
  containerRef: React.RefObject<HTMLElement | null>
  bottomRef?: React.RefObject<HTMLElement | null>
  topRef?: React.RefObject<HTMLElement | null>
  // Changes when the tail item changes (e.g., last message id for bottom-stick,
  // first task id for top-stick). Autoscroll triggers only on tailKey change
  // while near-home.
  tailKey: string | number | null | undefined
  // Which edge to stick to.
  stickTo: 'bottom' | 'top'
  enabled?: boolean
  // Identity that resets initial snapping when the view/session changes.
  key?: string | number | null | undefined
  // How close (px) to consider "near" the edge.
  threshold?: number
}

export function useStickyScroll({
  containerRef,
  bottomRef,
  topRef,
  tailKey,
  stickTo,
  enabled = true,
  key,
  threshold = 8,
}: UseStickyScrollOptions) {
  const [nearBottom, setNearBottom] = useState<boolean>(stickTo === 'bottom')
  const [nearTop, setNearTop] = useState<boolean>(stickTo === 'top')
  const prevTailRef = useRef<string | number | null | undefined>(undefined)

  // Compute near-top using scrollTop; this is more reliable than IO for the top edge.
  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    const handleScroll = () => {
      if (stickTo === 'top') {
        setNearTop(el.scrollTop <= threshold)
      }
    }

    // Initialize
    handleScroll()

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [containerRef, enabled, stickTo, threshold])

  // Use IntersectionObserver to detect when the bottom sentinel is within
  // the viewport (plus a small threshold). When intersecting, we're near-bottom.
  useEffect(() => {
    if (!enabled) return
    if (stickTo !== 'bottom') return
    const root = containerRef.current
    const target = bottomRef?.current
    if (!root || !target) return

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === target) {
            setNearBottom(e.isIntersecting)
          }
        }
      },
      {
        root,
        // Expand the root bottom edge by threshold px so we consider "near"
        // even if the sentinel is just below the visible area.
        rootMargin: `0px 0px ${Math.max(0, threshold)}px 0px`,
        threshold: 0,
      }
    )

    obs.observe(target)
    return () => {
      try {
        obs.disconnect()
      } catch {}
    }
  }, [containerRef, bottomRef, enabled, stickTo, threshold])

  // Snap to the edge on key change (view/session changes) when content exists
  useEffect(() => {
    if (!enabled) return
    const node = containerRef.current
    if (!node) return

    const doSnap = () => {
      if (stickTo === 'bottom') {
        const anchor = bottomRef?.current
        if (anchor && 'scrollIntoView' in anchor) {
          anchor.scrollIntoView({ behavior: 'auto', block: 'end' })
        } else {
          node.scrollTo({ top: node.scrollHeight, behavior: 'auto' })
        }
      } else {
        node.scrollTo({ top: 0, behavior: 'auto' })
      }
    }

    // Defer to next frame so layout has settled.
    requestAnimationFrame(doSnap)
  }, [key, enabled, containerRef, bottomRef, stickTo])

  // On tailKey change: if we're near-home, stick to the edge smoothly.
  useEffect(() => {
    if (!enabled) return
    const node = containerRef.current
    if (!node) return

    const prev = prevTailRef.current
    if (prev === undefined) {
      // Initialize previous key but don't scroll; initial snap handled by key effect.
      prevTailRef.current = tailKey
      return
    }

    if (tailKey === prev) return

    const closeEnough = stickTo === 'bottom' ? nearBottom : nearTop

    if (closeEnough) {
      requestAnimationFrame(() => {
        if (stickTo === 'bottom') {
          const anchor = bottomRef?.current
          if (anchor && 'scrollIntoView' in anchor) {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'end' })
          } else {
            node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
          }
        } else {
          node.scrollTo({ top: 0, behavior: 'smooth' })
        }
      })
    }

    prevTailRef.current = tailKey
  }, [tailKey, enabled, containerRef, bottomRef, stickTo, nearBottom, nearTop])

  const isStuck = useMemo(() => (stickTo === 'bottom' ? nearBottom : nearTop), [stickTo, nearBottom, nearTop])
  return { isStuck }
}
