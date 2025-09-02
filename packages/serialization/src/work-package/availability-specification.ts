/**
 * Availability specification serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 208-214):
 *
 * encode(AS ∈ avspec) ≡ encode(
 *   AS_packagehash,
 *   encode[4](AS_bundlelen),
 *   AS_erasureroot,
 *   AS_segroot,
 *   encode[2](AS_segcount)
 * )
 *
 * Availability specifications define data availability parameters
 * for work package erasure coding and reconstruction.
 * Reference: graypaper/text/erasure_coding.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Availability specifications describe how work package data is
 * encoded for distributed storage and retrieval across validators.
 *
 * Availability Spec structure:
 * 1. **Package hash**: Hash identifying the work package data
 * 2. **Bundle length** (4 bytes): Size of original data before encoding
 * 3. **Erasure root**: Merkle root of erasure-coded segments
 * 4. **Segment root**: Merkle root of individual data segments
 * 5. **Segment count** (2 bytes): Number of erasure code segments
 *
 * Key concepts:
 * - Erasure coding: Data split into N segments, any M can reconstruct
 * - Merkle commitments: Cryptographic proofs for data integrity
 * - Distributed storage: Validators store different segments
 * - Efficient reconstruction: Only need subset of segments to rebuild
 *
 * Example: 1MB work package → 100 segments, need any 67 to reconstruct
 * - Validators store 1-2 segments each (1-2% of original data)
 * - Network can lose 33% of validators and still recover data
 * - Reconstruction only happens when data is actually needed
 *
 * This enables JAM's scalable data availability without requiring
 * every validator to store every piece of data.
 */

import {
  bytesToBigInt,
  bytesToHex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { AvailabilitySpecification } from '@pbnj/types'
import { encodeNatural } from '../core/natural-number'

/**
 * Encode availability specification
 *
 * @param spec - Availability specification to encode
 * @returns Encoded octet sequence
 */
export function encodeAvailabilitySpecification(
  spec: AvailabilitySpecification,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Package hash (32 Uint8Array)
  parts.push(hexToBytes(spec.packageHash))

  // Bundle length (8 Uint8Array)
  const [error, encoded] = encodeNatural(spec.bundleLength)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // Erasure root (32 Uint8Array)
  parts.push(hexToBytes(spec.erasureRoot))

  // Segment root (32 Uint8Array)
  parts.push(hexToBytes(spec.segmentRoot))

  // Segment count (8 Uint8Array)
  const [error3, encoded3] = encodeNatural(spec.segmentCount)
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

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
 * Decode availability specification
 *
 * @param data - Octet sequence to decode
 * @returns Decoded availability specification
 */
export function decodeAvailabilitySpecification(data: Uint8Array): Safe<{
  value: AvailabilitySpecification
  remaining: Uint8Array
}> {
  let offset = 0

  // Package hash (32 Uint8Array)
  const packageHash = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Bundle length (8 Uint8Array)
  const bundleLength = bytesToBigInt(data.slice(offset, offset + 8))
  offset += 8

  // Erasure root (32 Uint8Array)
  const erasureRoot = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Segment root (32 Uint8Array)
  const segmentRoot = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Segment count (8 Uint8Array)
  const segmentCount = bytesToBigInt(data.slice(offset, offset + 8))

  return safeResult({
    value: {
      packageHash,
      bundleLength,
      erasureRoot,
      segmentRoot,
      segmentCount,
    },
    remaining: data.slice(offset),
  })
}
