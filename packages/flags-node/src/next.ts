import { after } from 'next/server'
import { createInstance as _createInstance } from './index'
import type { SignaKitClientConfig } from './types'

export function createInstance(config: Omit<SignaKitClientConfig, 'scheduler'>) {
  return _createInstance({ ...config, scheduler: after })
}

export * from './index'
