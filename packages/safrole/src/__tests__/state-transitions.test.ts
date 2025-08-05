/**
 * Safrole State Transition Tests
 *
 * Tests the Safrole STF implementation against Gray Paper specifications
 * Reference: graypaper/text/safrole.tex
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { executeSafroleSTF } from '../state-transitions'
import type { SafroleInput, SafroleState } from '../types'

// Initialize logger for tests
beforeAll(() => {
  logger.init()
})

describe('Safrole State Transitions', () => {
  const mockValidatorKey = {
    bandersnatch:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    ed25519:
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    bls: `0x${'0'.repeat(288)}`,
    metadata: `0x${'0'.repeat(256)}`,
  }

  const mockState: SafroleState = {
    slot: 0,
    entropy: [
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333333333333333333333333333',
    ],
    pendingSet: [mockValidatorKey],
    activeSet: [mockValidatorKey],
    previousSet: [mockValidatorKey],
    epochRoot:
      '0x4444444444444444444444444444444444444444444444444444444444444444',
    sealTickets: [],
    ticketAccumulator: [],
  }

  it('should handle regular slot progression', async () => {
    const input: SafroleInput = {
      slot: 1,
      entropy: [
        '0x5555555555555555555555555555555555555555555555555555555555555555',
      ],
      extrinsic: [],
    }

    const result = await executeSafroleSTF(mockState, input)

    expect(result.state.slot).toBe(1)
    expect(result.state.entropy[0]).toBe(input.entropy[0])
    expect(result.tickets).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should handle epoch transition', async () => {
    const input: SafroleInput = {
      slot: 600, // Start of new epoch
      entropy: [
        '0x6666666666666666666666666666666666666666666666666666666666666666',
      ],
      extrinsic: [],
    }

    const result = await executeSafroleSTF(mockState, input)

    expect(result.state.slot).toBe(600)
    expect(result.state.entropy[0]).toBe(input.entropy[0])
    expect(result.tickets).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should validate slot progression', async () => {
    const input: SafroleInput = {
      slot: 0, // Same slot as current state
      entropy: [
        '0x7777777777777777777777777777777777777777777777777777777777777777',
      ],
      extrinsic: [],
    }

    await expect(executeSafroleSTF(mockState, input)).rejects.toThrow(
      'Invalid slot: 0 <= 0',
    )
  })

  it('should validate extrinsic limits', async () => {
    const input: SafroleInput = {
      slot: 1,
      entropy: [
        '0x8888888888888888888888888888888888888888888888888888888888888888',
      ],
      extrinsic: Array(11).fill({
        entryIndex: 0,
        signature: `0x${'0'.repeat(128)}`,
      }),
    }

    await expect(executeSafroleSTF(mockState, input)).rejects.toThrow(
      'Too many extrinsics: 11 > 10',
    )
  })

  it('should process ticket submissions', async () => {
    const input: SafroleInput = {
      slot: 1,
      entropy: [
        '0x9999999999999999999999999999999999999999999999999999999999999999',
      ],
      extrinsic: [
        {
          entryIndex: 0,
          signature:
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
        {
          entryIndex: 1,
          signature:
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      ],
    }

    const result = await executeSafroleSTF(mockState, input)

    expect(result.state.slot).toBe(1)
    expect(result.state.entropy[0]).toBe(input.entropy[0])
    expect(result.tickets).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('should validate ticket entry indices', async () => {
    const input: SafroleInput = {
      slot: 1,
      entropy: [
        '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      ],
      extrinsic: [
        { entryIndex: 1001, signature: `0x${'0'.repeat(128)}` }, // Exceeds MAX_TICKET_ENTRIES
      ],
    }

    await expect(executeSafroleSTF(mockState, input)).rejects.toThrow(
      'Invalid entry index',
    )
  })
})
