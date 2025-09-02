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

import {
  bytesToHex,
  type Hex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  EpochMark,
  JamHeader,
  SafroleTicketHeader,
  ValidatorKeyPair,
} from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'

// Validator key pair encoding/decoding
function encodeValidatorKeyPair(validator: ValidatorKeyPair): Uint8Array {
  const parts: Uint8Array[] = []
  parts.push(hexToBytes(validator.bandersnatch))
  parts.push(hexToBytes(validator.ed25519))

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
  const bandersnatch = bytesToHex(data.slice(offset, offset + 32))
  offset += 32
  const ed25519 = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  return {
    result: { bandersnatch, ed25519 },
    newOffset: offset,
  }
}

// Epoch mark encoding/decoding (optional)
function encodeEpochMark(epochMark: EpochMark | null): Safe<Uint8Array> {
  if (epochMark === null) {
    // Encode as None (1 byte with value 0)
    return safeResult(new Uint8Array([0]))
  }

  const parts: Uint8Array[] = []
  // Encode as Some (1 byte with value 1)
  parts.push(new Uint8Array([1]))

  // Encode entropy (32 bytes)
  parts.push(hexToBytes(epochMark.entropy))

  // Encode tickets_entropy (32 bytes)
  parts.push(hexToBytes(epochMark.tickets_entropy))

  // Encode validators count and validators
  const [error, encoded] = encodeNatural(BigInt(epochMark.validators.length))
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)
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
  return safeResult(result)
}

function decodeEpochMark(
  data: Uint8Array,
  offset: number,
): Safe<{ value: EpochMark | null; remaining: Uint8Array }> {
  const optionTag = data[offset]
  offset += 1

  if (optionTag === 0) {
    return safeResult({ value: null, remaining: data.slice(offset) })
  }

  // Decode entropy
  const entropy = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Decode tickets_entropy
  const ticketsEntropy = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Decode validators count
  const [error, validatorsCountResult] = decodeNatural(data.slice(offset))
  if (error) {
    return safeError(error)
  }
  const validatorsCount = Number(validatorsCountResult.value)
  offset += data.slice(offset).length - validatorsCountResult.remaining.length

  // Decode validators
  const validators: ValidatorKeyPair[] = []
  for (let i = 0; i < validatorsCount; i++) {
    const validatorResult = decodeValidatorKeyPair(data, offset)
    validators.push(validatorResult.result)
    offset = validatorResult.newOffset
  }

  return safeResult({
    value: {
      entropy,
      tickets_entropy: ticketsEntropy,
      validators,
    },
    remaining: data.slice(offset),
  })
}

// Winners mark encoding/decoding (optional array of tickets)
function encodeWinnersMark(
  winnersMark: SafroleTicketHeader[] | null,
): Safe<Uint8Array> {
  if (winnersMark === null) {
    // Encode as None (1 byte with value 0)
    return safeResult(new Uint8Array([0]))
  }

  const parts: Uint8Array[] = []
  // Encode as Some (1 byte with value 1)
  parts.push(new Uint8Array([1]))

  // Encode tickets count and tickets
  const [error, encoded] = encodeNatural(BigInt(winnersMark.length))
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)
  for (const ticket of winnersMark) {
    const [error2, encoded2] = encodeFixedLength(BigInt(ticket.attempt), 4n)
    if (error2) {
      return safeError(error2)
    }
    parts.push(encoded2)
    parts.push(hexToBytes(ticket.signature))
  }

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return safeResult(result)
}

function decodeWinnersMark(
  data: Uint8Array,
  offset: number,
): Safe<{ value: SafroleTicketHeader[] | null; remaining: Uint8Array }> {
  const optionTag = data[offset]
  offset += 1

  if (optionTag === 0) {
    return safeResult({ value: null, remaining: data.slice(offset) })
  }

  // Decode tickets count
  const [error, ticketsCountResult] = decodeNatural(data.slice(offset))
  if (error) {
    return safeError(error)
  }
  const ticketsCount = Number(ticketsCountResult.value)
  offset += data.slice(offset).length - ticketsCountResult.remaining.length

  // Decode tickets
  const tickets: SafroleTicketHeader[] = []
  for (let i = 0; i < ticketsCount; i++) {
    const [error, attemptResult] = decodeFixedLength(data.slice(offset), 4n)
    if (error) {
      return safeError(error)
    }
    const attempt = attemptResult.value
    offset += 4

    const signature = bytesToHex(data.slice(offset, offset + 32))
    offset += 32

    tickets.push({ attempt, signature })
  }

  return safeResult({ value: tickets, remaining: data.slice(offset) })
}

