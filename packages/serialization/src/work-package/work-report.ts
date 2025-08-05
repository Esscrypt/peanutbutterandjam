/**
 * Work report serialization
 *
 * Implements Gray Paper work report serialization
 * Reference: graypaper/text/work_report.tex
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type { OctetSequence, WorkReport } from '../types'
import { encodeAvailabilitySpecification } from './availability-specification'
import { encodeWorkContext } from './context'
import { encodeWorkDigest } from './work-digest'

/**
 * Encode work report
 *
 * @param report - Work report to encode
 * @returns Encoded octet sequence
 */
export function encodeWorkReport(report: WorkReport): OctetSequence {
  const parts: Uint8Array[] = []

  // Availability specification
  parts.push(encodeAvailabilitySpecification(report.availabilitySpecification))

  // Context
  parts.push(encodeWorkContext(report.context))

  // Core (variable length)
  parts.push(encodeNatural(BigInt(report.core.length))) // Length prefix
  parts.push(report.core)

  // Authorizer (32 bytes)
  parts.push(hexToBytes(report.authorizer))

  // Auth gas used (8 bytes)
  parts.push(encodeNatural(report.authGasUsed))

  // Auth trace (variable length)
  parts.push(encodeNatural(BigInt(report.authTrace.length))) // Length prefix
  parts.push(report.authTrace)

  // State root lookup (variable length)
  parts.push(encodeNatural(BigInt(report.stateRootLookup.length))) // Length prefix
  parts.push(report.stateRootLookup)

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
export function decodeWorkReport(data: OctetSequence): {
  value: WorkReport
  remaining: OctetSequence
} {
  let currentData = data

  // Availability specification (fixed size)
  const availabilitySpecification = decodeAvailabilitySpecification(
    currentData.slice(0, 112),
  )
  currentData = currentData.slice(112)

  // Context (fixed size)
  const context = decodeWorkContext(currentData.slice(0, 200))
  currentData = currentData.slice(200)

  // Core (variable length)
  const coreLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const core = currentData.slice(0, Number(coreLength))
  currentData = currentData.slice(Number(coreLength))

  // Authorizer (32 bytes)
  const authorizer = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Auth gas used (8 bytes)
  const authGasUsed = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  // Auth trace (variable length)
  const authTraceLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const authTrace = currentData.slice(0, Number(authTraceLength))
  currentData = currentData.slice(Number(authTraceLength))

  // State root lookup (variable length)
  const stateRootLookupLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const stateRootLookup = currentData.slice(0, Number(stateRootLookupLength))
  currentData = currentData.slice(Number(stateRootLookupLength))

  // Digests (array of work digests)
  const digests = []
  while (currentData.length > 0) {
    const { value: digest, remaining } = decodeWorkDigest(currentData)
    digests.push(digest)
    currentData = remaining
  }

  return {
    value: {
      availabilitySpecification,
      context,
      core,
      authorizer,
      authGasUsed,
      authTrace,
      stateRootLookup,
      digests,
    },
    remaining: currentData,
  }
}

// Helper functions for decoding (simplified versions)
function decodeAvailabilitySpecification(data: OctetSequence) {
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

function decodeWorkDigest(data: OctetSequence) {
  // Simplified implementation - in practice this would use the proper decoder
  return {
    value: {
      serviceIndex: BigInt(
        `0x${Array.from(data.slice(0, 8))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
      codeHash: bytesToHex(data.slice(8, 40)),
      payloadHash: bytesToHex(data.slice(40, 72)),
      gasLimit: BigInt(
        `0x${Array.from(data.slice(72, 80))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
      result: data.slice(80, 112),
      gasUsed: BigInt(
        `0x${Array.from(data.slice(112, 120))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
      importCount: BigInt(
        `0x${Array.from(data.slice(120, 128))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
      extrinsicCount: BigInt(
        `0x${Array.from(data.slice(128, 136))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
      extrinsicSize: BigInt(
        `0x${Array.from(data.slice(136, 144))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
      exportCount: BigInt(
        `0x${Array.from(data.slice(144, 152))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
      ),
    },
    remaining: data.slice(152),
  }
}
