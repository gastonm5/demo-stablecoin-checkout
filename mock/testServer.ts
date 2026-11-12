import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Express } from 'express'

export function startServer(
  app: Express,
): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer(app)
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done, fail) => {
            server.close((err) => (err ? fail(err) : done()))
            // A test that fails mid-request leaves a socket open, and close() would wait on it.
            server.closeAllConnections()
          }),
      })
    })
  })
}
