import { useEffect, useRef, useState } from 'react'

export type CopyState = 'idle' | 'copied' | 'failed'

const SHOWN_FOR_MS = { copied: 2_000, failed: 4_000 } as const

export function useCopy(value: string): { state: CopyState; copy(): void } {
  // A new object on every copy, so a second copy restarts the timer even when the state is unchanged.
  const [shown, setShown] = useState<{ state: CopyState }>({ state: 'idle' })
  const mounted = useRef(false)

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
    // The clipboard can settle after the screen has moved on; that result is no longer anyone's.
    const show = (state: CopyState) => {
      if (mounted.current) setShown({ state })
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

  return { state: shown.state, copy }
}
