/**
 * Availability specification serialization
 *
 * Implements Gray Paper availability specification serialization
 * Reference: graypaper/text/availability_specification.tex
 */

import { bytesToHex, hexToUint8Array } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type { AvailabilitySpecification, Uint8Array } from '../types'

/**
 * Encode availability specification
 *
 * @param spec - Availability specification to encode
 * @returns Encoded octet sequence
 */
export function encodeAvailabilitySpecification(
  spec: AvailabilitySpecification,
): Uint8Array {
  const parts: Uint8Array[] = []

  // Package hash (32 Uint8Array)
  parts.push(hexToUint8Array(spec.packageHash))

  // Bundle length (8 Uint8Array)
  parts.push(encodeNatural(spec.bundleLength))

  // Erasure root (32 Uint8Array)
  parts.push(hexToUint8Array(spec.erasureRoot))

  // Segment root (32 Uint8Array)
  parts.push(hexToUint8Array(spec.segmentRoot))

  // Segment count (8 Uint8Array)
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
  data: Uint8Array,
): AvailabilitySpecification {
  let offset = 0

  // Package hash (32 Uint8Array)
  const packageHash = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Bundle length (8 Uint8Array)
  const bundleLength = BigInt(
    `0x${Array.from(data.slice(offset, offset + 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  offset += 8

  // Erasure root (32 Uint8Array)
  const erasureRoot = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Segment root (32 Uint8Array)
  const segmentRoot = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Segment count (8 Uint8Array)
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
