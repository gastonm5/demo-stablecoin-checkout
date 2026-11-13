// In a module of their own so tests can replace them: jsdom cannot spy on window.location.
export const reloadPage = () => window.location.reload()

export const openPicker = () => window.location.assign(window.location.pathname)
