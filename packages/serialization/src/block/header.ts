/**
 * JAM Block header serialization according to Gray Paper
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 182-197):
 *
 * encode(H) = encode(encodeUnsignedHeader(H), H_sealsig)
 *
 * encodeUnsignedHeader(H) = encode(
 *   H_parent,
 *   H_priorstateroot,
 *   H_extrinsichash,
 *   encode[4](H_timeslot),
 *   maybe{H_epochmark},
 *   maybe{H_winnersmark},
 *   encode[2](H_authorindex),
 *   H_vrfsig,
 *   var{H_offendersmark}
 * )
 *
 * Implements JAM block header serialization as specified in the Gray Paper
 *
 * *** IMPLEMENTER EXPLANATION ***
 * JAM block headers contain all the metadata needed to verify and process blocks.
 * The header has both signed and unsigned portions for cryptographic integrity.
 *
 * Structure breakdown:
 * 1. **Parent hash** (32 bytes): Links to previous block
 * 2. **Prior state root** (32 bytes): State commitment before this block
 * 3. **Extrinsic hash** (32 bytes): Merkle root of all extrinsics in block
 * 4. **Time slot** (4 bytes): When this block was produced
 * 5. **Epoch mark** (optional): New validator set and entropy (only on epoch boundaries)
 * 6. **Winners mark** (optional): Winning Safrole tickets for this slot
 * 7. **Author index** (2 bytes): Which validator authored this block
 * 8. **VRF signature** (96 bytes): Proves authorship and randomness
 * 9. **Offenders mark** (variable): Ed25519 keys of misbehaving validators
 * 10. **Seal signature** (64 bytes): Final signature over unsigned header
 *
 * The two-part structure (unsigned + seal) allows validators to sign the
 * complete header contents while including the signature in the commitment.
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import type {
  EpochMark,
  HashValue,
  JamHeader,
  SafroleTicketHeader,
  ValidatorKeyPair,
} from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'

// Helper functions for hash values
function encodeHashValue(hash: HashValue): Uint8Array {
  return hexToBytes(hash)
}

function decodeHashValue(data: Uint8Array): HashValue {
  return bytesToHex(data)
}

// Validator key pair encoding/decoding
function encodeValidatorKeyPair(validator: ValidatorKeyPair): Uint8Array {
  const parts: Uint8Array[] = []
  parts.push(encodeHashValue(validator.bandersnatch))
  parts.push(encodeHashValue(validator.ed25519))

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function decodeValidatorKeyPair(
  data: Uint8Array,
  offset: number,
): { result: ValidatorKeyPair; newOffset: number } {
  const bandersnatch = decodeHashValue(data.slice(offset, offset + 32))
  offset += 32
  const ed25519 = decodeHashValue(data.slice(offset, offset + 32))
  offset += 32

  return {
    result: { bandersnatch, ed25519 },
    newOffset: offset,
  }
}

// Epoch mark encoding/decoding (optional)
function encodeEpochMark(epochMark: EpochMark | null): Uint8Array {
  if (epochMark === null) {
    // Encode as None (1 byte with value 0)
    return new Uint8Array([0])
  }

  const parts: Uint8Array[] = []
  // Encode as Some (1 byte with value 1)
  parts.push(new Uint8Array([1]))

  // Encode entropy (32 bytes)
  parts.push(encodeHashValue(epochMark.entropy))

  // Encode tickets_entropy (32 bytes)
  parts.push(encodeHashValue(epochMark.tickets_entropy))

  // Encode validators count and validators
  parts.push(encodeNatural(BigInt(epochMark.validators.length)))
  for (const validator of epochMark.validators) {
    parts.push(encodeValidatorKeyPair(validator))
  }

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function decodeEpochMark(
  data: Uint8Array,
  offset: number,
): { result: EpochMark | null; newOffset: number } {
  const optionTag = data[offset]
  offset += 1

  if (optionTag === 0) {
    return { result: null, newOffset: offset }
  }

  // Decode entropy
  const entropy = decodeHashValue(data.slice(offset, offset + 32))
  offset += 32

  // Decode tickets_entropy
  const ticketsEntropy = decodeHashValue(data.slice(offset, offset + 32))
  offset += 32

  // Decode validators count
  const validatorsCountResult = decodeNatural(data.slice(offset))
  const validatorsCount = Number(validatorsCountResult.value)
  offset += data.slice(offset).length - validatorsCountResult.remaining.length

  // Decode validators
  const validators: ValidatorKeyPair[] = []
  for (let i = 0; i < validatorsCount; i++) {
    const validatorResult = decodeValidatorKeyPair(data, offset)
    validators.push(validatorResult.result)
    offset = validatorResult.newOffset
  }

  return {
    result: {
      entropy,
      tickets_entropy: ticketsEntropy,
      validators,
    },
    newOffset: offset,
  }
}

// Winners mark encoding/decoding (optional array of tickets)
function encodeWinnersMark(
  winnersMark: SafroleTicketHeader[] | null,
): Uint8Array {
  if (winnersMark === null) {
    // Encode as None (1 byte with value 0)
    return new Uint8Array([0])
  }

  const parts: Uint8Array[] = []
  // Encode as Some (1 byte with value 1)
  parts.push(new Uint8Array([1]))

  // Encode tickets count and tickets
  parts.push(encodeNatural(BigInt(winnersMark.length)))
  for (const ticket of winnersMark) {
    parts.push(encodeFixedLength(BigInt(ticket.attempt), 4 as const))
    parts.push(encodeHashValue(ticket.signature))
  }

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function decodeWinnersMark(
  data: Uint8Array,
  offset: number,
): { result: SafroleTicketHeader[] | null; newOffset: number } {
  const optionTag = data[offset]
  offset += 1

  if (optionTag === 0) {
    return { result: null, newOffset: offset }
  }

  // Decode tickets count
  const ticketsCountResult = decodeNatural(data.slice(offset))
  const ticketsCount = Number(ticketsCountResult.value)
  offset += data.slice(offset).length - ticketsCountResult.remaining.length

  // Decode tickets
  const tickets: SafroleTicketHeader[] = []
  for (let i = 0; i < ticketsCount; i++) {
    const attemptResult = decodeFixedLength(data.slice(offset), 4 as const)
    const attempt = Number(attemptResult.value)
    offset += 4

    const signature = decodeHashValue(data.slice(offset, offset + 32))
    offset += 32

    tickets.push({ attempt, signature })
  }

  return { result: tickets, newOffset: offset }
}

// Offenders mark encoding/decoding (array of Ed25519 keys)
function encodeOffendersMark(offendersMark: HashValue[]): Uint8Array {
  const parts: Uint8Array[] = []

  // Encode count
  parts.push(encodeNatural(BigInt(offendersMark.length)))

  // Encode keys
  for (const key of offendersMark) {
    parts.push(encodeHashValue(key))
  }

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function decodeOffendersMark(
  data: Uint8Array,
  offset: number,
): { result: HashValue[]; newOffset: number } {
  // Decode count
  const countResult = decodeNatural(data.slice(offset))
  const count = Number(countResult.value)
  offset += data.slice(offset).length - countResult.remaining.length

  // Decode keys
  const keys: HashValue[] = []
  for (let i = 0; i < count; i++) {
    const key = decodeHashValue(data.slice(offset, offset + 32))
    keys.push(key)
    offset += 32
  }

  return { result: keys, newOffset: offset }
}

export function encodeJamHeader(header: JamHeader): Uint8Array {
  const parts: Uint8Array[] = []

  // parent (32 bytes)
  parts.push(encodeHashValue(header.parent))

  // parent_state_root (32 bytes)
  parts.push(encodeHashValue(header.parent_state_root))

  // extrinsic_hash (32 bytes)
  parts.push(encodeHashValue(header.extrinsic_hash))

  // slot (4 bytes)
  parts.push(encodeFixedLength(BigInt(header.slot), 4 as const))

  // epoch_mark (optional)
  parts.push(encodeEpochMark(header.epoch_mark))

  // winners_mark (optional)
  parts.push(encodeWinnersMark(header.winners_mark))

  // author_index (2 bytes)
  parts.push(encodeFixedLength(BigInt(header.author_index), 2 as const))

  // vrf_sig (96 bytes)
  parts.push(encodeHashValue(header.vrf_sig))

  // offenders_mark (variable)
  parts.push(encodeOffendersMark(header.offenders_mark))

  // seal_sig (96 bytes) - this is part of the signed header, not unsigned
  parts.push(encodeHashValue(header.seal_sig))

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

export function decodeJamHeader(data: Uint8Array): JamHeader {
  let offset = 0

  // parent (32 bytes)
  const parent = decodeHashValue(data.slice(offset, offset + 32))
  offset += 32

  // parent_state_root (32 bytes)
  const parentStateRoot = decodeHashValue(data.slice(offset, offset + 32))
  offset += 32

  // extrinsic_hash (32 bytes)
  const extrinsicHash = decodeHashValue(data.slice(offset, offset + 32))
  offset += 32

  // slot (4 bytes)
  const slotResult = decodeFixedLength(data.slice(offset), 4 as const)
  const slot = Number(slotResult.value)
  offset += 4

  // epoch_mark (optional)
  const epochMarkResult = decodeEpochMark(data, offset)
  const epochMark = epochMarkResult.result
  offset = epochMarkResult.newOffset

  // winners_mark (optional)
  const winnersMarkResult = decodeWinnersMark(data, offset)
  const winnersMark = winnersMarkResult.result
  offset = winnersMarkResult.newOffset

  // author_index (2 bytes)
  const authorIndexResult = decodeFixedLength(data.slice(offset), 2 as const)
  const authorIndex = Number(authorIndexResult.value)
  offset += 2

  // vrf_sig (96 bytes)
  const vrfSig = decodeHashValue(data.slice(offset, offset + 96))
  offset += 96

  // offenders_mark (variable)
  const offendersMarkResult = decodeOffendersMark(data, offset)
  const offendersMark = offendersMarkResult.result
  offset = offendersMarkResult.newOffset

  // seal_sig (96 bytes)
  const sealSig = decodeHashValue(data.slice(offset, offset + 96))

  return {
    parent,
    parent_state_root: parentStateRoot,
    extrinsic_hash: extrinsicHash,
    slot,
    epoch_mark: epochMark,
    winners_mark: winnersMark,
    offenders_mark: offendersMark,
    author_index: authorIndex,
    vrf_sig: vrfSig,
    seal_sig: sealSig,
  }
}

// Legacy function aliases for compatibility
export const encodeHeader = encodeJamHeader
export const decodeHeader = decodeJamHeader
