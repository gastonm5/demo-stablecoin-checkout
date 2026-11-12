// Browsers fire visibilitychange at the document and let it bubble; TanStack Query listens on window.
export function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
}

export function resetVisibility() {
  Reflect.deleteProperty(document, 'visibilityState')
}
