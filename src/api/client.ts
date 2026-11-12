import { parseProblem } from './schemas'
import type { Problem } from './schemas'

export const REQUEST_TIMEOUT_MS = 10_000

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly problem?: Problem

  constructor(
    kind: ApiErrorKind,
    message: string,
    details: { status?: number; problem?: Problem; cause?: unknown } = {},
  ) {
    super(message, { cause: details.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = details.status
    this.problem = details.problem
  }
}

export async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: unknown
    signal?: AbortSignal
    parse: (json: unknown) => T
  },
): Promise<T> {
  const { method = 'GET', body, signal, parse } = options
  const name = `${method} ${path}`
  signal?.throwIfAborted()

  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', forwardAbort)
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await send(name, path, parse, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      // A cached awaiting_payment must never stand in for a fresh one.
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error) {
    // An abort or a timeout can surface from any step, so it wins over what that step made of it.
    if (signal?.aborted) throw signal.reason
    if (controller.signal.aborted) {
      const message = `${name} gave up after ${REQUEST_TIMEOUT_MS} ms`
      throw new ApiError('timeout', message, { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

async function send<T>(
  name: string,
  path: string,
  parse: (json: unknown) => T,
  init: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch (cause) {
    throw new ApiError('network', `${name} did not reach the server`, { cause })
  }
  if (!response.ok) {
    // A problem body is an answer the callers branch on; any other body tells them nothing more.
    const problem = parseProblem(await response.json().catch(() => null))
    throw new ApiError('http', `${name} answered ${response.status}`, {
      status: response.status,
      problem: problem ?? undefined,
    })
  }
  try {
    return parse(await response.json())
  } catch (cause) {
    const message = `${name} sent a body that does not validate`
    throw new ApiError('invalid', message, { cause })
  }
}
