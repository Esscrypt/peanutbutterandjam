/**
 * Availability specification serialization
 *
 * Implements Gray Paper availability specification serialization
 * Reference: graypaper/text/availability_specification.tex
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type { AvailabilitySpecification, OctetSequence } from '../types'

/**
 * Encode availability specification
 *
 * @param spec - Availability specification to encode
 * @returns Encoded octet sequence
 */
export function encodeAvailabilitySpecification(
  spec: AvailabilitySpecification,
): OctetSequence {
  const parts: Uint8Array[] = []

  // Package hash (32 bytes)
  parts.push(hexToBytes(spec.packageHash))

  // Bundle length (8 bytes)
  parts.push(encodeNatural(spec.bundleLength))

  // Erasure root (32 bytes)
  parts.push(hexToBytes(spec.erasureRoot))

  // Segment root (32 bytes)
  parts.push(hexToBytes(spec.segmentRoot))

  // Segment count (8 bytes)
  parts.push(encodeNatural(spec.segmentCount))

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
 * Decode availability specification
 *
 * @param data - Octet sequence to decode
 * @returns Decoded availability specification
 */
export function decodeAvailabilitySpecification(
  data: OctetSequence,
): AvailabilitySpecification {
  let offset = 0

  // Package hash (32 bytes)
  const packageHash = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Bundle length (8 bytes)
  const bundleLength = BigInt(
    `0x${Array.from(data.slice(offset, offset + 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  offset += 8

  // Erasure root (32 bytes)
  const erasureRoot = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Segment root (32 bytes)
  const segmentRoot = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Segment count (8 bytes)
  const segmentCount = BigInt(
    `0x${Array.from(data.slice(offset, offset + 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )

  return {
    packageHash,
    bundleLength,
    erasureRoot,
    segmentRoot,
    segmentCount,
  }
}
