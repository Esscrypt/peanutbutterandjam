/**
 * Safrole ticket serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 266-269):
 *
 * encode(ST ∈ safroleticket) ≡ encode(
 *   ST_id,
 *   ST_entryindex
 * )
 *
 * encodeTickets(XT_tickets) = encode(var{XT_tickets})
 *
 * Implements Gray Paper Safrole ticket serialization as specified
 * Reference: graypaper/text/safrole.tex and serialization.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Safrole tickets are the foundation of JAM's consensus mechanism.
 * They provide verifiable randomness and determine block authorship.
 *
 * Ticket structure:
 * 1. **ID** (32 bytes): Unique ticket identifier/hash
 * 2. **Entry index** (variable): Position in the entropy accumulator
 *
 * Key concepts:
 * - Tickets are lottery entries for block production rights
 * - Entry index determines when ticket becomes "winning"
 * - VRF (Verifiable Random Function) ensures unpredictable but verifiable selection
 * - Multiple tickets can exist per validator per epoch
 *
 * The variable-length encoding for tickets themselves (var{XT_tickets})
 * allows blocks to contain 0 to many tickets efficiently.
 *
 * This is critical for JAM's hybrid consensus combining both
 * BABE-style slot-based authorship and finality mechanisms.
 */

import {
  bytesToBigInt,
  bytesToHex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { SafroleTicket } from '@pbnj/types'
import { encodeNatural } from '../core/natural-number'

/**
 * Encode Safrole ticket
 *
 * @param ticket - Safrole ticket to encode
 * @returns Encoded octet sequence
 */
export function encodeSafroleTicket(ticket: SafroleTicket): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // ID (32 Uint8Array)
  parts.push(hexToBytes(ticket.id))

  // Entry index (8 Uint8Array)
  const [error, encoded] = encodeNatural(ticket.entryIndex)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // Concatenate all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return safeResult(result)
}

/**
 * Decode Safrole ticket
 *
 * @param data - Octet sequence to decode
 * @returns Decoded Safrole ticket and remaining data
 */
export function decodeSafroleTicket(data: Uint8Array): Safe<{
  value: SafroleTicket
  remaining: Uint8Array
}> {
  let currentData = data

  // ID (32 Uint8Array)
  const id = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Entry index (8 Uint8Array)
  const entryIndex = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  return safeResult({
    value: {
      id,
      entryIndex,
    },
    remaining: currentData,
  })
}
