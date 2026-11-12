import type { Plugin } from 'vite'
import { createMockApp } from './app.ts'

// Mounted inside the dev server so `npm run dev` serves the page and the mock on one port.
export function mockApiPlugin(): Plugin {
  const app = createMockApp()
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use(app)
    },
    configurePreviewServer(server) {
      server.middlewares.use(app)
    },
  }
}
