import { useEffect, useRef, useState } from 'react'

export type CopyState = 'idle' | 'copied' | 'failed'

const SHOWN_FOR_MS = { copied: 2_000, failed: 4_000 } as const

export function useCopy(value: string): { state: CopyState; copy(): void } {
  // A new object on every copy, so a second copy restarts the timer even when the state is unchanged.
  const [shown, setShown] = useState<{ state: CopyState; value?: string }>({
    state: 'idle',
  })
  const mounted = useRef(false)
  const latest = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (shown.state === 'idle') return
    const timer = setTimeout(
      () => setShown({ state: 'idle' }),
      SHOWN_FOR_MS[shown.state],
    )
    return () => clearTimeout(timer)
  }, [shown])

  function copy() {
    // The clipboard can settle after the screen has moved on or after a newer copy; that result is no longer anyone's.
    const attempt = ++latest.current
    const show = (state: CopyState) => {
      if (mounted.current && attempt === latest.current)
        setShown({ state, value })
    }
    try {
      navigator.clipboard.writeText(value).then(
        () => show('copied'),
        () => show('failed'),
      )
    } catch {
      // There is no clipboard outside a secure context, and some browsers throw instead of rejecting.
      show('failed')
    }
  }

  // Feedback belongs to the value it was for: once the value beside the button changes, it says nothing.
  return { state: shown.value === value ? shown.state : 'idle', copy }
}
