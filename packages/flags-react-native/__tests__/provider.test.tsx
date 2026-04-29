/**
 * @jest-environment jsdom
 *
 * Tests for SignaKitProvider (React Native SDK).
 *
 * The local client module is mocked so tests never touch the real SDK or network.
 * The mock client controls the lifecycle: onReady resolves/rejects, createUserContext
 * returns a fake context.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { SignaKitProvider, SignaKitContext } from '../src/provider'
import { createInstance } from '../src/client'
import type { SignaKitContextValue } from '../src/provider'

jest.mock('../src/client', () => ({
  createInstance: jest.fn(),
}))

const mockCreateInstance = jest.mocked(createInstance)

function makeMockUserContext(userId = 'test-user') {
  return {
    userId,
    decide: jest.fn().mockReturnValue(null),
    decideAll: jest.fn().mockReturnValue({}),
    trackEvent: jest.fn().mockResolvedValue(undefined),
  }
}

function makeMockClient(opts?: { readySuccess?: boolean; readyReason?: string }) {
  const mockCtx = makeMockUserContext()
  const client = {
    onReady: jest.fn().mockResolvedValue({
      success: opts?.readySuccess ?? true,
      reason: opts?.readyReason,
    }),
    createUserContext: jest.fn().mockReturnValue(mockCtx),
  }
  return { client, mockCtx }
}

const VALID_SDK_KEY = 'sk_dev_org123_proj123_abc'

describe('SignaKitProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading fallback while client is initializing', () => {
    const { client } = makeMockClient()
    client.onReady.mockReturnValue(new Promise(() => {})) // never resolves
    mockCreateInstance.mockReturnValue(client as never)

    render(
      <SignaKitProvider sdkKey={VALID_SDK_KEY} userId="user-1" loadingFallback={<div>Loading…</div>}>
        <div>Content</div>
      </SignaKitProvider>
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders children once client is ready', async () => {
    const { client } = makeMockClient()
    mockCreateInstance.mockReturnValue(client as never)

    render(
      <SignaKitProvider sdkKey={VALID_SDK_KEY} userId="user-1" loadingFallback={<div>Loading…</div>}>
        <div>Content</div>
      </SignaKitProvider>
    )

    await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument())
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('calls createInstance with the correct sdkKey', async () => {
    const { client } = makeMockClient()
    mockCreateInstance.mockReturnValue(client as never)

    render(
      <SignaKitProvider sdkKey={VALID_SDK_KEY} userId="user-1">
        <div>Content</div>
      </SignaKitProvider>
    )

    await waitFor(() => screen.getByText('Content'))
    expect(mockCreateInstance).toHaveBeenCalledWith({ sdkKey: VALID_SDK_KEY, persistConfig: undefined })
  })

  it('passes persistConfig to createInstance when provided', async () => {
    const { client } = makeMockClient()
    mockCreateInstance.mockReturnValue(client as never)

    render(
      <SignaKitProvider sdkKey={VALID_SDK_KEY} userId="user-1" persistConfig>
        <div>Content</div>
      </SignaKitProvider>
    )

    await waitFor(() => screen.getByText('Content'))
    expect(mockCreateInstance).toHaveBeenCalledWith({ sdkKey: VALID_SDK_KEY, persistConfig: true })
  })

  it('renders children (fail open) when createInstance returns null', async () => {
    mockCreateInstance.mockReturnValue(null)

    render(
      <SignaKitProvider sdkKey="sk_dev_bad_key_here" userId="user-1">
        <div>Content</div>
      </SignaKitProvider>
    )

    await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument())
  })

  it('renders children (fail open) when onReady reports failure', async () => {
    const { client } = makeMockClient()
    client.onReady.mockResolvedValue({ success: false, reason: 'Network unavailable' })
    mockCreateInstance.mockReturnValue(client as never)

    render(
      <SignaKitProvider sdkKey={VALID_SDK_KEY} userId="user-1">
        <div>Content</div>
      </SignaKitProvider>
    )

    await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument())
  })

  it('creates user context with the correct userId and attributes', async () => {
    const { client } = makeMockClient()
    mockCreateInstance.mockReturnValue(client as never)

    render(
      <SignaKitProvider sdkKey={VALID_SDK_KEY} userId="user-42" attributes={{ plan: 'premium' }}>
        <div>Content</div>
      </SignaKitProvider>
    )

    await waitFor(() => screen.getByText('Content'))
    expect(client.createUserContext).toHaveBeenCalledWith('user-42', { plan: 'premium' })
  })

  it('recreates user context when userId changes', async () => {
    const { client } = makeMockClient()
    mockCreateInstance.mockReturnValue(client as never)

    const { rerender } = render(
      <SignaKitProvider sdkKey={VALID_SDK_KEY} userId="user-1">
        <div>Content</div>
      </SignaKitProvider>
    )

    await waitFor(() => screen.getByText('Content'))
    expect(client.createUserContext).toHaveBeenCalledWith('user-1', undefined)

    rerender(
      <SignaKitProvider sdkKey={VALID_SDK_KEY} userId="user-2">
        <div>Content</div>
      </SignaKitProvider>
    )

    await waitFor(() => expect(client.createUserContext).toHaveBeenCalledWith('user-2', undefined))
  })

  it('exposes userContext and loading=false through context after ready', async () => {
    const { client, mockCtx } = makeMockClient()
    mockCreateInstance.mockReturnValue(client as never)

    const capture = { ctx: null as SignaKitContextValue | null }

    function Capture() {
      capture.ctx = React.useContext(SignaKitContext)
      return null
    }

    render(
      <SignaKitProvider sdkKey={VALID_SDK_KEY} userId="user-1">
        <Capture />
      </SignaKitProvider>
    )

    await waitFor(() => {
      expect(capture.ctx?.loading).toBe(false)
    })
    expect(capture.ctx?.userContext).toBe(mockCtx)
  })
})
