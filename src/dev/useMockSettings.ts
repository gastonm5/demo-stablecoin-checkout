import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { getMockSettings, updateMockSettings } from './mockControl'
import type { MockSettings } from './mockControl'

// Answers can arrive out of order, and only the newest request's answer is what the mock holds now.
// A failed command changes nothing: the buttons keep marking what the mock last said.
function keepNewest(
  latest: RefObject<number>,
  request: Promise<MockSettings>,
  keep: (settings: MockSettings) => void,
): void {
  const id = ++latest.current
  request.then(
    (settings) => {
      if (id === latest.current) keep(settings)
    },
    () => {},
  )
}

export function useMockSettings(open: boolean): {
  settings: MockSettings | undefined
  update(patch: Partial<MockSettings>): void
} {
  const [settings, setSettings] = useState<MockSettings>()
  const latest = useRef(0)

  // One read per opening, so the buttons match the mock after a reload; the page beside the panel shows the rest.
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    keepNewest(latest, getMockSettings(controller.signal), setSettings)
    return () => controller.abort()
  }, [open])

  return {
    settings,
    update: (patch) =>
      keepNewest(latest, updateMockSettings(patch), setSettings),
  }
}
