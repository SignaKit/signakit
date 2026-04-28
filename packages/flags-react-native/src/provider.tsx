import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createInstance, SignaKitClient } from './client'
import type { SignaKitUserContext } from './user-context'
import type { UserAttributes } from './types'

export interface SignaKitContextValue {
  userContext: SignaKitUserContext | null
  loading: boolean
}

export const SignaKitContext = createContext<SignaKitContextValue | null>(null)

export interface SignaKitProviderProps {
  sdkKey: string
  userId: string
  attributes?: UserAttributes
  children: React.ReactNode
  /**
   * If true, persist the last good config to AsyncStorage so the app can
   * boot offline-tolerant. Requires `@react-native-async-storage/async-storage`.
   */
  persistConfig?: boolean
  /** Rendered while the client is initializing. Defaults to null. */
  loadingFallback?: React.ReactNode
}

export function SignaKitProvider({
  sdkKey,
  userId,
  attributes,
  children,
  persistConfig,
  loadingFallback = null,
}: SignaKitProviderProps) {
  const [userContext, setUserContext] = useState<SignaKitUserContext | null>(null)
  const [loading, setLoading] = useState(true)
  const clientRef = useRef<SignaKitClient | null>(null)

  // Initialize the client when sdkKey changes (or on mount).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setUserContext(null)
    clientRef.current = null

    async function init() {
      const client = createInstance({ sdkKey, persistConfig })
      if (!client) {
        console.error('[SignaKit] Failed to create client')
        if (!cancelled) setLoading(false)
        return
      }

      const result = await client.onReady()
      if (cancelled) return

      if (!result.success) {
        console.error('[SignaKit] Client failed to initialize:', result.reason)
        // Fail open: let children render.
        setLoading(false)
        return
      }

      clientRef.current = client
      const ctx = client.createUserContext(userId, attributes)
      setUserContext(ctx)
      setLoading(false)
    }

    init().catch((err) => {
      console.error('[SignaKit] Unexpected error during initialization:', err)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkKey, persistConfig])

  // Recreate userContext when userId or attributes change after the client is ready.
  useEffect(() => {
    if (loading || !clientRef.current) return
    const ctx = clientRef.current.createUserContext(userId, attributes)
    setUserContext(ctx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, attributes])

  return (
    <SignaKitContext.Provider value={{ userContext, loading }}>
      {loading ? loadingFallback : children}
    </SignaKitContext.Provider>
  )
}

export function useSignaKitContext(): SignaKitContextValue {
  const ctx = useContext(SignaKitContext)
  if (ctx === null) {
    throw new Error('[SignaKit] useFlag must be used inside a <SignaKitProvider>')
  }
  return ctx
}

/** Optional hook returning the active user context (or null while loading). */
export function useUserContext(): SignaKitUserContext | null {
  return useSignaKitContext().userContext
}
