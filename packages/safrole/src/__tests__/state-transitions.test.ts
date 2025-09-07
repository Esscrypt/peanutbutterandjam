/**
 * Safrole State Transition Tests
 *
 * Tests the Safrole STF implementation against Gray Paper specifications
 * Reference: graypaper/text/safrole.tex
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { executeSafroleSTF } from '../state-transitions'
import type { 
  SafroleInput, 
  SafroleState,
  ValidatorKey
} from '@pbnj/types'

// Initialize logger for tests
beforeAll(() => {
  logger.init()
})

describe('Safrole State Transitions', () => {
  const mockValidatorKey: ValidatorKey = {
    bandersnatch:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    ed25519:
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    bls: `0x${'0'.repeat(288)}`,
    metadata: `0x${'0'.repeat(256)}`,
  }

  const mockState: SafroleState = {
    pendingSet: [mockValidatorKey],
    epochRoot:
      '0x4444444444444444444444444444444444444444444444444444444444444444',
    sealTickets: [],
    ticketAccumulator: [],
  }

  it('should handle regular slot progression', async () => {
    const input: SafroleInput = {
      slot: 1n,
      entropy: '0x5555555555555555555555555555555555555555555555555555555555555555',
      extrinsic: [],
    }

    // Mock additional parameters required by the function
    const stagingSet: ValidatorKey[] = [mockValidatorKey]
    const activeSet: ValidatorKey[] = [mockValidatorKey]
    const offenders = new Set<string>()

    const result = await executeSafroleSTF(mockState, input, 0, stagingSet, activeSet, offenders)

    expect(result.state.pendingSet).toEqual([mockValidatorKey])
    expect(result.tickets).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should handle epoch transition', async () => {
    const input: SafroleInput = {
      slot: 600n, // Start of new epoch
      entropy: '0x6666666666666666666666666666666666666666666666666666666666666666',
      extrinsic: [],
    }

    // Mock additional parameters required by the function
    const stagingSet: ValidatorKey[] = [mockValidatorKey]
    const activeSet: ValidatorKey[] = [mockValidatorKey]
    const offenders = new Set<string>()

    const result = await executeSafroleSTF(mockState, input, 599, stagingSet, activeSet, offenders)

    expect(result.state.pendingSet).toEqual([mockValidatorKey])
    expect(result.tickets).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should validate slot progression', async () => {
    const input: SafroleInput = {
      slot: 0n, // Same slot as current state
      entropy: '0x7777777777777777777777777777777777777777777777777777777777777777',
      extrinsic: [],
    }

    // Mock additional parameters required by the function
    const stagingSet: ValidatorKey[] = [mockValidatorKey]
    const activeSet: ValidatorKey[] = [mockValidatorKey]
    const offenders = new Set<string>()

    await expect(executeSafroleSTF(mockState, input, 0, stagingSet, activeSet, offenders)).rejects.toThrow(
      'Invalid slot: 0 <= 0',
    )
  })

  it('should validate extrinsic limits', async () => {
    const input: SafroleInput = {
      slot: 1n,
      entropy: '0x8888888888888888888888888888888888888888888888888888888888888888',
      extrinsic: Array(11).fill({
        entryIndex: 0n,
        signature: `0x${'0'.repeat(128)}`,
      }),
    }

    // Mock additional parameters required by the function
    const stagingSet: ValidatorKey[] = [mockValidatorKey]
    const activeSet: ValidatorKey[] = [mockValidatorKey]
    const offenders = new Set<string>()

    await expect(executeSafroleSTF(mockState, input, 0, stagingSet, activeSet, offenders)).rejects.toThrow(
      'Too many extrinsics: 11 > 10',
    )
  })

  it('should process ticket submissions', async () => {
    const input: SafroleInput = {
      slot: 1n,
      entropy: '0x9999999999999999999999999999999999999999999999999999999999999999',
      extrinsic: [
        {
          entryIndex: 0n,
          signature:
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
        {
          entryIndex: 1n,
          signature:
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      ],
    }

    // Mock additional parameters required by the function
    const stagingSet: ValidatorKey[] = [mockValidatorKey]
    const activeSet: ValidatorKey[] = [mockValidatorKey]
    const offenders = new Set<string>()

    const result = await executeSafroleSTF(mockState, input, 0, stagingSet, activeSet, offenders)

    expect(result.state.pendingSet).toEqual([mockValidatorKey])
    expect(result.tickets).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('should validate ticket entry indices', async () => {
    const input: SafroleInput = {
      slot: 1n,
      entropy: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      extrinsic: [
        { entryIndex: 1001n, signature: `0x${'0'.repeat(128)}` }, // Exceeds MAX_TICKET_ENTRIES
      ],
    }

    // Mock additional parameters required by the function
    const stagingSet: ValidatorKey[] = [mockValidatorKey]
    const activeSet: ValidatorKey[] = [mockValidatorKey]
    const offenders = new Set<string>()

    await expect(executeSafroleSTF(mockState, input, 0, stagingSet, activeSet, offenders)).rejects.toThrow(
      'Invalid entry index',
    )
  })
})
