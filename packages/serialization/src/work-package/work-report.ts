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

import { bytesToHex, hexToBytes } from '@pbnj/core'
import type {
  AvailabilitySpec,
  HashValue,
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
export function encodeWorkReport(report: WorkReport): Uint8Array {
  const parts: Uint8Array[] = []

  // Availability specification
  parts.push(encodeAvailabilitySpecification(report.availabilitySpec))

  // Context
  parts.push(encodeWorkContext(report.context))

  // Core index (4 bytes) - using coreIndex instead of raw core data
  parts.push(encodeNatural(BigInt(report.coreIndex)))

  // Authorizer (string as hex)
  parts.push(hexToBytes(report.authorizer as `0x${string}`))

  // Auth gas used (convert number to bigint)
  parts.push(encodeNatural(BigInt(report.authGasUsed)))

  // Auth trace (variable length)
  parts.push(encodeNatural(BigInt(report.authTrace.length))) // Length prefix
  parts.push(report.authTrace)

  // State root lookup (Map<string, string> serialized)
  const srLookupEntries = Array.from(report.srLookup.entries())
  parts.push(encodeNatural(BigInt(srLookupEntries.length))) // Number of entries
  for (const [key, value] of srLookupEntries) {
    parts.push(hexToBytes(key as `0x${string}`))
    parts.push(hexToBytes(value as `0x${string}`))
  }

  // Digests (array of work digests)
  for (const digest of report.digests) {
    parts.push(encodeWorkDigest(digest))
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
 * Decode work report
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work report and remaining data
 */
export function decodeWorkReport(data: Uint8Array): {
  value: WorkReport
  remaining: Uint8Array
} {
  let currentData = data

  // Availability specification (fixed size)
  const availabilitySpec = decodeAvailabilitySpecification(
    currentData.slice(0, 112),
  )
  currentData = currentData.slice(112)

  // Context (fixed size)
  const context = decodeWorkContext(currentData.slice(0, 200))
  currentData = currentData.slice(200)

  // Core index (number)
  const { value: coreIndexBigInt, remaining: afterCoreIndex } =
    decodeNatural(currentData)
  const coreIndex = Number(coreIndexBigInt)
  currentData = afterCoreIndex

  // Authorizer (32 Uint8Array)
  const authorizer = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Auth gas used (convert bigint to number)
  const { value: authGasUsedBigInt, remaining: afterAuthGas } =
    decodeNatural(currentData)
  const authGasUsed = Number(authGasUsedBigInt)
  currentData = afterAuthGas

  // Auth trace (variable length)
  const { value: authTraceLength, remaining: afterAuthTraceLength } =
    decodeNatural(currentData)
  currentData = afterAuthTraceLength
  const authTrace = currentData.slice(0, Number(authTraceLength))
  currentData = currentData.slice(Number(authTraceLength))

  // State root lookup (Map<string, string>)
  const { value: srLookupEntryCount, remaining: afterSrCount } =
    decodeNatural(currentData)
  currentData = afterSrCount
  const srLookup = new Map<string, string>()
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
    const { value: digest, remaining } = decodeWorkDigest(currentData)
    digests.push(digest)
    currentData = remaining
  }

  return {
    value: {
      id: 'decoded-work-report', // TODO: extract from data if present
      workPackageId: 'decoded-work-package', // TODO: extract from data if present
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
      authGasUsed: Number(authGasUsed),
      author: authorizer,
      timestamp: Date.now(), // TODO: extract from context or data
    },
    remaining: currentData,
  }
}

// Helper functions for decoding (simplified versions)
function decodeAvailabilitySpecification(data: Uint8Array): AvailabilitySpec {
  // Simplified implementation - in practice this would use the proper decoder
  return {
    packageHash: bytesToHex(data.slice(0, 32)),
    bundleLength: Number(
      BigInt(
        `0x${Array.from(data.slice(32, 40))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
    ),
    erasureRoot: bytesToHex(data.slice(40, 72)),
    segmentRoot: bytesToHex(data.slice(72, 104)),
    segmentCount: Number(
      BigInt(
        `0x${Array.from(data.slice(104, 112))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
    ),
  }
}

function decodeWorkContext(data: Uint8Array): WorkPackageContext {
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
  const lookupAnchorSlot = Number(
    BigInt(
      `0x${Array.from(data.slice(offset, offset + 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  offset += 8

  // Prerequisites (variable length - array of HashValues)
  const prerequisitesCount = BigInt(
    `0x${Array.from(data.slice(offset, offset + 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  offset += 8
  const prerequisites: HashValue[] = []
  for (let i = 0; i < Number(prerequisitesCount); i++) {
    prerequisites.push(bytesToHex(data.slice(offset, offset + 32)))
    offset += 32
  }

  return {
    anchorhash: anchor,
    anchorpoststate: stateRoot,
    anchoraccoutlog: beefyRoot,
    lookupanchorhash: lookupAnchor,
    lookupanchortime: Number(lookupAnchorSlot),
    prerequisites,
  }
}

function decodeWorkDigest(data: Uint8Array): {
  value: WorkDigest
  remaining: Uint8Array
} {
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
  const serviceIndex = Number(
    BigInt(
      `0x${Array.from(data.slice(offset, offset + 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  offset += 8

  // Code hash (32 bytes)
  const codeHash = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Payload hash (32 bytes)
  const payloadHash = bytesToHex(data.slice(offset, offset + 32))
  offset += 32

  // Gas limit (8 bytes)
  const gasLimit = Number(
    BigInt(
      `0x${Array.from(data.slice(offset, offset + 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
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
  const gasUsed = Number(
    BigInt(
      `0x${Array.from(data.slice(offset, offset + 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  offset += 8

  // Import count (8 bytes)
  const importCount = Number(
    BigInt(
      `0x${Array.from(data.slice(offset, offset + 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  offset += 8

  // Export count (8 bytes)
  const exportCount = Number(
    BigInt(
      `0x${Array.from(data.slice(offset, offset + 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  offset += 8

  // Extrinsic count (8 bytes)
  const extrinsicCount = Number(
    BigInt(
      `0x${Array.from(data.slice(offset, offset + 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  offset += 8

  // Extrinsic size (8 bytes)
  const extrinsicSize = Number(
    BigInt(
      `0x${Array.from(data.slice(offset, offset + 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`,
    ),
  )
  offset += 8

  return {
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
  }
}