// Offenders mark encoding/decoding (array of Ed25519 keys)
function encodeOffendersMark(offendersMark: Hex[]): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Encode count
  const [error, encoded] = encodeNatural(BigInt(offendersMark.length))
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // Encode keys
  for (const key of offendersMark) {
    parts.push(hexToBytes(key))
  }

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return safeResult(result)
}

function decodeOffendersMark(
  data: Uint8Array,
  offset: number,
): Safe<{ value: Hex[]; remaining: Uint8Array }> {
  // Decode count
  const [error, countResult] = decodeNatural(data.slice(offset))
  if (error) {
    return safeError(error)
  }
  const count = Number(countResult.value)
  offset += data.slice(offset).length - countResult.remaining.length

  // Decode keys
  const keys: Hex[] = []
  for (let i = 0; i < count; i++) {
    const key = bytesToHex(data.slice(offset, offset + 32))
    keys.push(key)
    offset += 32
  }

  return safeResult({ value: keys, remaining: data.slice(offset) })
}

export function encodeJamHeader(header: JamHeader): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // parent (32 bytes)
  parts.push(hexToBytes(header.parent))

  // parent_state_root (32 bytes)
  parts.push(hexToBytes(header.parent_state_root))

  // extrinsic_hash (32 bytes)
  parts.push(hexToBytes(header.extrinsic_hash))

  // slot (4 bytes)
  const [error, encoded] = encodeFixedLength(BigInt(header.slot), 4n)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // epoch_mark (optional)
  const [error2, encoded2] = encodeEpochMark(header.epoch_mark)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // winners_mark (optional)
  const [error3, encoded3] = encodeWinnersMark(header.winners_mark)
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // author_index (2 bytes)
  const [error4, encoded4] = encodeFixedLength(BigInt(header.author_index), 2n)
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)

  // vrf_sig (96 bytes)
  parts.push(hexToBytes(header.vrf_sig))

  // offenders_mark (variable)
  const [error5, encoded5] = encodeOffendersMark(header.offenders_mark)
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)

  // seal_sig (96 bytes) - this is part of the signed header, not unsigned
  parts.push(hexToBytes(header.seal_sig))

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

export function decodeJamHeader(
  data: Uint8Array,
): Safe<{ value: JamHeader; remaining: Uint8Array }> {
  let offset = 0

  // parent (32 bytes)
  const parent = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // parent_state_root (32 bytes)
  const parentStateRoot = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // extrinsic_hash (32 bytes)
  const extrinsicHash = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // slot (4 bytes)
  const [error, slotResult] = decodeFixedLength(data.slice(offset), 4n)
  if (error) {
    return safeError(error)
  }
  const slot = slotResult.value
  offset += 4

  // epoch_mark (optional)
  const [error2, epochMarkResult] = decodeEpochMark(data, offset)
  if (error2) {
    return safeError(error2)
  }
  const epochMark = epochMarkResult.value
  offset = epochMarkResult.remaining.length

  // winners_mark (optional)
  const [error3, winnersMarkResult] = decodeWinnersMark(data, offset)
  if (error3) {
    return safeError(error3)
  }
  const winnersMark = winnersMarkResult.value
  offset = winnersMarkResult.remaining.length

  // author_index (2 bytes)
  const [error4, authorIndexResult] = decodeFixedLength(data.slice(offset), 2n)
  if (error4) {
    return safeError(error4)
  }
  const authorIndex = authorIndexResult.value
  offset += 2

  // vrf_sig (96 bytes)
  const vrfSig = bytesToHex(data.slice(offset, offset + 96))
  offset += 96

  // offenders_mark (variable)
  const [error5, offendersMarkResult] = decodeOffendersMark(data, offset)
  if (error5) {
    return safeError(error5)
  }
  const offendersMark = offendersMarkResult.value
  offset = offendersMarkResult.remaining.length

  // seal_sig (96 bytes)
  const sealSig = bytesToHex(data.slice(offset, offset + 96))

  return safeResult({
    value: {
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
    },
    remaining: data.slice(offset),
  })
}

// Legacy function aliases for compatibility
export const encodeHeader = encodeJamHeader
export const decodeHeader = decodeJamHeader
