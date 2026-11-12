import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

// Not on first mount: the page opening is not a change, and taking focus then would skip what comes before.
export function useFocusOnChange<T extends HTMLElement>(
  key: string,
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const last = useRef(key)
  useEffect(() => {
    if (last.current === key) return
    last.current = key
    ref.current?.focus()
  }, [key])
  return ref
}
