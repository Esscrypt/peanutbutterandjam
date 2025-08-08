/**
 * Block header serialization
 *
 * Implements Gray Paper block header serialization
 * Reference: graypaper/text/block_header.tex
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import type { 
  BlockHeader, 
  Uint8Array, 
  EpochMark, 
  SafroleTicketSingle, 
  SafroleTicketArray,
  ValidatorKeyTuple
} from '@pbnj/types'
import { isTicketsMarkArray, isTicketsMarkSingle } from '@pbnj/types'

/**
 * Encode validator key tuple
 */
function encodeValidatorKeyTuple(validator: ValidatorKeyTuple): Uint8Array {
  const parts: Uint8Array[] = []
  
  // Bandersnatch key (32 Uint8Array)
  parts.push(hexToBytes(validator.bandersnatch))
  
  // Ed25519 key (32 Uint8Array)
  parts.push(hexToBytes(validator.ed25519))
  
  // Concatenate parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  
  return result
}

/**
 * Encode epoch mark
 */
function encodeEpochMark(epochMark: EpochMark): Uint8Array {
  const parts: Uint8Array[] = []
  
  // entropy (32 Uint8Array)
  parts.push(hexToBytes(epochMark.entropy))
  
  // tickets_entropy (32 Uint8Array)
  parts.push(hexToBytes(epochMark.tickets_entropy))
  
  // validators sequence
  for (const validator of epochMark.validators) {
    parts.push(encodeValidatorKeyTuple(validator))
  }
  
  // Concatenate parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  
  return result
}

/**
 * Encode Safrole ticket (single object format)
 */
function encodeSafroleTicketSingle(ticket: SafroleTicketSingle): Uint8Array {
  const parts: Uint8Array[] = []
  
  // id (32 Uint8Array)
  parts.push(hexToBytes(ticket.id))
  
  // entry_index (8 Uint8Array)
  parts.push(encodeNatural(BigInt(ticket.entry_index)))
  
  // Concatenate parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  
  return result
}

/**
 * Encode Safrole ticket (array format)
 */
function encodeSafroleTicketArray(ticket: SafroleTicketArray): Uint8Array {
  const parts: Uint8Array[] = []
  
  // id (32 Uint8Array)
  parts.push(hexToBytes(ticket.id))
  
  // attempt (8 Uint8Array)
  parts.push(encodeNatural(BigInt(ticket.attempt)))
  
  // Concatenate parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  
  return result
}

/**
 * Encode block header according to test vector format
 *
 * @param header - Block header to encode
 * @returns Encoded octet sequence
 */
