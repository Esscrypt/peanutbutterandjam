/**
 * Work digest serialization
 *
 * Implements Gray Paper work digest serialization
 * Reference: graypaper/text/work_digest.tex
 */

import { bytesToHex, hexToUint8Array } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type { Uint8Array, WorkDigest, WorkError, WorkResult } from '../types'

/**
 * Encode work digest
 *
 * @param digest - Work digest to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkDigest(digest: WorkDigest): Uint8Array {
  const parts: Uint8Array[] = []

  // Service index (8 Uint8Array)
  parts.push(encodeNatural(digest.serviceIndex))

  // Code hash (32 Uint8Array)
  parts.push(hexToUint8Array(digest.codeHash))

  // Payload hash (32 Uint8Array)
  parts.push(hexToUint8Array(digest.payloadHash))

  // Gas limit (8 Uint8Array)
  parts.push(encodeNatural(digest.gasLimit))

  // Result (variable length)
  if (typeof digest.result === 'string') {
    // Error result
    const errorUint8Array = new TextEncoder().encode(digest.result)
    const lengthEncoded = encodeNatural(BigInt(errorUint8Array.length))
    parts.push(lengthEncoded)
    parts.push(errorUint8Array)
  } else {
    // Success result (octet sequence)
    const lengthEncoded = encodeNatural(BigInt(digest.result.length))
    parts.push(lengthEncoded)
    parts.push(digest.result)
  }

  // Gas used (8 Uint8Array)
  parts.push(encodeNatural(digest.gasUsed))

  // Import count (8 Uint8Array)
  parts.push(encodeNatural(digest.importCount))

  // Extrinsic count (8 Uint8Array)
  parts.push(encodeNatural(digest.extrinsicCount))

  // Extrinsic size (8 Uint8Array)
  parts.push(encodeNatural(digest.extrinsicSize))

  // Export count (8 Uint8Array)
  parts.push(encodeNatural(digest.exportCount))

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
 * Decode work digest
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work digest and remaining data
 */
export function decodeWorkDigest(data: Uint8Array): {
  value: WorkDigest
  remaining: Uint8Array
} {
  let currentData = data

  // Service index (8 Uint8Array)
  const serviceIndex = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Code hash (32 Uint8Array)
  const codeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Payload hash (32 Uint8Array)
  const payloadHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Gas limit (8 Uint8Array)
  const gasLimit = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Result (variable length)
  const resultLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  const resultData = currentData.slice(0, Number(resultLength))
  currentData = currentData.slice(Number(resultLength))

  // Try to decode as string first (error), fallback to Uint8Array (success)
  let result: WorkResult
  try {
    const resultString = new TextDecoder().decode(resultData)
    if (
      ['infinity', 'panic', 'bad_exports', 'oversize', 'bad', 'big'].includes(
        resultString,
      )
    ) {
      result = resultString as WorkError
    } else {
      result = resultData
    }
  } catch {
    result = resultData
  }

  // Gas used (8 Uint8Array)
  const gasUsed = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Import count (8 Uint8Array)
  const importCount = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Extrinsic count (8 Uint8Array)
  const extrinsicCount = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Extrinsic size (8 Uint8Array)
  const extrinsicSize = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Export count (8 Uint8Array)
  const exportCount = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  return {
    value: {
      serviceIndex,
      codeHash,
      payloadHash,
      gasLimit,
      result,
      gasUsed,
      importCount,
      extrinsicCount,
      extrinsicSize,
      exportCount,
    },
    remaining: currentData,
  }
}
