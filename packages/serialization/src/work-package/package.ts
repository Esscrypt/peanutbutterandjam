/**
 * Work package serialization
 *
 * Implements Gray Paper work package serialization
 * Reference: graypaper/text/work_package.tex
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import {
  decodeImportReference,
  encodeImportReference,
} from '../pvm/import-reference'
import type {
  ExtrinsicReference,
  OctetSequence,
  WorkItem,
  WorkPackage,
} from '../types'
import { encodeWorkContext } from './context'

/**
 * Encode work item
 *
 * @param workItem - Work item to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkItem(workItem: WorkItem): OctetSequence {
  const parts: Uint8Array[] = []

  // Service index (8 bytes)
  parts.push(encodeNatural(workItem.serviceIndex))

  // Code hash (32 bytes)
  parts.push(hexToBytes(workItem.codeHash))

  // Ref gas limit (8 bytes)
  parts.push(encodeNatural(workItem.refGasLimit))

  // Acc gas limit (8 bytes)
  parts.push(encodeNatural(workItem.accGasLimit))

  // Export count (8 bytes)
  parts.push(encodeNatural(workItem.exportCount))

  // Payload (variable length)
  parts.push(encodeNatural(BigInt(workItem.payload.length))) // Length prefix
  parts.push(workItem.payload)

  // Import segments (array of import references)
  for (const importRef of workItem.importSegments) {
    parts.push(encodeImportReference(importRef))
  }

  // Extrinsics (array of extrinsic references)
  for (const extrinsicRef of workItem.extrinsics) {
    parts.push(encodeExtrinsicReference(extrinsicRef))
  }

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
 * Encode extrinsic reference
 *
 * @param extrinsicRef - Extrinsic reference to encode
 * @returns Encoded octet sequence
 */
export function encodeExtrinsicReference(
  extrinsicRef: ExtrinsicReference,
): OctetSequence {
  const parts: Uint8Array[] = []

  // Hash (32 bytes)
  parts.push(hexToBytes(extrinsicRef.hash))

  // Index (8 bytes)
  parts.push(encodeNatural(extrinsicRef.index))

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
 * Encode work package
 *
 * @param workPackage - Work package to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkPackage(workPackage: WorkPackage): OctetSequence {
  const parts: Uint8Array[] = []

  // Auth code host (8 bytes)
  parts.push(encodeNatural(workPackage.authCodeHost))

  // Auth code hash (32 bytes)
  parts.push(hexToBytes(workPackage.authCodeHash))

  // Context
  parts.push(encodeWorkContext(workPackage.context))

  // Auth token (variable length)
  parts.push(encodeNatural(BigInt(workPackage.authToken.length))) // Length prefix
  parts.push(workPackage.authToken)

  // Auth config (variable length)
  parts.push(encodeNatural(BigInt(workPackage.authConfig.length))) // Length prefix
  parts.push(workPackage.authConfig)

  // Work items (array of work items)
  for (const workItem of workPackage.workItems) {
    parts.push(encodeWorkItem(workItem))
  }

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
 * Decode work package
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work package and remaining data
 */
export function decodeWorkPackage(data: OctetSequence): {
  value: WorkPackage
  remaining: OctetSequence
} {
  let currentData = data

  // Auth code host (8 bytes)
  const authCodeHost = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Auth code hash (32 bytes)
  const authCodeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Context (fixed size)
  const context = decodeWorkContext(currentData.slice(0, 200))
  currentData = currentData.slice(200)

  // Auth token (variable length)
  const authTokenLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const authToken = currentData.slice(0, Number(authTokenLength))
  currentData = currentData.slice(Number(authTokenLength))

  // Auth config (variable length)
  const authConfigLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const authConfig = currentData.slice(0, Number(authConfigLength))
  currentData = currentData.slice(Number(authConfigLength))

  // Work items (array of work items)
  const workItems = []
  while (currentData.length > 0) {
    const { value: workItem, remaining } = decodeWorkItem(currentData)
    workItems.push(workItem)
    currentData = remaining
  }

  return {
    value: {
      authCodeHost,
      authCodeHash,
      context,
      authToken,
      authConfig,
      workItems,
    },
    remaining: currentData,
  }
}

/**
 * Decode work item
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work item and remaining data
 */
export function decodeWorkItem(data: OctetSequence): {
  value: WorkItem
  remaining: OctetSequence
} {
  let currentData = data

  // Service index (8 bytes)
  const serviceIndex = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Code hash (32 bytes)
  const codeHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Ref gas limit (8 bytes)
  const refGasLimit = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Acc gas limit (8 bytes)
  const accGasLimit = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Export count (8 bytes)
  const exportCount = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Payload (variable length)
  const payloadLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const payload = currentData.slice(0, Number(payloadLength))
  currentData = currentData.slice(Number(payloadLength))

  // Import segments (array of import references)
  const importSegments = []
  while (currentData.length > 0) {
    const { value: importRef, remaining } = decodeImportReference(currentData)
    importSegments.push(importRef)
    currentData = remaining
  }

  // Extrinsics (array of extrinsic references)
  const extrinsics = []
  while (currentData.length > 0) {
    const { value: extrinsicRef, remaining } =
      decodeExtrinsicReference(currentData)
    extrinsics.push(extrinsicRef)
    currentData = remaining
  }

  return {
    value: {
      serviceIndex,
      codeHash,
      refGasLimit,
      accGasLimit,
      exportCount,
      payload,
      importSegments,
      extrinsics,
    },
    remaining: currentData,
  }
}

/**
 * Decode extrinsic reference
 *
 * @param data - Octet sequence to decode
 * @returns Decoded extrinsic reference and remaining data
 */
export function decodeExtrinsicReference(data: OctetSequence): {
  value: ExtrinsicReference
  remaining: OctetSequence
} {
  // Hash (32 bytes)
  const hash = bytesToHex(data.slice(0, 32))
  const remaining = data.slice(32)

  // Index (8 bytes)
  const index = BigInt(
    `0x${Array.from(remaining.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )

  return {
    value: {
      hash,
      index,
    },
    remaining: remaining.slice(8),
  }
}

// Helper function for decoding work context
function decodeWorkContext(data: OctetSequence) {
  // Simplified implementation - in practice this would use the proper decoder
  return {
    anchorHash: bytesToHex(data.slice(0, 32)),
    anchorPostState: bytesToHex(data.slice(32, 64)),
    anchorAccountLog: data.slice(64, 96),
    lookupAnchorHash: bytesToHex(data.slice(96, 128)),
    lookupAnchorTime: BigInt(
      `0x${Array.from(data.slice(128, 136))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
    prerequisites: data.slice(136, 200),
  }
}
