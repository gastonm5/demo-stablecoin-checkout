import { useEffect, useState } from 'react'

export function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = setInterval(tick, intervalMs)
    // A hidden tab's timers are throttled, so the clock can be minutes behind when the tab returns.
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs])
  return now
}
