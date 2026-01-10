import { describe, test, expect } from 'bun:test'
import { generateNextServiceId } from '@pbnjam/codec'
import type { ServiceAccount } from '@pbnjam/types'

/**
 * Test for nextfreeid generation according to Gray Paper specification
 * 
 * This test verifies that nextfreeid is calculated correctly for both v0.7.0 and v0.7.1+
 * based on the formula:
 * - v0.7.0: (decode[4]{blake{...}} mod (2^32 - 2^9)) + 2^8
 * - v0.7.1+: (decode[4]{blake{...}} mod (2^32 - Cminpublicindex - 2^8)) + Cminpublicindex
 * 
 * Test parameters:
 * - serviceId: varies per test (10, 15)
 * - entropy: 32 bytes filled with 4
 * - timeslot: 6
 */
describe('generateNextServiceId', () => {
  test('should generate next service id correctly for v0.7.1+', () => {
    const serviceId = 10n
    const timeslot = 6n
    const expectedServiceId = 3126016330n

    // Set JAM version to v0.7.1
    const jamVersion = { major: 0, minor: 7, patch: 1 }

    // Create entropy accumulator: 32 bytes filled with 4
    const entropyAccumulator = new Uint8Array(32).fill(4)

    // Empty accounts map (no conflicts)
    const accounts = new Map<bigint, ServiceAccount>()

    // Call generateNextServiceId directly from core
    const [error, result] = generateNextServiceId(
      serviceId,
      entropyAccumulator,
      timeslot,
      accounts,
      jamVersion,
    )

    expect(error).toBeUndefined()
    expect(result).toBe(expectedServiceId)
  })

  test('should generate next service id correctly for v0.7.0', () => {
    const serviceId = 15n
    const timeslot = 6n
    const expectedServiceId = 2760772808n

    // Set JAM version to v0.7.0
    const jamVersion = { major: 0, minor: 7, patch: 0 }

    // Create entropy accumulator: 32 bytes filled with 4
    const entropyAccumulator = new Uint8Array(32).fill(4)

    // Empty accounts map (no conflicts)
    const accounts = new Map<bigint, ServiceAccount>()

    // Call generateNextServiceId directly from core
    const [error, result] = generateNextServiceId(
      serviceId,
      entropyAccumulator,
      timeslot,
      accounts,
      jamVersion,
    )

    expect(error).toBeUndefined()
    expect(result).toBe(expectedServiceId)
  })
})

