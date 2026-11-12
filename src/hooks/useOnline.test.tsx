import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useOnline } from './useOnline'

test('starts from navigator.onLine', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  const { result } = renderHook(() => useOnline())
  expect(result.current).toBe(false)
})

test('follows the offline and online events', () => {
  const onLine = vi.spyOn(navigator, 'onLine', 'get')
  const { result } = renderHook(() => useOnline())
  expect(result.current).toBe(true)

  onLine.mockReturnValue(false)
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })
  expect(result.current).toBe(false)

  onLine.mockReturnValue(true)
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
  expect(result.current).toBe(true)
})

test('removes its listeners on unmount', () => {
  const removeListener = vi.spyOn(window, 'removeEventListener')
  const { unmount } = renderHook(() => useOnline())
  unmount()
  expect(removeListener).toHaveBeenCalledWith('online', expect.any(Function))
  expect(removeListener).toHaveBeenCalledWith('offline', expect.any(Function))
})
