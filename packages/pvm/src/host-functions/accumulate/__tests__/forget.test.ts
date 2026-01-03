import { describe, it, expect, beforeEach } from 'bun:test'
import { bytesToHex, type Hex } from '@pbnjam/core'
import type {
  RAM,
  RegisterState,
  ImplicationsPair,
  ServiceAccount,
  PartialState,
} from '@pbnjam/types'
import { ForgetHostFunction } from '../forget'
import { ACCUMULATE_ERROR_CODES, RESULT_CODES } from '../../../config'
import {
  getServiceRequestValue,
  setServiceRequestValue,
  createServiceRequestKey,
} from '@pbnjam/codec'

describe('ForgetHostFunction', () => {
  let forgetFunction: ForgetHostFunction
  let mockRAM: RAM
  let mockRegisters: RegisterState
  let mockImplications: ImplicationsPair
  let mockServiceAccount: ServiceAccount
  let serviceId: bigint
  let hashBytes: Uint8Array
  let hashHex: Hex
  let preimageLength: bigint
  let timeslot: bigint
  let expungePeriod: bigint

  beforeEach(() => {
    forgetFunction = new ForgetHostFunction()
    serviceId = 0n
    hashBytes = new Uint8Array(32).fill(0x42)
    hashHex = bytesToHex(hashBytes)
    preimageLength = 100n
    timeslot = 1000n
    expungePeriod = 32n // Test vector expunge period

    // Create mock RAM that can read the hash
    mockRAM = {
      currentHeapPointer: 0,
      readOctets: (offset: bigint, length: bigint) => {
        if (offset === 0n && length === 32n) {
          return [hashBytes, null]
        }
        return [null, offset] // Fault address
      },
      writeOctets: () => null,
      isReadableWithFault: () => [true, null],
      isWritableWithFault: () => [true, null],
      allocatePages: () => {},
      initializeMemoryLayout: () => {},
      initializePage: () => {},
      setPageAccessRights: () => {},
      setPageAccessRightsForRange: () => {},
      getPageAccessType: () => 'read' as const,
      getPageMap: () => ({}),
      getMemoryDump: () => new Map(),
      reset: () => {},
    } as unknown as RAM

    // Create mock registers with hash offset and preimage length
    mockRegisters = new Array(16).fill(0n) as RegisterState
    mockRegisters[7] = 0n // hashOffset
    mockRegisters[8] = preimageLength

    // Create mock service account
    mockServiceAccount = {
      codehash: ('0x' + '00'.repeat(32)) as Hex,
      balance: 1000n,
      minaccgas: 100n,
      minmemogas: 50n,
      octets: 200n,
      gratis: 0n,
      items: 4n,
      created: 1n,
      lastacc: 1n,
      parent: 0n,
      rawCshKeyvals: {},
    }

    // Create mock implications with service account
    const mockState: PartialState = {
      accounts: new Map([[serviceId, mockServiceAccount]]),
      stagingset: [],
      authqueue: [],
      manager: 0n,
      assigners: [],
      delegator: 0n,
      registrar: 0n,
      alwaysaccers: new Map(),
    }

    mockImplications = [
      {
        id: serviceId,
        state: mockState,
      },
      {
        id: serviceId,
        state: mockState,
      },
    ] as ImplicationsPair
  })

  describe('request value length 0 (empty array [])', () => {
    it('should delete request and update items/octets', () => {
      // Set up empty request value
      setServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
        [],
      )

      const initialItems = mockServiceAccount.items
      const initialOctets = mockServiceAccount.octets

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should succeed
      expect(result.resultCode).toBeNull()
      expect(mockRegisters[7]).toBe(ACCUMULATE_ERROR_CODES.OK)

      // Request should be deleted
      const requestValue = getServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
      )
      expect(requestValue).toBeUndefined()

      // Items should be decremented by 2
      expect(mockServiceAccount.items).toBe(
        initialItems >= 2n ? initialItems - 2n : 0n,
      )

      // Octets should be decremented by (81 + preimageLength)
      expect(mockServiceAccount.octets).toBe(
        initialOctets >= 81n + preimageLength
          ? initialOctets - (81n + preimageLength)
          : 0n,
      )
    })
  })

  describe('request value length 1 ([x])', () => {
    it('should update to [x, t]', () => {
      const x = 500n
      setServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
        [x],
      )

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should succeed
      expect(result.resultCode).toBeNull()
      expect(mockRegisters[7]).toBe(ACCUMULATE_ERROR_CODES.OK)

      // Request should be updated to [x, timeslot]
      const requestValue = getServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
      )
      expect(requestValue).toEqual([x, timeslot])
    })
  })

  describe('request value length 2 ([x, y])', () => {
    it('should delete request when y < t - Cexpungeperiod', () => {
      const x = 500n
      const y = timeslot - expungePeriod - 1n // y < t - Cexpungeperiod
      setServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
        [x, y],
      )

      const initialItems = mockServiceAccount.items
      const initialOctets = mockServiceAccount.octets

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should succeed
      expect(result.resultCode).toBeNull()
      expect(mockRegisters[7]).toBe(ACCUMULATE_ERROR_CODES.OK)

      // Request should be deleted
      const requestValue = getServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
      )
      expect(requestValue).toBeUndefined()

      // Items and octets should be decremented
      expect(mockServiceAccount.items).toBe(
        initialItems >= 2n ? initialItems - 2n : 0n,
      )
      expect(mockServiceAccount.octets).toBe(
        initialOctets >= 81n + preimageLength
          ? initialOctets - (81n + preimageLength)
          : 0n,
      )
    })

    it('should error HUH when y >= t - Cexpungeperiod', () => {
      const x = 500n
      const y = timeslot - expungePeriod // y >= t - Cexpungeperiod
      setServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
        [x, y],
      )

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should error
      expect(result.resultCode).toBeNull() // Continue execution
      expect(mockRegisters[7]).toBe(ACCUMULATE_ERROR_CODES.HUH)

      // Request should not be deleted
      const requestValue = getServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
      )
      expect(requestValue).toEqual([x, y])
    })
  })

  describe('request value length 3 ([x, y, w])', () => {
    it('should update to [w, t] when y < t - Cexpungeperiod', () => {
      const x = 400n
      const y = timeslot - expungePeriod - 1n // y < t - Cexpungeperiod
      const w = 600n
      setServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
        [x, y, w],
      )

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should succeed
      expect(result.resultCode).toBeNull()
      expect(mockRegisters[7]).toBe(ACCUMULATE_ERROR_CODES.OK)

      // Request should be updated to [w, timeslot]
      const requestValue = getServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
      )
      expect(requestValue).toEqual([w, timeslot])
    })

    it('should error HUH when y >= t - Cexpungeperiod', () => {
      const x = 400n
      const y = timeslot - expungePeriod // y >= t - Cexpungeperiod
      const w = 600n
      setServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
        [x, y, w],
      )

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should error
      expect(result.resultCode).toBeNull() // Continue execution
      expect(mockRegisters[7]).toBe(ACCUMULATE_ERROR_CODES.HUH)

      // Request should not be modified
      const requestValue = getServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
      )
      expect(requestValue).toEqual([x, y, w])
    })
  })

  describe('request value length 4+', () => {
    it('should error HUH for invalid length', () => {
      // Note: setServiceRequestValue will throw for length > 3, so we need to
      // manually set the rawCshKeyvals to simulate an invalid state
      const requestStateKey = createServiceRequestKey(
        serviceId,
        hashHex,
        preimageLength,
      )
      const stateKeyHex = bytesToHex(requestStateKey)

      // Manually encode a 4-element sequence (invalid)
      // This simulates a corrupted or invalid state
      const invalidValue = new Uint8Array([4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) // 4 timeslots
      mockServiceAccount.rawCshKeyvals[stateKeyHex] = bytesToHex(invalidValue)

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should error
      expect(result.resultCode).toBeNull() // Continue execution
      expect(mockRegisters[7]).toBe(ACCUMULATE_ERROR_CODES.HUH)
    })
  })

  describe('error cases', () => {
    it('should PANIC when memory read fails', () => {
      const faultRAM: RAM = {
        currentHeapPointer: 0,
        readOctets: () => [null, 0n], // Fault address
        writeOctets: () => null,
        isReadableWithFault: () => [false, 0n],
        isWritableWithFault: () => [false, 0n],
        allocatePages: () => {},
        initializeMemoryLayout: () => {},
        initializePage: () => {},
        setPageAccessRights: () => {},
        setPageAccessRightsForRange: () => {},
        getPageAccessType: () => 'none' as const,
        getPageMap: () => ({}),
        getMemoryDump: () => new Map(),
        reset: () => {},
      } as unknown as RAM

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: faultRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should PANIC
      expect(result.resultCode).toBe(RESULT_CODES.PANIC)
    })

    it('should error HUH when service account is missing', () => {
      const emptyState: PartialState = {
        accounts: new Map(),
        stagingset: [],
        authqueue: [],
        manager: 0n,
        assigners: [],
        delegator: 0n,
        registrar: 0n,
        alwaysaccers: new Map(),
      }

      const emptyImplications: ImplicationsPair = [
        {
          id: serviceId,
          state: emptyState,
        },
        {
          id: serviceId,
          state: emptyState,
        },
      ] as ImplicationsPair

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: emptyImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should error
      expect(result.resultCode).toBeNull() // Continue execution
      expect(mockRegisters[7]).toBe(ACCUMULATE_ERROR_CODES.HUH)
    })

    it('should error HUH when request does not exist', () => {
      // Don't set any request value
      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      const result = forgetFunction.execute(context)

      // Should error
      expect(result.resultCode).toBeNull() // Continue execution
      expect(mockRegisters[7]).toBe(ACCUMULATE_ERROR_CODES.HUH)
    })
  })

  describe('edge cases for items and octets', () => {
    it('should handle items underflow correctly', () => {
      // Set items to 1 (less than 2)
      mockServiceAccount.items = 1n
      setServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
        [],
      )

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      forgetFunction.execute(context)

      // Items should be 0 (not negative)
      expect(mockServiceAccount.items).toBe(0n)
    })

    it('should handle octets underflow correctly', () => {
      // Set octets to less than (81 + preimageLength)
      mockServiceAccount.octets = 50n // Less than 81 + 100 = 181
      setServiceRequestValue(
        mockServiceAccount,
        serviceId,
        hashHex,
        preimageLength,
        [],
      )

      const context = {
        gasCounter: 1000n,
        registers: mockRegisters,
        ram: mockRAM,
        implications: mockImplications,
        timeslot,
        expungePeriod,
        log: () => {},
      }

      forgetFunction.execute(context)

      // Octets should be 0 (not negative)
      expect(mockServiceAccount.octets).toBe(0n)
    })
  })
})

