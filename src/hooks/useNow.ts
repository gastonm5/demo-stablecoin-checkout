import { useEffect, useState } from 'react'

export function useNow(active: boolean, intervalMs = 1_000): number | null {
  const [now, setNow] = useState(() => (active ? Date.now() : null))
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(Date.now())
    const timer = setInterval(tick, intervalMs)
    // A hidden tab's timers are throttled, so the clock can be minutes behind when the tab returns.
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      // A kept sample would be read as the time when the clock starts again, even after the device clock went back.
      setNow(null)
    }
  }, [active, intervalMs])
  return now
}
