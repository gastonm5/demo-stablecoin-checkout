import { useEffect, useState } from 'react'
import { getMockSettings, updateMockSettings } from './mockControl'
import type { MockSettings } from './mockControl'

export function useMockSettings(open: boolean): {
  settings: MockSettings | undefined
  update(patch: Partial<MockSettings>): void
} {
  const [settings, setSettings] = useState<MockSettings>()

  // One read per opening, so the buttons match the mock after a reload; the page beside the panel shows the rest.
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    // A failed or aborted read changes nothing.
    getMockSettings(controller.signal).then(setSettings, () => {})
    return () => controller.abort()
  }, [open])

  return {
    settings,
    update: (patch) => void updateMockSettings(patch).then(setSettings),
  }
}
