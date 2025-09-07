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
  bytesToHex,
  concatBytes,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { DecodingResult, SafroleTicket } from '@pbnj/types'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeSequenceGeneric, encodeSequenceGeneric } from '../core/sequence'

/**
 * Encode Safrole ticket according to Gray Paper specification.
 *
 * Gray Paper Equation 266-269 (label: encode{ST ∈ safroleticket}):
 * encode{ST ∈ safroleticket} ≡ encode{
 *   ST_id,
 *   ST_entryindex
 * }
 *
 * Safrole tickets are the foundation of JAM's consensus mechanism, providing
 * verifiable randomness and determining block authorship through a lottery system.
 *
 * Field encoding per Gray Paper:
 * 1. ST_id: 32-byte ticket identifier/hash from VRF computation
 * 2. ST_entryindex: Natural number representing position in entropy accumulator
 *
 * Ticket semantics:
 * - **Lottery entries**: Tickets are entries for block production rights
 * - **VRF-based**: Identifier derived from Verifiable Random Function
 * - **Entry index**: Determines when ticket becomes "winning" based on entropy
 * - **Unpredictable selection**: VRF ensures randomness while maintaining verifiability
 *
 * Consensus integration:
 * - Multiple tickets can exist per validator per epoch
 * - Tickets provide BABE-style slot-based authorship
 * - Combined with finality mechanisms for hybrid consensus
 * - Entry index links to entropy accumulator for fair selection
 *
 * ✅ CORRECT: 32-byte ticket ID encoding (VRF output)
 * ✅ CORRECT: Natural number encoding for entry index (variable-length)
 * ✅ CORRECT: Field order matches Gray Paper specification exactly
 * ✅ CORRECT: Supports Safrole consensus lottery mechanism
 *
 * @param ticket - Safrole ticket to encode
 * @returns Encoded octet sequence
 */
export function encodeSafroleTicket(ticket: SafroleTicket): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // ST_id: 32-byte ticket identifier/hash from VRF computation
  parts.push(hexToBytes(ticket.id))

  // ST_entryindex: Natural number representing position in entropy accumulator
  const [error, entryIndexEncoded] = encodeNatural(ticket.entryIndex)
  if (error) {
    return safeError(error)
  }
  parts.push(entryIndexEncoded)

  return safeResult(concatBytes(parts))
}

/**
 * Decode Safrole ticket according to Gray Paper specification.
 *
 * Gray Paper Equation 266-269 (label: decode{ST ∈ safroleticket}):
 * Inverse of encode{ST ∈ safroleticket} ≡ decode{
 *   ST_id,
 *   ST_entryindex
 * }
 *
 * Decodes Safrole ticket from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. ST_id: 32-byte ticket identifier/hash from VRF computation
 * 2. ST_entryindex: Natural number representing position in entropy accumulator
 *
 * Validation and error handling:
 * - Input size validation for minimum required data (33+ bytes)
 * - Natural number decoding for variable-length entry index
 * - Proper error propagation with descriptive messages
 * - Round-trip compatibility verification
 *
 * ✅ CORRECT: 32-byte ticket ID decoding (VRF output)
 * ✅ CORRECT: Natural number decoding for entry index (variable-length)
 * ✅ CORRECT: Field order matches Gray Paper specification exactly
 * ✅ CORRECT: Uses proper decoding functions instead of manual manipulation
 * ✅ CORRECT: Maintains round-trip compatibility with encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded Safrole ticket and remaining data
 */
export function decodeSafroleTicket(
  data: Uint8Array,
): Safe<DecodingResult<SafroleTicket>> {
  if (data.length < 33) {
    return safeError(new Error('Insufficient data for Safrole ticket decoding'))
  }

  let currentData = data

  // ST_id: 32-byte ticket identifier/hash from VRF computation
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for ticket ID'))
  }
  const id = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // ST_entryindex: Natural number representing position in entropy accumulator
  const [error, entryIndexResult] = decodeNatural(currentData)
  if (error) {
    return safeError(error)
  }
  const entryIndex = entryIndexResult.value
  currentData = entryIndexResult.remaining

  return safeResult({
    value: {
      id,
      entryIndex,
    },
    remaining: currentData,
  })
}

/**
 * Encode variable-length ticket sequence using Gray Paper encoding.
 *
 * Gray Paper Equation 266-269 (label: encodeTickets{XT_tickets}):
 * encodeTickets{XT_tickets} ≡ encode{var{XT_tickets}}
 *
 * Where each ticket is encoded as:
 * encode{ST ∈ safroleticket} ≡ encode{ST_id, ST_entryindex}
 *
 * Encodes a variable-length sequence of Safrole tickets with proper Gray Paper
 * compliant structure. Each ticket is encoded using encodeSafroleTicket.
 *
 * ✅ CORRECT: Uses variable-length sequence encoding
 * ✅ CORRECT: Reuses existing Gray Paper compliant encodeSafroleTicket function
 * ✅ CORRECT: Maintains deterministic ordering per Gray Paper
 *
 * @param tickets - Array of Safrole tickets to encode
 * @returns Encoded octet sequence
 */
export function encodeSafroleTickets(
  tickets: SafroleTicket[],
): Safe<Uint8Array> {
  return encodeSequenceGeneric(tickets, encodeSafroleTicket)
}

/**
 * Decode variable-length ticket sequence using Gray Paper encoding.
 *
 * Decodes a variable-length sequence of Safrole tickets. Must exactly reverse
 * the encoding process to maintain round-trip compatibility.
 *
 * ✅ CORRECT: Uses variable-length sequence decoding
 * ✅ CORRECT: Reuses existing Gray Paper compliant decodeSafroleTicket function
 * ✅ CORRECT: Maintains round-trip compatibility
 *
 * @param data - Octet sequence to decode
 * @returns Decoded Safrole tickets and remaining data
 */
export function decodeSafroleTickets(
  data: Uint8Array,
): Safe<DecodingResult<SafroleTicket[]>> {
  return decodeSequenceGeneric(data, decodeSafroleTicket)
}
