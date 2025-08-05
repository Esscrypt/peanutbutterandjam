/**
 * Block header serialization
 *
 * Implements Gray Paper block header serialization
 * Reference: graypaper/text/block_header.tex
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import type { BlockHeader, HashValue, OctetSequence } from '../types'

/**
 * Encode block header
 *
 * @param header - Block header to encode
 * @returns Encoded octet sequence
 */
export function encodeBlockHeader(header: BlockHeader): OctetSequence {
  const parts: Uint8Array[] = []

  // Parent hash (32 bytes)
  parts.push(hexToBytes(header.parentHash))

  // Prior state root (32 bytes)
  parts.push(hexToBytes(header.priorStateRoot))

  // Extrinsic hash (32 bytes)
  parts.push(hexToBytes(header.extrinsicHash))

  // Timeslot (8 bytes)
  parts.push(encodeFixedLength(header.timeslot, 8))

  // Epoch mark (optional, 32 bytes)
  if (header.epochMark) {
    parts.push(hexToBytes(header.epochMark))
  }

  // Winners mark (optional, 32 bytes)
  if (header.winnersMark) {
    parts.push(hexToBytes(header.winnersMark))
  }

  // Author index (2 bytes)
  parts.push(encodeFixedLength(header.authorIndex, 2))

  // VRF signature (32 bytes)
  parts.push(hexToBytes(header.vrfSignature))

  // Offenders mark (variable length)
  parts.push(encodeNatural(BigInt(header.offendersMark.length))) // Length prefix
  parts.push(header.offendersMark)

  // Seal signature (32 bytes)
  parts.push(hexToBytes(header.sealSignature))

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
export function decodeBlockHeader(data: OctetSequence): {
  value: BlockHeader
  remaining: OctetSequence
} {
  let remaining = data

  // Parent hash (32 bytes)
  const parentHash = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Prior state root (32 bytes)
  const priorStateRoot = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Extrinsic hash (32 bytes)
  const extrinsicHash = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Timeslot (8 bytes)
  const { value: timeslot, remaining: timeslotRemaining } = decodeFixedLength(
    remaining,
    8,
  )
  remaining = timeslotRemaining

  // Epoch mark (optional, 32 bytes)
  let epochMark: HashValue | undefined
  if (remaining.length >= 32) {
    const fieldData = remaining.slice(0, 32)
    if (fieldData.some((byte) => byte !== 0)) {
      epochMark = bytesToHex(fieldData)
    }
    remaining = remaining.slice(32)
  }

  // Winners mark (optional, 32 bytes)
  let winnersMark: HashValue | undefined
  if (remaining.length >= 32) {
    const fieldData = remaining.slice(0, 32)
    if (fieldData.some((byte) => byte !== 0)) {
      winnersMark = bytesToHex(fieldData)
    }
    remaining = remaining.slice(32)
  }

  // Author index (2 bytes)
  const { value: authorIndex, remaining: authorRemaining } = decodeFixedLength(
    remaining,
    2,
  )
  remaining = authorRemaining

  // VRF signature (32 bytes)
  const vrfSignature = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  // Offenders mark (variable length - decode length first)
  const { value: offendersMarkLength, remaining: offendersLengthRemaining } =
    decodeNatural(remaining)
  remaining = offendersLengthRemaining
  const offendersMark = remaining.slice(0, Number(offendersMarkLength))
  remaining = remaining.slice(Number(offendersMarkLength))

  // Seal signature (32 bytes)
  const sealSignature = bytesToHex(remaining.slice(0, 32))
  remaining = remaining.slice(32)

  return {
    value: {
      parentHash,
      priorStateRoot,
      extrinsicHash,
      timeslot,
      epochMark: epochMark || undefined,
      winnersMark: winnersMark || undefined,
      authorIndex,
      vrfSignature,
      offendersMark,
      sealSignature,
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
  header: Omit<BlockHeader, 'sealSignature'>,
): OctetSequence {
  // Create a temporary header with a dummy seal signature for encoding
  const tempHeader: BlockHeader = {
    ...header,
    sealSignature:
      '0x0000000000000000000000000000000000000000000000000000000000000000',
  }

  // Encode the full header
  const fullEncoded = encodeBlockHeader(tempHeader)

  // Remove the last 32 bytes (seal signature)
  return fullEncoded.slice(0, -32)
}
