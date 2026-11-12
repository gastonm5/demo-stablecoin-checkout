// @vitest-environment node
import type { Connect } from 'vite'
import { afterEach, expect, test, vi } from 'vitest'
import { CURRENCIES } from './fixtures'
import { startServer } from './testServer'
import { mockApiPlugin } from './vitePlugin'

const HOOKS = ['configureServer', 'configurePreviewServer'] as const

let server: { url: string; close(): Promise<void> } | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

function mount(hook: (typeof HOOKS)[number]) {
  const use = vi.fn<(middleware: Connect.NextHandleFunction) => void>()
  const register = mockApiPlugin()[hook] as (server: unknown) => void
  register({ middlewares: { use } })
  return use
}

test.each(HOOKS)('%s registers one middleware', (hook) => {
  const use = mount(hook)
  expect(use).toHaveBeenCalledOnce()
  expect(use.mock.calls[0]).toEqual([expect.any(Function)])
})

test.each(HOOKS)(
  '%s: the mock answers its routes and passes the rest on',
  async (hook) => {
    const [middleware] = mount(hook).mock.calls[0]
    server = await startServer((req, res) =>
      middleware(req, res, () => res.end('fallback')),
    )
    const api = await fetch(`${server.url}/api/currencies`)
    expect(api.status).toBe(200)
    expect(api.headers.get('x-powered-by')).toBeNull()
    expect(await api.json()).toEqual({ currencies: CURRENCIES })
    const page = await fetch(`${server.url}/index.html`)
    expect(page.headers.get('x-powered-by')).toBeNull()
    expect(await page.text()).toBe('fallback')
  },
)
