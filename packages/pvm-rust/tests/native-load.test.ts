/**
 * Smoke test: load the Rust PVM native binding and call init / getProgramCounter.
 * Passes as long as the native addon is built and loadable.
 */

import { describe, expect, test } from 'bun:test'

describe('pvm-rust native binding', () => {
  test('loads native module and init/getProgramCounter work', () => {
    const native = require('@pbnjam/pvm-rust-native/native') as {
      init: (ramType: number) => void
      getProgramCounter: () => number
      getRamTypePvmRam: () => number
    }
    expect(native).toBeDefined()
    expect(typeof native.init).toBe('function')
    expect(typeof native.getProgramCounter).toBe('function')

    native.init(native.getRamTypePvmRam())
    const pc = native.getProgramCounter()
    expect(typeof pc).toBe('number')
    expect(pc).toBe(0)
  })
})
