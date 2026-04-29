/**
 * Tests for the useFlag hook.
 *
 * Context is injected directly via SignaKitContext.Provider so these tests
 * are fully isolated from SignaKitProvider's init logic.
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useFlag } from '../use-flag'
import { SignaKitContext } from '../provider'
import type { SignaKitContextValue } from '../provider'
import type { SignaKitDecision, SignaKitUserContext } from '@signakit/flags-browser'

function makeMockDecision(overrides: Partial<SignaKitDecision> = {}): SignaKitDecision {
  return {
    flagKey: 'test-flag',
    variationKey: 'on',
    enabled: true,
    ruleKey: null,
    ruleType: null,
    variables: {},
    ...overrides,
  }
}

function makeMockUserContext(decide?: (key: string) => SignaKitDecision | null): SignaKitUserContext {
  return {
    userId: 'test-user',
    decide: vi.fn().mockImplementation(decide ?? (() => makeMockDecision())),
    decideAll: vi.fn().mockReturnValue({}),
    trackEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as SignaKitUserContext
}

function makeWrapper(value: SignaKitContextValue) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <SignaKitContext.Provider value={value}>{children}</SignaKitContext.Provider>
  }
}

describe('useFlag', () => {
  it('returns LOADING_RESULT while the provider is initializing', () => {
    const wrapper = makeWrapper({ userContext: null, loading: true })
    const { result } = renderHook(() => useFlag('dark-mode'), { wrapper })

    expect(result.current.loading).toBe(true)
    expect(result.current.enabled).toBe(false)
    expect(result.current.variationKey).toBe('off')
  })

  it('returns decision result once the provider is ready', () => {
    const userContext = makeMockUserContext(() =>
      makeMockDecision({ flagKey: 'dark-mode', variationKey: 'on', enabled: true })
    )
    const wrapper = makeWrapper({ userContext, loading: false })
    const { result } = renderHook(() => useFlag('dark-mode'), { wrapper })

    expect(result.current.loading).toBe(false)
    expect(result.current.enabled).toBe(true)
    expect(result.current.variationKey).toBe('on')
  })

  it('returns OFF_RESULT when decide returns null', () => {
    const userContext = makeMockUserContext(() => null)
    const wrapper = makeWrapper({ userContext, loading: false })
    const { result } = renderHook(() => useFlag('unknown-flag'), { wrapper })

    expect(result.current.enabled).toBe(false)
    expect(result.current.variationKey).toBe('off')
    expect(result.current.loading).toBe(false)
  })

  it('returns off when userContext is null after loading (e.g. init failed)', () => {
    const wrapper = makeWrapper({ userContext: null, loading: false })
    const { result } = renderHook(() => useFlag('dark-mode'), { wrapper })

    // The hook treats missing userContext the same as still-loading — flag is off either way
    expect(result.current.enabled).toBe(false)
    expect(result.current.variationKey).toBe('off')
  })

  it('calls decide with the correct flag key', () => {
    const userContext = makeMockUserContext()
    const wrapper = makeWrapper({ userContext, loading: false })
    renderHook(() => useFlag('new-checkout-flow'), { wrapper })

    expect(userContext.decide).toHaveBeenCalledWith('new-checkout-flow')
  })

  it('re-evaluates when the userContext changes (e.g. after userId change)', () => {
    const ctxA = makeMockUserContext(() => makeMockDecision({ variationKey: 'control' }))
    const ctxB = makeMockUserContext(() => makeMockDecision({ variationKey: 'treatment' }))

    // Mutable reference so the wrapper component picks up the change on rerender
    let contextValue: SignaKitContextValue = { userContext: ctxA, loading: false }
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <SignaKitContext.Provider value={contextValue}>{children}</SignaKitContext.Provider>
    }

    const { result, rerender } = renderHook(() => useFlag('checkout-flow'), { wrapper: Wrapper })
    expect(result.current.variationKey).toBe('control')

    act(() => {
      contextValue = { userContext: ctxB, loading: false }
    })
    rerender()

    expect(result.current.variationKey).toBe('treatment')
  })

  it('throws when used outside a SignaKitProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useFlag('test-flag'))).toThrow(
      'useFlag must be used inside a <SignaKitProvider>'
    )
    spy.mockRestore()
  })
})
