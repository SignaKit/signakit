/**
 * @jest-environment jsdom
 *
 * Tests for useFlag hook (React Native SDK).
 *
 * Context is injected directly via SignaKitContext.Provider — no provider
 * init flow needed, keeping tests fast and deterministic.
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { useFlag } from '../src/use-flag'
import { SignaKitContext } from '../src/provider'
import type { SignaKitContextValue } from '../src/provider'
import type { SignaKitDecision } from '../src/types'

function makeDecision(overrides: Partial<SignaKitDecision> = {}): SignaKitDecision {
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

function makeUserContext(decide: (key: string) => SignaKitDecision | null = () => null) {
  return {
    userId: 'user-1',
    decide: jest.fn(decide),
    decideAll: jest.fn().mockReturnValue({}),
    trackEvent: jest.fn().mockResolvedValue(undefined),
  }
}

function makeWrapper(value: SignaKitContextValue) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <SignaKitContext.Provider value={value}>{children}</SignaKitContext.Provider>
  }
}

describe('useFlag', () => {
  it('returns LOADING_RESULT while loading', () => {
    const wrapper = makeWrapper({ userContext: null, loading: true })
    const { result } = renderHook(() => useFlag('test-flag'), { wrapper })

    expect(result.current.loading).toBe(true)
    expect(result.current.enabled).toBe(false)
    expect(result.current.variationKey).toBe('off')
  })

  it('returns decision result when context is ready', () => {
    const decision = makeDecision({ variationKey: 'on', enabled: true })
    const userContext = makeUserContext(() => decision) as never
    const wrapper = makeWrapper({ userContext, loading: false })

    const { result } = renderHook(() => useFlag('test-flag'), { wrapper })

    expect(result.current.loading).toBe(false)
    expect(result.current.enabled).toBe(true)
    expect(result.current.variationKey).toBe('on')
  })

  it('returns OFF_RESULT when decide returns null', () => {
    const userContext = makeUserContext(() => null) as never
    const wrapper = makeWrapper({ userContext, loading: false })

    const { result } = renderHook(() => useFlag('test-flag'), { wrapper })

    expect(result.current.loading).toBe(false)
    expect(result.current.enabled).toBe(false)
    expect(result.current.variationKey).toBe('off')
  })

  it('returns LOADING_RESULT when loading=false but userContext is null (client init failed)', () => {
    const wrapper = makeWrapper({ userContext: null, loading: false })
    const { result } = renderHook(() => useFlag('test-flag'), { wrapper })

    // Current behavior: hook treats missing userContext the same as still loading.
    expect(result.current.loading).toBe(true)
  })

  it('calls decide with the correct flagKey', () => {
    const userContext = makeUserContext() as never
    const wrapper = makeWrapper({ userContext, loading: false })

    renderHook(() => useFlag('my-feature'), { wrapper })

    expect((userContext as ReturnType<typeof makeUserContext>).decide).toHaveBeenCalledWith('my-feature')
  })

  it('re-evaluates the flag when the user context changes', () => {
    const ctxA = makeUserContext(() => makeDecision({ variationKey: 'control' })) as never
    const ctxB = makeUserContext(() => makeDecision({ variationKey: 'treatment' })) as never

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
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useFlag('test-flag'))).toThrow(
      'useFlag must be used inside a <SignaKitProvider>'
    )
    spy.mockRestore()
  })
})
