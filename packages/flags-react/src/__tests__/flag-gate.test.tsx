/**
 * Tests for the FlagGate component.
 *
 * Context is injected directly via SignaKitContext.Provider.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FlagGate } from '../flag-gate'
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

function makeMockUserContext(enabled: boolean): SignaKitUserContext {
  return {
    userId: 'test-user',
    decide: vi.fn().mockReturnValue(makeMockDecision({ enabled, variationKey: enabled ? 'on' : 'off' })),
    decideAll: vi.fn().mockReturnValue({}),
    trackEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as SignaKitUserContext
}

function renderWithContext(value: SignaKitContextValue, ui: React.ReactNode) {
  return render(<SignaKitContext.Provider value={value}>{ui}</SignaKitContext.Provider>)
}

describe('FlagGate', () => {
  it('renders children when the flag is enabled', () => {
    const userContext = makeMockUserContext(true)
    renderWithContext(
      { userContext, loading: false },
      <FlagGate flag="dark-mode">
        <div>Feature content</div>
      </FlagGate>
    )

    expect(screen.getByText('Feature content')).toBeInTheDocument()
  })

  it('renders null by default when the flag is disabled', () => {
    const userContext = makeMockUserContext(false)
    const { container } = renderWithContext(
      { userContext, loading: false },
      <FlagGate flag="dark-mode">
        <div>Feature content</div>
      </FlagGate>
    )

    expect(screen.queryByText('Feature content')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('renders custom fallback when the flag is disabled', () => {
    const userContext = makeMockUserContext(false)
    renderWithContext(
      { userContext, loading: false },
      <FlagGate flag="dark-mode" fallback={<div>Fallback content</div>}>
        <div>Feature content</div>
      </FlagGate>
    )

    expect(screen.queryByText('Feature content')).not.toBeInTheDocument()
    expect(screen.getByText('Fallback content')).toBeInTheDocument()
  })

  it('renders fallback while the provider is loading', () => {
    renderWithContext(
      { userContext: null, loading: true },
      <FlagGate flag="dark-mode" fallback={<div>Loading fallback</div>}>
        <div>Feature content</div>
      </FlagGate>
    )

    // loading=true means useFlag returns enabled=false → renders fallback
    expect(screen.queryByText('Feature content')).not.toBeInTheDocument()
    expect(screen.getByText('Loading fallback')).toBeInTheDocument()
  })
})
