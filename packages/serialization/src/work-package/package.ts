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
  SerializationExtrinsicReference as ExtrinsicReference,
  SerializationWorkItem as WorkItem,
  SerializationWorkPackage as WorkPackage,
} from '@pbnj/types'
import { encodeWorkContext } from './context'

export function encodeWorkItem(workItem: WorkItem): Uint8Array {
  const parts: Uint8Array[] = []

  // Service (4 bytes)
  parts.push(encodeNatural(BigInt(workItem.service || 0)))

  // Code hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(workItem.code_hash))

  // Payload (variable length) - convert hex to bytes
  const payloadBytes = hexToBytes(workItem.payload)
  parts.push(encodeNatural(BigInt(payloadBytes.length))) // Length prefix
  parts.push(payloadBytes)

  // Refine gas limit (4 bytes)
  parts.push(encodeNatural(BigInt(workItem.refine_gas_limit || 0)))

  // Accumulate gas limit (4 bytes)
  parts.push(encodeNatural(BigInt(workItem.accumulate_gas_limit || 0)))

  // Import segments (array of import references)
  for (const importRef of workItem.import_segments) {
    parts.push(encodeImportReference(importRef))
  }

  // Extrinsic (array of extrinsic references)
  for (const extrinsicRef of workItem.extrinsic) {
    parts.push(encodeExtrinsicReference(extrinsicRef))
  }

  // Export count (4 bytes)
  parts.push(encodeNatural(BigInt(workItem.export_count || 0)))

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
): Uint8Array {
  const parts: Uint8Array[] = []

  // Hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(extrinsicRef.hash))

  // Len (8 bytes)
  parts.push(encodeNatural(BigInt(extrinsicRef.len)))

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
export function encodeWorkPackage(workPackage: WorkPackage): Uint8Array {
  const parts: Uint8Array[] = []

  // Auth code host (8 bytes)
  parts.push(encodeNatural(BigInt(workPackage.auth_code_host)))

  // Auth code hash (32 bytes) - convert hex to bytes
  parts.push(hexToBytes(workPackage.authorizer.code_hash))

  // Context
  parts.push(encodeWorkContext(workPackage.context))

  // Auth token (variable length) - convert hex to bytes
  const authTokenBytes = hexToBytes(workPackage.authorization)
  parts.push(encodeNatural(BigInt(authTokenBytes.length))) // Length prefix
  parts.push(authTokenBytes)

  // Auth config (variable length) - convert hex to bytes
  const authConfigBytes = hexToBytes(workPackage.authorizer.params)
  parts.push(encodeNatural(BigInt(authConfigBytes.length))) // Length prefix
  parts.push(authConfigBytes)

  // Work items (array of work items)
  for (const workItem of workPackage.items) {
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
export function decodeWorkPackage(data: Uint8Array): {
  value: WorkPackage
  remaining: Uint8Array
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
export function decodeWorkItem(data: Uint8Array): {
  value: WorkItem
  remaining: Uint8Array
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
      payload: bytesToHex(payload),
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
export function decodeExtrinsicReference(data: Uint8Array): {
  value: ExtrinsicReference
  remaining: Uint8Array
} {
  // Hash (32 Uint8Array)
  const hash = bytesToHex(data.slice(0, 32))
  const remaining = data.slice(32)

  // Index (8 Uint8Array)
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
function decodeWorkContext(data: Uint8Array) {
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
