// <reference types="vitest" />
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// @testing-library/react only auto-calls cleanup when `afterEach` is a global
// (e.g. jest or vitest with globals:true). Explicit registration ensures cleanup
// runs between tests regardless of vitest's globals setting.
afterEach(() => {
  cleanup()
})
