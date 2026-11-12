import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { parseCurrencies } from '../api/schemas'
import { CURRENCIES_JSON } from '../test/fixtures'
import { usePickerChoice } from './usePickerChoice'

const currencies = parseCurrencies(CURRENCIES_JSON)

function renderChoice() {
  return renderHook(() => usePickerChoice(currencies))
}

test('starts with nothing chosen', () => {
  const { result } = renderChoice()
  expect(result.current.currencyCode).toBe('')
  expect(result.current.networkId).toBe('')
  expect(result.current.currency).toBeUndefined()
  expect(result.current.network).toBeUndefined()
  expect(result.current.choice).toBeNull()
})

test('choosing both gives the choice', () => {
  const { result } = renderChoice()
  act(() => result.current.setCurrency('USDT'))
  expect(result.current.choice).toBeNull()
  act(() => result.current.setNetwork('tron'))
  expect(result.current.choice).toEqual({ currency: 'USDT', network: 'tron' })
  expect(result.current.currency?.name).toBe('Tether')
  expect(result.current.network?.name).toBe('Tron (TRC-20)')
})

test('changing the currency clears the network', () => {
  const { result } = renderChoice()
  act(() => result.current.setCurrency('USDT'))
  act(() => result.current.setNetwork('ethereum'))
  // USDC has Ethereum too, and it must still be chosen again on purpose.
  act(() => result.current.setCurrency('USDC'))
  expect(result.current.currencyCode).toBe('USDC')
  expect(result.current.networkId).toBe('')
  expect(result.current.network).toBeUndefined()
  expect(result.current.choice).toBeNull()
})

test('a currency with one network selects it', () => {
  const { result } = renderChoice()
  act(() => result.current.setCurrency('ETH'))
  expect(result.current.networkId).toBe('ethereum')
  expect(result.current.choice).toEqual({
    currency: 'ETH',
    network: 'ethereum',
  })
})

test('ignores a network the currency does not have', () => {
  const { result } = renderChoice()
  act(() => result.current.setCurrency('USDT'))
  act(() => result.current.setNetwork('solana'))
  expect(result.current.networkId).toBe('')
  expect(result.current.choice).toBeNull()
})
