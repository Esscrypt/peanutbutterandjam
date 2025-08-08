/**
 * Assurance serialization
 *
 * Implements Gray Paper assurance serialization
 * Reference: graypaper/text/assurance.tex
 */

import { bytesToHex, hexToUint8Array } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type { Assurance, Uint8Array } from '../types'
import { encodeAvailabilitySpecification } from '../work-package/availability-specification'

/**
 * Encode assurance
 *
 * @param assurance - Assurance to encode
 * @returns Encoded octet sequence
 */
export function encodeAssurance(assurance: Assurance): Uint8Array {
  const parts: Uint8Array[] = []

  // Anchor (32 Uint8Array)
  parts.push(hexToUint8Array(assurance.anchor))

  // Availabilities (array of availability specifications)
  for (const availability of assurance.availabilities) {
    parts.push(encodeAvailabilitySpecification(availability))
  }

  // Assurer (8 Uint8Array)
  parts.push(encodeNatural(assurance.assurer))

  // Signature (variable length)
  parts.push(encodeNatural(BigInt(assurance.signature.length))) // Length prefix
  parts.push(assurance.signature)

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
 * Decode assurance
 *
 * @param data - Octet sequence to decode
 * @returns Decoded assurance and remaining data
 */
export function decodeAssurance(data: Uint8Array): {
  value: Assurance
  remaining: Uint8Array
} {
  let currentData = data

  // Anchor (32 Uint8Array)
  const anchor = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Availabilities (array of availability specifications)
  const availabilities = []
  while (currentData.length >= 112) {
    // Each availability spec is 112 Uint8Array
    const availability = decodeAvailabilitySpecification(
      currentData.slice(0, 112),
    )
    availabilities.push(availability)
    currentData = currentData.slice(112)
  }

  // Assurer (8 Uint8Array)
  const assurer = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Signature (variable length)
  const signatureLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const signature = currentData.slice(0, Number(signatureLength))
  currentData = currentData.slice(Number(signatureLength))

  return {
    value: {
      anchor,
      availabilities,
      assurer,
      signature,
    },
    remaining: currentData,
  }
}

// Helper function for decoding availability specification
function decodeAvailabilitySpecification(data: Uint8Array) {
  // Simplified implementation - in practice this would use the proper decoder
  return {
    packageHash: bytesToHex(data.slice(0, 32)),
    bundleLength: BigInt(
      `0x${Array.from(data.slice(32, 40))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
    erasureRoot: bytesToHex(data.slice(40, 72)),
    segmentRoot: bytesToHex(data.slice(72, 104)),
    segmentCount: BigInt(
      `0x${Array.from(data.slice(104, 112))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  }
}
