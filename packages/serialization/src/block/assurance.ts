/**
 * Assurance serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 159-164):
 *
 * encodeAssurances(XT_assurances) = encode(
 *   var{⟨⟨XA_anchor, XA_availabilities, encode[2](XA_assurer), XA_signature⟩ |
 *       ⟨XA_anchor, XA_availabilities, XA_assurer, XA_signature⟩ ∈ XT_assurances⟩}
 * )
 *
 * Assurances provide availability attestations from validators.
 * Reference: graypaper/text/reporting_assurance.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Assurances are validator attestations that erasure-coded data is available.
 * They ensure data availability for work packages without requiring full storage.
 *
 * Assurance structure:
 * 1. **Anchor**: Hash identifying the data being assured
 * 2. **Availabilities**: Bitfield of which erasure code segments are held
 * 3. **Assurer** (2 bytes): Index of validator providing assurance
 * 4. **Signature**: Cryptographic proof of the assurance
 *
 * Key concepts:
 * - Erasure coding: Data split into N segments, M needed for reconstruction
 * - Bitfield encoding: Efficient representation of which segments validator has
 * - Availability threshold: Enough assurances = data is "available"
 * - Lazy reconstruction: Data rebuilt only when needed, not stored fully
 *
 * This enables JAM's scalable data availability system where validators
 * store only small portions of data but can collectively guarantee
 * the entire system's data remains accessible.
 */

import {
  bytesToBigInt,
  bytesToHex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { Assurance } from '@pbnj/types'
import { encodeNatural } from '../core/natural-number'

/**
 * Encode assurance
 *
 * @param assurance - Assurance to encode
 * @returns Encoded octet sequence
 */
export function encodeAssurance(assurance: Assurance): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Anchor (32 Uint8Array)
  parts.push(hexToBytes(assurance.anchor))

  // Availabilities (encoded as bytes)
  parts.push(assurance.availabilities)

  // Assurer (8 Uint8Array)
  const [encodedAssurerError, encodedAssurer] = encodeNatural(
    BigInt(assurance.assurer),
  )
  if (encodedAssurerError) {
    return safeError(encodedAssurerError)
  }
  parts.push(encodedAssurer)

  // Signature (variable length)
  const [encodedSignatureLengthError, encodedSignatureLength] = encodeNatural(
    BigInt(assurance.signature.length),
  )
  if (encodedSignatureLengthError) {
    return safeError(encodedSignatureLengthError)
  }
  parts.push(encodedSignatureLength) // Length prefix
  parts.push(assurance.signature)

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
 * Decode assurance
 *
 * @param data - Octet sequence to decode
 * @returns Decoded assurance and remaining data
 */
export function decodeAssurance(
  data: Uint8Array,
): Safe<{ value: Assurance; remaining: Uint8Array }> {
  let currentData = data

  // Anchor (32 Uint8Array)
  const anchor = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Availabilities (encoded as bytes)
  // For simplicity, take a fixed segment - this should be adjusted based on actual protocol
  const availabilities = currentData.slice(0, 112)
  currentData = currentData.slice(112)

  // Assurer (8 Uint8Array)
  const assurer = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)

  // Signature (variable length)
  const signatureLength = bytesToBigInt(currentData.slice(0, 8))
  currentData = currentData.slice(8)
  const signature = currentData.slice(0, Number(signatureLength))
  currentData = currentData.slice(Number(signatureLength))

  return safeResult({
    value: {
      anchor,
      availabilities,
      assurer,
      signature,
    },
    remaining: currentData,
  })
}
