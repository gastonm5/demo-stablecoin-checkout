import { useEffect, useState } from 'react'

export function useNow(active: boolean, intervalMs = 1_000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    // Stopped, the value goes stale: a caller must not read it as the time.
    if (!active) return
    const tick = () => setNow(Date.now())
    const timer = setInterval(tick, intervalMs)
    // A hidden tab's timers are throttled, so the clock can be minutes behind when the tab returns.
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [active, intervalMs])
  return now
}
