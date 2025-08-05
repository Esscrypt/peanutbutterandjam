/**
 * Tests for PVM General Functions
 *
 * Tests all 14 General functions from Gray Paper Appendix B.7
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { ACCUMULATE_ERROR_CODES, GENERAL_FUNCTIONS } from '../config'
import { dispatchGeneralFunction, type GeneralContext } from '../general'

// Mock RAM implementation for testing
class MockRam {
  public cells: Map<number, number> = new Map()

  readOctet(address: number): number {
    if (address < 0) {
      throw new Error('Invalid address')
    }
    return this.cells.get(address) || 0
  }

  writeOctet(address: number, value: number): void {
    if (address < 0) {
      throw new Error('Invalid address')
    }
    this.cells.set(address, value)
  }

  readOctets(address: number, count: number): number[] {
    const result: number[] = []
    for (let i = 0; i < count; i++) {
      result.push(this.readOctet(address + i))
    }
    return result
  }

  writeOctets(address: number, values: number[]): void {
    values.forEach((value, index) => {
      this.writeOctet(address + index, value)
    })
  }

  isReadable(address: number): boolean {
    return address >= 0
  }

  isWritable(address: number): boolean {
    return address >= 0
  }

  getMemoryLayout(): {
    stackStart: number
    heapStart: number
    totalSize: number
  } {
    return { stackStart: 0, heapStart: 1000, totalSize: 10000 }
  }
}

describe('General Functions', () => {
  let context: GeneralContext

  beforeEach(() => {
    // Initialize context
    context = {
      gasCounter: 1000n,
      registers: {
        r0: 0n,
        r1: 0n,
        r2: 0n,
        r3: 0n,
        r4: 0n,
        r5: 0n,
        r6: 0n,
        r7: 0n,
        r8: 0,
        r9: 0,
        r10: 0,
        r11: 0,
        r12: 0,
      },
      memory: new MockRam(),
      currentServiceId: 0,
    }
  })

  describe('gas function (0)', () => {
    it('should return current gas counter', () => {
      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.GAS, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(990n) // 1000 - 10
    })

    it('should return oog for insufficient gas', () => {
      context.gasCounter = 5n // Less than required gas

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.GAS, context)

      expect(result.executionState).toBe('oog')
    })
  })

  describe('fetch function (1)', () => {
    it('should return NONE for unknown fetch mode', () => {
      context.registers.r7 = 1000n // Output address
      context.registers.r10 = 999 // Unknown mode

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.FETCH, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.NONE)
    })

    it('should return panic for invalid memory access', () => {
      context.registers.r7 = -1n // Invalid output address
      context.registers.r10 = 0 // Constants mode

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.FETCH, context)

      expect(result.executionState).toBe('panic')
    })
  })

  describe('lookup function (2)', () => {
    it('should return NONE for non-existent service account', () => {
      context.registers.r7 = 999n // Non-existent service ID
      context.registers.r8 = 1000 // Hash address
      context.registers.r9 = 2000 // Output address

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.LOOKUP, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.NONE)
    })

    it('should return panic for invalid memory access', () => {
      context.registers.r7 = 0n // Current service
      context.registers.r8 = -1 // Invalid hash address
      context.registers.r9 = 2000 // Output address

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.LOOKUP, context)

      expect(result.executionState).toBe('panic')
    })
  })

  describe('read function (3)', () => {
    it('should return WHO error for invalid service account', () => {
      context.registers.r7 = 999n // Non-existent service ID
      context.registers.r8 = 1000 // Key address
      context.registers.r9 = 32 // Key length
      context.registers.r10 = 2000 // Output address

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.READ, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.WHO)
    })

    it('should return NONE for non-existent storage key', () => {
      // Set up a service account with empty storage
      context.serviceAccount = {
        storage: new Map(),
        balance: 1000n,
        minbalance: 100n,
      }
      context.registers.r7 = 2n ** 64n - 1n // Current service
      context.registers.r8 = 1000 // Key address
      context.registers.r9 = 32 // Key length
      context.registers.r10 = 2000 // Output address

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.READ, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.NONE)
    })
  })

  describe('write function (4)', () => {
    it('should return WHO error when no service account provided', () => {
      context.registers.r7 = 1000n // Key address
      context.registers.r8 = 32 // Key length
      context.registers.r9 = 2000 // Value address
      context.registers.r10 = 64 // Value length

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.WRITE, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.WHO)
    })

    it('should handle delete operation', () => {
      // Set up a service account
      context.serviceAccount = {
        storage: new Map([['test-key', new Uint8Array([1, 2, 3])]]),
        balance: 1000n,
        minbalance: 100n,
      }
      context.registers.r7 = 1000n // Key address
      context.registers.r8 = 32 // Key length
      context.registers.r9 = 2000 // Value address
      context.registers.r10 = 0 // Value length (delete)

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.WRITE, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(0n)
      expect(result.serviceAccount).toBeDefined()
    })
  })

  describe('info function (5)', () => {
    it('should return NONE for non-existent service account', () => {
      context.registers.r7 = 999n // Non-existent service ID
      context.registers.r8 = 1000 // Output address

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.INFO, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.NONE)
    })
  })

  describe('historical_lookup function (6)', () => {
    it('should return NONE for non-existent data', () => {
      const result = dispatchGeneralFunction(
        GENERAL_FUNCTIONS.HISTORICAL_LOOKUP,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.NONE)
    })
  })

  describe('export function (7)', () => {
    it('should return success', () => {
      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.EXPORT, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(0n)
    })
  })

  describe('machine function (8)', () => {
    it('should return success', () => {
      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.MACHINE, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(0n)
    })
  })

  describe('peek function (9)', () => {
    it('should return success', () => {
      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.PEEK, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(0n)
    })
  })

  describe('poke function (10)', () => {
    it('should return success', () => {
      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.POKE, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(0n)
    })
  })

  describe('pages function (11)', () => {
    it('should return success', () => {
      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.PAGES, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(0n)
    })
  })

  describe('invoke function (12)', () => {
    it('should return success', () => {
      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.INVOKE, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(0n)
    })
  })

  describe('expunge function (13)', () => {
    it('should return success', () => {
      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.EXPUNGE, context)

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(0n)
    })
  })

  describe('dispatch function', () => {
    it('should return panic for unknown function ID', () => {
      const result = dispatchGeneralFunction(999, context)

      expect(result.executionState).toBe('panic')
    })

    it('should return oog for insufficient gas', () => {
      context.gasCounter = 5n // Less than required gas

      const result = dispatchGeneralFunction(GENERAL_FUNCTIONS.GAS, context)

      expect(result.executionState).toBe('oog')
    })
  })
})