export function encodeBlockHeader(header: BlockHeader): Uint8Array {
  const parts: Uint8Array[] = []

  // 1. parent (32 Uint8Array)
  parts.push(hexToBytes(header.parent))

  // 2. parent_state_root (32 Uint8Array)
  parts.push(hexToBytes(header.parent_state_root))

  // 3. extrinsic_hash (32 Uint8Array)
  parts.push(hexToBytes(header.extrinsic_hash))

  // 4. slot (4 Uint8Array)
  parts.push(encodeFixedLength(BigInt(header.slot), 4))

  // 5. epoch_mark (maybe{} encoding: 1 byte discriminator + encoded epoch mark if present)
  if (header.epoch_mark) {
    parts.push(new Uint8Array([1])) // Discriminator: 1 for present
    parts.push(encodeEpochMark(header.epoch_mark))
  } else {
    parts.push(new Uint8Array([0])) // Discriminator: 0 for none
  }

  // 6. tickets_mark (maybe{} encoding: 1 byte discriminator + encoded tickets mark if present)
  if (header.tickets_mark) {
    parts.push(new Uint8Array([1])) // Discriminator: 1 for present
    
    if (isTicketsMarkArray(header.tickets_mark)) {
      // Array format: [{id, attempt}, {id, attempt}, ...]
      for (const ticket of header.tickets_mark) {
        parts.push(encodeSafroleTicketArray(ticket))
      }
    } else if (isTicketsMarkSingle(header.tickets_mark)) {
      // Single object format: {id, entry_index}
      parts.push(encodeSafroleTicketSingle(header.tickets_mark))
    }
  } else {
    parts.push(new Uint8Array([0])) // Discriminator: 0 for none
  }

  // 7. offenders_mark (variable length with length prefix)
  parts.push(encodeNatural(BigInt(header.offenders_mark.length))) // Length prefix
  for (const offender of header.offenders_mark) {
    parts.push(hexToBytes(offender))
  }

  // 8. author_index (2 Uint8Array)
  parts.push(encodeFixedLength(BigInt(header.author_index), 2))

  // 9. entropy_source (32 Uint8Array)
  parts.push(hexToBytes(header.entropy_source))

  // 10. seal (32 Uint8Array)
  parts.push(hexToBytes(header.seal))

  // Concatenate all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

/**
 * Decode block header
 *
 * @param data - Octet sequence to decode
 * @returns Decoded block header and remaining data
 */
export function decodeBlockHeader(data: Uint8Array): {
  value: BlockHeader
  remaining: Uint8Array
} {
  let remaining = data

  // Parent hash (32 Uint8Array)
  const parent = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Prior state root (32 Uint8Array)
  const parent_state_root = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Extrinsic hash (32 Uint8Array)
  const extrinsic_hash = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Slot (4 Uint8Array)
  const { value: slot, remaining: slotRemaining } = decodeFixedLength(
    remaining,
    4,
  )
  remaining = slotRemaining

  // Epoch mark (maybe{} encoding: 1 byte discriminator + encoded epoch mark if present)
  let epoch_mark: EpochMark | null = null
  const epochDiscriminator = remaining[0]
  remaining = remaining.slice(1)
  if (epochDiscriminator === 1) {
    // TODO: Implement epoch mark decoding
    // For now, skip the epoch mark data
    remaining = remaining.slice(32 + 32 + 6 * 64) // entropy + tickets_entropy + 6 validators
  }

  // Tickets mark (maybe{} encoding: 1 byte discriminator + encoded tickets mark if present)
  let tickets_mark: SafroleTicketSingle | SafroleTicketArray[] | null = null
  const ticketsDiscriminator = remaining[0]
  remaining = remaining.slice(1)
  if (ticketsDiscriminator === 1) {
    // TODO: Implement tickets mark decoding
    // For now, skip the tickets mark data
    tickets_mark = null
  }

  // Offenders mark (variable length - decode length first)
  const { value: offendersMarkLength, remaining: offendersLengthRemaining } =
    decodeNatural(remaining)
  remaining = offendersLengthRemaining
  const offenders_mark: string[] = []
  let offendersRemaining = remaining.slice(0, Number(offendersMarkLength))
  while (offendersRemaining.length > 0) {
    const offender = bytesToHex(offendersRemaining.slice(0, 32))
    offenders_mark.push(offender)
    offendersRemaining = offendersRemaining.slice(32)
  }
  remaining = remaining.slice(Number(offendersMarkLength))

  // Author index (2 Uint8Array)
  const { value: author_index, remaining: authorRemaining } = decodeFixedLength(
    remaining,
    2,
  )
  remaining = authorRemaining

  // Entropy source (32 Uint8Array)
  const entropy_source = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Seal (32 Uint8Array)
  const seal = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  return {
    value: {
      parent,
      parent_state_root,
      extrinsic_hash,
      slot: Number(slot),
      epoch_mark,
      tickets_mark,
      offenders_mark,
      author_index: Number(author_index),
      entropy_source,
      seal,
    },
    remaining,
  }
}

/**
 * Encode unsigned block header (without seal signature)
 *
 * @param header - Block header to encode (without seal signature)
 * @returns Encoded octet sequence
 */
export function encodeUnsignedBlockHeader(
  header: Omit<BlockHeader, 'seal'>,
): Uint8Array {
  // Create a temporary header with a dummy seal signature for encoding
  const tempHeader: BlockHeader = {
    ...header,
    seal: '0x0000000000000000000000000000000000000000000000000000000000000000',
  }

  // Encode the full header
  const fullEncoded = encodeBlockHeader(tempHeader)

  // Remove the last 32 Uint8Array (seal signature)
  return fullEncoded.slice(0, -32)
}
