/**
 * Tests for PVM Accumulate Functions
 *
 * Tests all 13 Accumulate functions from Gray Paper Appendix B.7
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  type AccumulateContext,
  dispatchAccumulateFunction,
  type ServiceAccount,
  type SystemState,
} from '../accumulate'
import { ACCUMULATE_ERROR_CODES, ACCUMULATE_FUNCTIONS } from '../config'

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

describe('Accumulate Functions', () => {
  let context: AccumulateContext
  let systemState: SystemState

  beforeEach(() => {
    // Initialize system state
    systemState = {
      accounts: new Map(),
      authqueue: new Map(),
      assigners: new Map(),
      stagingset: [],
      nextfreeid: 65536,
      manager: 0,
      registrar: 0,
      delegator: 0,
      alwaysaccers: new Map(),
      xfers: [],
      provisions: new Map(),
      yield: null,
    }

    // Create a default service account
    const defaultService: ServiceAccount = {
      codehash: new Uint8Array(32),
      storage: new Map(),
      requests: new Map(),
      balance: 1000n,
      minaccgas: 10n,
      minmemogas: 10n,
      preimages: new Map(),
      created: Date.now(),
      gratis: false,
      lastacc: 0,
      parent: 0,
      items: 2,
      minbalance: 100n,
      octets: 81,
    }
    systemState.accounts.set(0, defaultService)

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
      state: systemState,
      currentTime: Date.now(),
      currentServiceId: 0,
    }
  })

  describe('bless function (14)', () => {
    it('should return WHO error for invalid service IDs', () => {
      context.registers.r7 = 2n ** 32n // Invalid manager ID
      context.registers.r8 = 1000 // Auth data address
      context.registers.r9 = Number(2n ** 32n) // Invalid validator ID
      context.registers.r10 = Number(2n ** 32n) // Invalid registrar ID
      context.registers.r11 = 2000 // Zone data address
      context.registers.r12 = 1 // Zone count

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.BLESS,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.WHO)
    })

    it('should return panic for invalid memory access', () => {
      context.registers.r7 = 1n
      context.registers.r8 = -1 // Invalid address
      context.registers.r9 = 1
      context.registers.r10 = 1
      context.registers.r11 = 2000
      context.registers.r12 = 1

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.BLESS,
        context,
      )

      expect(result.executionState).toBe('panic')
    })
  })

  describe('assign function (15)', () => {
    it('should return CORE error for invalid core count', () => {
      context.registers.r7 = 341n // Invalid core count (>= Ccorecount)
      context.registers.r8 = 1000n // Queue data address
      context.registers.r9 = 1n // Service ID

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.ASSIGN,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.CORE)
    })

    it('should return HUH error for unauthorized assignment', () => {
      context.registers.r7 = 0n // Core 0
      context.registers.r8 = 1000n // Queue data address
      context.registers.r9 = 1n // Service ID

      // Set assigner for core 0 to a different service
      context.state.assigners.set(0, 999)

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.ASSIGN,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.HUH)
    })
  })

  describe('designate function (16)', () => {
    it('should return HUH error for unauthorized designation', () => {
      context.registers.r7 = 1000n // Validator data address

      // Set delegator to a different service
      context.state.delegator = 999

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.DESIGNATE,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.HUH)
    })
  })

  describe('checkpoint function (17)', () => {
    it('should update gas counter and continue', () => {
      const initialGas = context.gasCounter
      context.registers.r7 = 123n

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.CHECKPOINT,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(initialGas - 10n)
    })
  })

  describe('new function (18)', () => {
    it('should create new service with generated ID', () => {
      // Set registrar to a different service so current service is not registrar
      context.state.registrar = 999

      context.registers.r7 = 1000n // Code hash address
      context.registers.r8 = 32n // Code length
      context.registers.r9 = 10n // Min acc gas
      context.registers.r10 = 10n // Min memo gas
      context.registers.r11 = 0n // Not gratis
      context.registers.r12 = 0n // No desired ID

      // Write code hash to memory
      const codeHash = new Uint8Array(32).fill(1)
      for (let i = 0; i < 32; i++) {
        context.memory.writeOctet(1000 + i, codeHash[i])
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.NEW,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(BigInt(context.state.nextfreeid))
      expect(result.state.accounts.size).toBe(2) // Original + new
    })

    it('should return FULL error for duplicate desired ID', () => {
      context.registers.r7 = 1000n // Code hash address
      context.registers.r8 = 32n // Code length
      context.registers.r9 = 10n // Min acc gas
      context.registers.r10 = 10n // Min memo gas
      context.registers.r11 = 0n // Not gratis
      context.registers.r12 = 0n // Desired ID (already exists)

      // Set current service as registrar
      context.state.registrar = 0

      // Write code hash to memory
      const codeHash = new Uint8Array(32).fill(1)
      for (let i = 0; i < 32; i++) {
        context.memory.writeOctet(1000 + i, codeHash[i])
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.NEW,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.FULL)
    })
  })

  describe('upgrade function (19)', () => {
    it('should upgrade service code', () => {
      context.registers.r7 = 1000n // New code hash address
      context.registers.r8 = 20n // New min acc gas
      context.registers.r9 = 30n // New min memo gas

      // Write new code hash to memory
      const newCodeHash = new Uint8Array(32).fill(2)
      for (let i = 0; i < 32; i++) {
        context.memory.writeOctet(1000 + i, newCodeHash[i])
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.UPGRADE,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.OK)
    })
  })

  describe('transfer function (20)', () => {
    it('should return WHO error for invalid destination', () => {
      context.registers.r7 = 999n // Non-existent service ID
      context.registers.r8 = 100n // Amount
      context.registers.r9 = 10n // Gas
      context.registers.r10 = 1000n // Memo address

      // Write memo to memory
      for (let i = 0; i < 128; i++) {
        context.memory.writeOctet(1000 + i, i % 256)
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.TRANSFER,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.WHO)
    })

    it('should return CASH error for insufficient balance', () => {
      // Create destination service
      const destService: ServiceAccount = {
        codehash: new Uint8Array(32),
        storage: new Map(),
        requests: new Map(),
        balance: 100n,
        minaccgas: 10n,
        minmemogas: 5n,
        preimages: new Map(),
        created: Date.now(),
        gratis: false,
        lastacc: 0,
        parent: 0,
        items: 2,
        minbalance: 50n,
        octets: 81,
      }
      context.state.accounts.set(1, destService)

      context.registers.r7 = 1n // Destination service ID
      context.registers.r8 = 30n // Amount (less than minbalance of 100n)
      context.registers.r9 = 10n // Gas
      context.registers.r10 = 1000n // Memo address

      // Write memo to memory
      for (let i = 0; i < 128; i++) {
        context.memory.writeOctet(1000 + i, i % 256)
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.TRANSFER,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.CASH)
    })
  })

  describe('eject function (21)', () => {
    it('should return WHO error for invalid service', () => {
      context.registers.r7 = 999n // Non-existent service ID
      context.registers.r8 = 1000n // Hash address

      // Write hash to memory
      const hash = new Uint8Array(32).fill(3)
      for (let i = 0; i < 32; i++) {
        context.memory.writeOctet(1000 + i, hash[i])
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.EJECT,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.WHO)
    })
  })

  describe('query function (22)', () => {
    it('should return NONE for non-existent request', () => {
      context.registers.r7 = 1000n // Hash address
      context.registers.r8 = 0n // Zone

      // Write hash to memory
      const hash = new Uint8Array(32).fill(4)
      for (let i = 0; i < 32; i++) {
        context.memory.writeOctet(1000 + i, hash[i])
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.QUERY,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.NONE)
    })
  })

  describe('solicit function (23)', () => {
    it('should create new request', () => {
      context.registers.r7 = 1000n // Hash address
      context.registers.r8 = 0n // Zone

      // Write hash to memory
      const hash = new Uint8Array(32).fill(5)
      for (let i = 0; i < 32; i++) {
        context.memory.writeOctet(1000 + i, hash[i])
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.SOLICIT,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.OK)
    })
  })

  describe('forget function (24)', () => {
    it('should return HUH for non-existent request', () => {
      context.registers.r7 = 1000n // Hash address
      context.registers.r8 = 0n // Zone

      // Write hash to memory
      const hash = new Uint8Array(32).fill(6)
      for (let i = 0; i < 32; i++) {
        context.memory.writeOctet(1000 + i, hash[i])
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.FORGET,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.HUH)
    })
  })

  describe('yield function (25)', () => {
    it('should set yield hash', () => {
      context.registers.r7 = 1000n // Hash address

      // Write hash to memory
      const hash = new Uint8Array(32).fill(7)
      for (let i = 0; i < 32; i++) {
        context.memory.writeOctet(1000 + i, hash[i])
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.YIELD,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.OK)
      expect(result.state.yield).toEqual(hash)
    })
  })

  describe('provide function (26)', () => {
    it('should return WHO error for invalid service', () => {
      context.registers.r7 = 999n // Non-existent service ID
      context.registers.r8 = 1000n // Input data address
      context.registers.r9 = 32n // Input data length

      // Write input data to memory
      const inputData = new Uint8Array(32).fill(8)
      for (let i = 0; i < 32; i++) {
        context.memory.writeOctet(1000 + i, inputData[i])
      }

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.PROVIDE,
        context,
      )

      expect(result.executionState).toBe('continue')
      expect(result.registers.r7).toBe(ACCUMULATE_ERROR_CODES.WHO)
    })
  })

  describe('dispatch function', () => {
    it('should return panic for unknown function ID', () => {
      const result = dispatchAccumulateFunction(999, context)

      expect(result.executionState).toBe('panic')
    })

    it('should return oog for insufficient gas', () => {
      context.gasCounter = 5n // Less than required gas

      const result = dispatchAccumulateFunction(
        ACCUMULATE_FUNCTIONS.CHECKPOINT,
        context,
      )

      expect(result.executionState).toBe('oog')
    })
  })
})
