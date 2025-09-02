/**
 * Work report serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 231-240):
 *
 * encode(WR ∈ workreport) ≡ encode(
 *   WR_avspec,
 *   WR_context,
 *   WR_core,
 *   WR_authorizer,
 *   WR_authgasused,
 *   var{WR_authtrace},
 *   var{WR_srlookup},
 *   var{WR_digests}
 * )
 *
 * Work reports provide execution results and resource usage metrics
 * for work packages processed by the Parachains Virtual Machine.
 * Reference: graypaper/text/work_packages_and_reports.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Work reports are the results of executing work packages. They provide
 * proof that computation was performed correctly and capture all side effects.
 *
 * Work Report structure:
 * 1. **Availability spec**: How the work package data was encoded/stored
 * 2. **Context**: The execution environment that was used
 * 3. **Core**: Raw output data from the computation
 * 4. **Authorizer**: Public key that authorized this work package
 * 5. **Auth gas used**: How much gas the authorization logic consumed
 * 6. **Auth trace** (variable): Execution trace of authorization
 * 7. **State root lookup** (variable): State root dependencies
 * 8. **Digests** (variable): Compact summaries of work item results
 *
 * Key concepts:
 * - Deterministic execution: Same input → same work report
 * - Gas accounting: Precise tracking of computational resources
 * - State dependencies: Which state roots were accessed
 * - Compact representation: Digests summarize large results efficiently
 *
 * Work reports enable validators to verify computation results without
 * re-executing everything, forming the basis of JAM's scalable validation.
 */

import {
  bytesToBigInt,
  bytesToHex,
  type Hex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
  stringToBytes,
  zeroHash,
} from '@pbnj/core'
import type {
  AvailabilitySpec,
  WorkDigest,
  BlockAuthoringWorkError as WorkError,
  WorkPackageContext,
  WorkReport,
} from '@pbnj/types'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { encodeAvailabilitySpecification } from './availability-specification'
import { encodeWorkContext } from './context'
import { encodeWorkDigest } from './work-digest'

/**
 * Encode work report
 *
 * @param report - Work report to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkReport(report: WorkReport): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Availability specification
  const [error0, encoded0] = encodeAvailabilitySpecification(
    report.availabilitySpec,
  )
  if (error0) {
    return safeError(error0)
  }
  parts.push(encoded0)

  // Context
  const [error1, encoded1] = encodeWorkContext(report.context)
  if (error1) {
    return safeError(error1)
  }
  parts.push(encoded1)

  // Core index (4 bytes) - using coreIndex instead of raw core data
  const [error2, encoded2] = encodeNatural(report.coreIndex)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // Authorizer (string as hex)
  parts.push(hexToBytes(report.authorizer))

  // Auth gas used (convert number to bigint)
  const [error3, encoded3] = encodeNatural(report.authGasUsed)
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // Auth trace (variable length)
  const [error4, encoded4] = encodeNatural(BigInt(report.authTrace.length))
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)
  parts.push(report.authTrace)

  // State root lookup (Map<string, string> serialized)
  const srLookupEntries = Array.from(report.srLookup.entries())
  const [error5, encoded5] = encodeNatural(BigInt(srLookupEntries.length))
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)
  for (const [key, value] of srLookupEntries) {
    parts.push(hexToBytes(key as `0x${string}`))
    parts.push(hexToBytes(value as `0x${string}`))
  }

  // Digests (array of work digests)
  for (const digest of report.digests) {
    const [error6, encoded6] = encodeWorkDigest(digest)
    if (error6) {
      return safeError(error6)
    }
    parts.push(encoded6)
  }

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
 * Decode work report
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work report and remaining data
 */
export function decodeWorkReport(data: Uint8Array): Safe<{
  value: WorkReport
  remaining: Uint8Array
}> {
  let currentData = data

  // Availability specification (fixed size)
  const availabilitySpec = decodeAvailabilitySpecification(
    currentData.slice(0, 112),
  )
  currentData = currentData.slice(112)

  // Context (fixed size)
  const [error1, result1] = decodeWorkContext(currentData.slice(0, 200))
  if (error1) {
    return safeError(error1)
  }
  const context = result1.value
  currentData = result1.remaining

  // Core index (number)
  const [error2, result2] = decodeNatural(currentData)
  if (error2) {
    return safeError(error2)
  }
  const coreIndex = result2.value
  currentData = result2.remaining

  // Authorizer (32 Uint8Array)
  const authorizer = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Auth gas used (convert bigint to number)
  const [error3, result3] = decodeNatural(currentData)
  if (error3) {
    return safeError(error3)
  }
  const authGasUsed = result3.value
  currentData = result3.remaining

  // Auth trace (variable length)
  const [error4, result4] = decodeNatural(currentData)
  if (error4) {
    return safeError(error4)
  }
  const authTraceLength = result4.value
  currentData = result4.remaining
  const authTrace = currentData.slice(0, Number(authTraceLength))
  currentData = currentData.slice(Number(authTraceLength))

  // State root lookup (Map<string, string>)
  const [error5, result5] = decodeNatural(currentData)
  if (error5) {
    return safeError(error5)
  }
  const srLookupEntryCount = result5.value
  currentData = result5.remaining
  const srLookup = new Map<Hex, Hex>()
  for (let i = 0; i < Number(srLookupEntryCount); i++) {
    const key = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)
    const value = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)
    srLookup.set(key, value)
  }

  // Digests (array of work digests)
  const digests = []
  while (currentData.length > 0) {
    const [error6, result6] = decodeWorkDigest(currentData)
    if (error6) {
      return safeError(error6)
    }
    const digest = result6.value
    currentData = result6.remaining
    digests.push(digest)
  }

  return safeResult({
    value: {
      id: bytesToHex(stringToBytes('decoded-work-report')), // TODO: extract from data if present or autogenerate
      workPackageId: zeroHash, // TODO: extract from data if present
      availabilitySpec: {
        packageHash: availabilitySpec.packageHash,
        bundleLength: availabilitySpec.bundleLength,
        erasureRoot: availabilitySpec.erasureRoot,
        segmentRoot: availabilitySpec.segmentRoot,
        segmentCount: availabilitySpec.segmentCount,
      },
      context,
      coreIndex,
      authorizer,
      authTrace,
      srLookup,
      digests: digests.map((digest) => ({
        serviceIndex: digest.serviceIndex,
        codeHash: digest.codeHash,
        payloadHash: digest.payloadHash,
        gasLimit: digest.gasLimit,
        result: new Uint8Array(), // TODO: properly decode result
        gasUsed: digest.gasUsed,
        importCount: digest.importCount,
        exportCount: digest.exportCount,
        extrinsicCount: digest.extrinsicCount,
        extrinsicSize: digest.extrinsicSize,
      })),
      authGasUsed: authGasUsed,
      author: authorizer,
      timestamp: BigInt(Date.now()), // TODO: extract from context or data
    },
    remaining: currentData,
  })
}

