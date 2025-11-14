/**
 * Safrole Serialization Tests
 *
 * Tests for encodeSafrole and decodeSafrole functions
 * to ensure Gray Paper compliance.
 */

import { describe, expect, it } from 'vitest'
import type { SafroleState, SafroleTicket, ValidatorPublicKeys } from '@pbnj/types'
import { CORE_CONSTANTS } from '@pbnj/types'
import { decodeSafrole, encodeSafrole } from '../state/safrole'
import { ConfigService } from '../../../../infra/node/services/config-service'
const configService = new ConfigService('tiny')

describe('Safrole Serialization', () => {
  // Mock validator public keys for testing
  const mockValidator: ValidatorPublicKeys = {
    bandersnatch: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    ed25519: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    bls: '0x' + 'a'.repeat(288) as `0x${string}`, // 144 bytes = 288 hex chars
    metadata: '0x' + 'b'.repeat(256) as `0x${string}`, // 128 bytes = 256 hex chars
  }

  // Mock safrole ticket for testing (state version - no proof needed)
  const mockTicket: SafroleTicket = {
    id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    entryIndex: 1n,
    proof: '0x' + '0'.repeat(128) as `0x${string}`, // Placeholder proof for state tickets
  }

  it('should encode and decode safrole state with tickets', () => {
    const safroleState: SafroleState = {
      pendingSet: [mockValidator],
      epochRoot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      sealTickets: Array(CORE_CONSTANTS.C_EPOCHLEN).fill(mockTicket),
      ticketAccumulator: [mockTicket],
    }

    // Encode
    const [encodeError, encodedData] = encodeSafrole(safroleState)
    expect(encodeError).toBeNull()
    expect(encodedData).toBeDefined()

    // Decode
    const [decodeError, decodedResult] = decodeSafrole(encodedData!, configService)
    expect(decodeError).toBeNull()
    expect(decodedResult).toBeDefined()

    const decoded = decodedResult!.value

    // Verify decoded data matches original
    expect(decoded.pendingSet).toHaveLength(1)
    expect(decoded.pendingSet[0].bandersnatch).toBe(mockValidator.bandersnatch)
    expect(decoded.pendingSet[0].ed25519).toBe(mockValidator.ed25519)
    expect(decoded.pendingSet[0].bls).toBe(mockValidator.bls)
    expect(decoded.pendingSet[0].metadata).toBe(mockValidator.metadata)

    expect(decoded.epochRoot).toBe(safroleState.epochRoot)
    expect(decoded.sealTickets).toHaveLength(CORE_CONSTANTS.C_EPOCHLEN)
    expect(decoded.ticketAccumulator).toHaveLength(1)
    expect(decoded.ticketAccumulator[0].id).toBe(mockTicket.id)
    expect(decoded.ticketAccumulator[0].entryIndex).toBe(mockTicket.entryIndex)
  })

  it('should encode and decode safrole state with Bandersnatch keys (fallback mode)', () => {
    // Create Bandersnatch keys (32 bytes each)
    const bandersnatchKeys = Array(CORE_CONSTANTS.C_EPOCHLEN).fill(
      new Uint8Array(32).fill(0x42)
    )

    const safroleState: SafroleState = {
      pendingSet: [mockValidator],
      epochRoot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      sealTickets: bandersnatchKeys,
      ticketAccumulator: [mockTicket],
    }

    // Encode
    const [encodeError, encodedData] = encodeSafrole(safroleState)
    expect(encodeError).toBeNull()
    expect(encodedData).toBeDefined()

    // Decode
    const [decodeError, decodedResult] = decodeSafrole(encodedData!, configService)
    expect(decodeError).toBeNull()
    expect(decodedResult).toBeDefined()

    const decoded = decodedResult!.value

    // Verify decoded data matches original
    expect(decoded.pendingSet).toHaveLength(1)
    expect(decoded.epochRoot).toBe(safroleState.epochRoot)
    expect(decoded.sealTickets).toHaveLength(CORE_CONSTANTS.C_EPOCHLEN)
    expect(decoded.ticketAccumulator).toHaveLength(1)
  })

  it('should handle empty ticket accumulator', () => {
    const safroleState: SafroleState = {
      pendingSet: [],
      epochRoot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      sealTickets: Array(CORE_CONSTANTS.C_EPOCHLEN).fill(mockTicket),
      ticketAccumulator: [],
    }

    // Encode
    const [encodeError, encodedData] = encodeSafrole(safroleState)
    expect(encodeError).toBeNull()
    expect(encodedData).toBeDefined()

    // Decode
    const [decodeError, decodedResult] = decodeSafrole(encodedData!, configService)
    expect(decodeError).toBeNull()
    expect(decodedResult).toBeDefined()

    const decoded = decodedResult!.value
    expect(decoded.ticketAccumulator).toHaveLength(0)
  })

  it('should handle multiple validators in pending set', () => {
    const validators = [mockValidator, mockValidator, mockValidator]

    const safroleState: SafroleState = {
      pendingSet: validators,
      epochRoot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      sealTickets: Array(CORE_CONSTANTS.C_EPOCHLEN).fill(mockTicket),
      ticketAccumulator: [mockTicket],
    }

    // Encode
    const [encodeError, encodedData] = encodeSafrole(safroleState)
    expect(encodeError).toBeNull()
    expect(encodedData).toBeDefined()

    // Decode
    const [decodeError, decodedResult] = decodeSafrole(encodedData!, configService)
    expect(decodeError).toBeNull()
    expect(decodedResult).toBeDefined()

    const decoded = decodedResult!.value
    expect(decoded.pendingSet).toHaveLength(3)
  })

  it('should handle multiple tickets in accumulator', () => {
    const tickets = [
      mockTicket,
      { ...mockTicket, id: '0x' + '1'.repeat(64) as `0x${string}`, entryIndex: 2n },
      { ...mockTicket, id: '0x' + '2'.repeat(64) as `0x${string}`, entryIndex: 3n },
    ]

    const safroleState: SafroleState = {
      pendingSet: [mockValidator],
      epochRoot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      sealTickets: Array(CORE_CONSTANTS.C_EPOCHLEN).fill(mockTicket),
      ticketAccumulator: tickets,
    }

    // Encode
    const [encodeError, encodedData] = encodeSafrole(safroleState)
    expect(encodeError).toBeNull()
    expect(encodedData).toBeDefined()

    // Decode
    const [decodeError, decodedResult] = decodeSafrole(encodedData!, configService)
    expect(decodeError).toBeNull()
    expect(decodedResult).toBeDefined()

    const decoded = decodedResult!.value
    expect(decoded.ticketAccumulator).toHaveLength(3)
    expect(decoded.ticketAccumulator[0].id).toBe(tickets[0].id)
    expect(decoded.ticketAccumulator[1].id).toBe(tickets[1].id)
    expect(decoded.ticketAccumulator[2].id).toBe(tickets[2].id)
  })
})
