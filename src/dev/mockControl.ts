export type MockSettings = {
  quote_lifetime_seconds: number
  delay_ms: number
  fault: 'none' | 'http_500' | 'drop'
  clock_offset_seconds: number
}

const TIMEOUT_MS = 10_000

// Its own helper, so the app's request code never learns the mock exists.
async function call<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const method = body === undefined ? 'GET' : 'POST'
  signal?.throwIfAborted()
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', forwardAbort)
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`/__mock${path}`, {
      method,
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok)
      throw new Error(`${method} /__mock${path} answered ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

export async function getMockSettings(
  signal?: AbortSignal,
): Promise<MockSettings> {
  const state = await call<{ settings: MockSettings }>(
    '/state',
    undefined,
    signal,
  )
  return state.settings
}

export async function setMockStatus(
  reference: string,
  status: string,
  confirmations?: number,
): Promise<void> {
  await call(`/payments/${encodeURIComponent(reference)}/status`, {
    status,
    confirmations,
  })
}

export function updateMockSettings(
  patch: Partial<MockSettings>,
): Promise<MockSettings> {
  return call('/settings', patch)
}