// Helper functions for decoding (simplified versions)
function decodeAvailabilitySpecification(data: Uint8Array): AvailabilitySpec {
  // Simplified implementation - in practice this would use the proper decoder
  return {
    packageHash: bytesToHex(data.slice(0, 32)),
    bundleLength: bytesToBigInt(data.slice(32, 40)),
    erasureRoot: bytesToHex(data.slice(40, 72)),
    segmentRoot: bytesToHex(data.slice(72, 104)),
    segmentCount: bytesToBigInt(data.slice(104, 112)),
  }
}

function decodeWorkContext(data: Uint8Array): Safe<{
  value: WorkPackageContext
  remaining: Uint8Array
}> {
  // According to Gray Paper and test vectors, WorkPackageContext has these fields:
  // - anchor: HashValue (32 bytes)
  // - state_root: HashValue (32 bytes)
  // - beefy_root: HashValue (32 bytes)
  // - lookup_anchor: HashValue (32 bytes)
  // - lookup_anchor_slot: number (8 bytes)
  // - prerequisites: Uint8Array (variable length)

  let offset = 0

  // Anchor (32 bytes)
  const anchor = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // State root (32 bytes)
  const stateRoot = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Beefy root (32 bytes)
  const beefyRoot = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Lookup anchor (32 bytes)
  const lookupAnchor = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Lookup anchor slot (8 bytes)
  const lookupAnchorSlot = bytesToBigInt(data.slice(offset, offset + 8))
  offset += 8

  // Prerequisites (variable length - array of HashValues)
  const prerequisitesCount = BigInt(
    `0x${Array.from(data.slice(offset, offset + 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  offset += 8
  const prerequisites: Hex[] = []
  for (let i = 0; i < Number(prerequisitesCount); i++) {
    prerequisites.push(bytesToHex(data.slice(offset, offset + 32)))
    offset += 32
  }

  return safeResult({
    value: {
      anchorhash: anchor,
      anchorpoststate: stateRoot,
      anchoraccoutlog: beefyRoot,
      lookupanchorhash: lookupAnchor,
      lookupanchortime: lookupAnchorSlot,
      prerequisites,
    },
    remaining: data.slice(offset),
  })
}

function decodeWorkDigest(data: Uint8Array): Safe<{
  value: WorkDigest
  remaining: Uint8Array
}> {
  // According to Gray Paper and test vectors, WorkDigest has these fields:
  // - serviceIndex: number (8 bytes)
  // - codeHash: HashValue (32 bytes)
  // - payloadHash: HashValue (32 bytes)
  // - gasLimit: number (8 bytes)
  // - result: Uint8Array | WorkError (variable length)
  // - gasUsed: number (8 bytes)
  // - importCount: number (8 bytes)
  // - exportCount: number (8 bytes)
  // - extrinsicCount: number (8 bytes)
  // - extrinsicSize: number (8 bytes)

  let offset = 0

  // Service index (8 bytes)
  const serviceIndex = bytesToBigInt(data.slice(offset, offset + 8))
  offset += 8

  // Code hash (32 bytes)
  const codeHash = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Payload hash (32 bytes)
  const payloadHash = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Gas limit (8 bytes)
  const gasLimit = bytesToBigInt(data.slice(offset, offset + 8))
  offset += 8

  // Result (variable length)
  const resultLength = BigInt(
    `0x${Array.from(data.slice(offset, offset + 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  offset += 8
  const resultData = data.slice(offset, offset + Number(resultLength))
  offset += Number(resultLength)

  // Try to decode as string first (error), fallback to Uint8Array (success)
  let result: Uint8Array | WorkError
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

  // Gas used (8 bytes)
  const gasUsed = bytesToBigInt(data.slice(offset, offset + 8))
  offset += 8

  // Import count (8 bytes)
  const importCount = bytesToBigInt(data.slice(offset, offset + 8))
  offset += 8

  // Export count (8 bytes)
  const exportCount = bytesToBigInt(data.slice(offset, offset + 8))
  offset += 8

  // Extrinsic count (8 bytes)
  const extrinsicCount = bytesToBigInt(data.slice(offset, offset + 8))
  offset += 8

  // Extrinsic size (8 bytes)
  const extrinsicSize = bytesToBigInt(data.slice(offset, offset + 8))
  offset += 8

  return safeResult({
    value: {
      serviceIndex,
      codeHash,
      payloadHash,
      gasLimit,
      result,
      gasUsed,
      importCount,
      exportCount,
      extrinsicCount,
      extrinsicSize,
    },
    remaining: data.slice(offset),
  })
}
