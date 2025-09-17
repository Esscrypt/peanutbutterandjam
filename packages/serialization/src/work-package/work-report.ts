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
  bytesToHex,
  concatBytes,
  type Hex,
  hexToBytes,
  numberToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  DecodingResult,
  WorkPackageContext,
  WorkReport,
} from '@pbnj/types'
import { decodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import {
  decodeAvailabilitySpecification,
  encodeAvailabilitySpecification,
} from './availability-specification'
import { encodeWorkContext } from './context'
import { decodeWorkDigest, encodeWorkDigest } from './work-digest'

/**
 * Encode work report according to Gray Paper specification.
 *
 * Gray Paper formula: encode{WR} = encode{
 *   WR_avspec, WR_context, WR_core, WR_authorizer, WR_authgasused,
 *   var{WR_authtrace}, var{WR_srlookup}, var{WR_digests}
 * }
 *
 * Field order per Gray Paper:
 * 1. avspec (availability specification)
 * 2. context (work context)
 * 3. core (core index, natural encoding)
 * 4. authorizer (hash, 32 bytes)
 * 5. authgasused (gas amount, natural encoding)
 * 6. var{authtrace} (variable-length blob with length prefix)
 * 7. var{srlookup} (variable-length dictionary with length prefix)
 * 8. var{digests} (variable-length sequence with length prefix)
 *
 * ✅ CORRECT: Field order matches Gray Paper
 * ✅ CORRECT: Uses proper variable-length encoding for authtrace, srlookup, digests
 */
export function encodeWorkReport(report: WorkReport): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 1. Availability specification
  const [error0, encoded0] = encodeAvailabilitySpecification(
    report.availabilitySpec,
  )
  if (error0) {
    return safeError(error0)
  }
  parts.push(encoded0)

  // 2. Context
  const [error1, encoded1] = encodeWorkContext(report.context)
  if (error1) {
    return safeError(error1)
  }
  parts.push(encoded1)

  // 3. Core index (natural encoding)
  const [error2, encoded2] = encodeNatural(report.coreIndex)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // 4. Authorizer (hash, 32 bytes)
  parts.push(hexToBytes(report.authorizer))

  // 5. Auth gas used (natural encoding)
  const [error3, encoded3] = encodeNatural(report.authGasUsed)
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // 6. var{authtrace} (variable-length blob)
  const [error4, encoded4] = encodeNatural(BigInt(report.authTrace.length))
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)
  parts.push(report.authTrace)

  // 7. var{srlookup} (variable-length dictionary)
  const srLookupEntries = Array.from(report.srLookup.entries())
  const [error5, encoded5] = encodeNatural(BigInt(srLookupEntries.length))
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)
  for (const [key, value] of srLookupEntries) {
    parts.push(hexToBytes(key))
    parts.push(hexToBytes(value))
  }

  // 8. var{digests} (variable-length sequence)
  const [error6, encoded6] = encodeNatural(BigInt(report.digests.length))
  if (error6) {
    return safeError(error6)
  }
  parts.push(encoded6)
  for (const digest of report.digests) {
    const [error7, encoded7] = encodeWorkDigest(digest)
    if (error7) {
      return safeError(error7)
    }
    parts.push(encoded7)
  }

  return safeResult(concatBytes(parts))
}

/**
 * Decode work report
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work report and remaining data
 */
export function decodeWorkReport(
  data: Uint8Array,
): Safe<DecodingResult<WorkReport>> {
  let currentData = data

  // Availability specification (fixed size)
  const [error0, availabilitySpecResult] =
    decodeAvailabilitySpecification(currentData)
  if (error0) {
    return safeError(error0)
  }
  const availabilitySpec = availabilitySpecResult.value
  currentData = availabilitySpecResult.remaining

  // Context (fixed size)
  const [error1, result1] = decodeWorkContext(currentData)
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
  const [error3, authorizerResult] = decodeFixedLength(currentData, 32n)
  if (error3) {
    return safeError(error3)
  }
  const authorizer = bytesToHex(numberToBytes(authorizerResult.value))
  currentData = authorizerResult.remaining

  // Auth gas used (convert bigint to number)
  const [error4, gasUsedResult] = decodeNatural(currentData)
  if (error4) {
    return safeError(error4)
  }
  const authGasUsed = gasUsedResult.value
  currentData = gasUsedResult.remaining

  // Auth trace (variable length)
  const [error5, authTraceLengthResult] = decodeNatural(currentData)
  if (error5) {
    return safeError(error5)
  }
  const authTraceLength = authTraceLengthResult.value
  currentData = authTraceLengthResult.remaining
  const authTrace = currentData.slice(0, Number(authTraceLength))
  currentData = currentData.slice(Number(authTraceLength))

  // State root lookup (Map<string, string>)
  const [error6, srLookupEntryCountResult] = decodeNatural(currentData)
  if (error6) {
    return safeError(error6)
  }
  const srLookupEntryCount = srLookupEntryCountResult.value
  currentData = srLookupEntryCountResult.remaining
  const srLookup = new Map<Hex, Hex>()
  for (let i = 0; i < Number(srLookupEntryCount); i++) {
    const [error7, keyResult] = decodeFixedLength(currentData, 32n)
    if (error7) {
      return safeError(error7)
    }
    const key = bytesToHex(numberToBytes(keyResult.value))
    currentData = keyResult.remaining
    const [error8, valueResult] = decodeFixedLength(currentData, 32n)
    if (error8) {
      return safeError(error8)
    }
    const value = bytesToHex(numberToBytes(valueResult.value))
    currentData = valueResult.remaining
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

/**
 * Decode work context according to Gray Paper specification.
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 199-206):
 *
 * decode{WC ∈ workcontext} ≡ decode{
 *   WC_anchorhash,
 *   WC_anchorpoststate,
 *   WC_anchoraccoutlog,
 *   WC_lookupanchorhash,
 *   decode[4]{WC_lookupanchortime},
 *   var{WC_prerequisites}
 * }
 *
 * Work context provides the execution environment and dependencies
 * for work package processing.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Work context defines the execution environment for work packages.
 * It provides all the blockchain state and dependency information
 * needed for deterministic computation.
 *
 * Work Context structure:
 * 1. **Anchor hash**: Hash of the anchor block (recent finalized block)
 * 2. **Anchor post-state**: State root after anchor block execution
 * 3. **Anchor account log**: Hash of account changes at anchor
 * 4. **Lookup anchor hash**: Hash of block used for state lookups
 * 5. **Lookup anchor time** (4 bytes): When lookup anchor was created
 * 6. **Prerequisites** (variable): List of work package dependencies
 *
 * Key concepts:
 * - Anchor blocks: Recent finalized blocks providing stable state
 * - State separation: Execution state vs lookup state for efficiency
 * - Dependencies: Prerequisites ensure proper execution ordering
 * - Deterministic time: Fixed time reference prevents non-determinism
 *
 * This context ensures that work package execution is:
 * - Deterministic: Same context → same results
 * - Consistent: All validators use same state references
 * - Efficient: State lookups reference specific known blocks
 *
 * Field decoding per Gray Paper:
 * 1. WC_anchorhash: 32-byte hash (fixed-size, no length prefix)
 * 2. WC_anchorpoststate: 32-byte hash (fixed-size, no length prefix)
 * 3. WC_anchoraccoutlog: 32-byte hash (fixed-size, no length prefix)
 * 4. WC_lookupanchorhash: 32-byte hash (fixed-size, no length prefix)
 * 5. decode[4]{WC_lookupanchortime}: 4-byte fixed-length timeslot
 * 6. var{WC_prerequisites}: variable-length sequence of 32-byte hashes
 *
 * ✅ CORRECT: All 6 fields decoded in correct Gray Paper order
 * ✅ CORRECT: Uses 4-byte decoding for lookupanchortime
 * ✅ CORRECT: Uses variable-length decoding for prerequisites
 * ✅ CORRECT: Properly decodes prerequisite hashes
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work context and remaining data
 */
export function decodeWorkContext(
  data: Uint8Array,
): Safe<DecodingResult<WorkPackageContext>> {
  // According to Gray Paper and test vectors, WorkPackageContext has these fields:
  // - anchor: HashValue (32 bytes)
  // - state_root: HashValue (32 bytes)
  // - beefy_root: HashValue (32 bytes)
  // - lookup_anchor: HashValue (32 bytes)
  // - lookup_anchor_slot: number (4 bytes)
  // - prerequisites: Uint8Array (variable length)

  // 1. WC_anchorhash (32 bytes) - Gray Paper compliant
  if (data.length < 32) {
    return safeError(
      new Error('[decodeWorkContext] Insufficient data for anchor hash'),
    )
  }
  const anchor = bytesToHex(data.slice(0, 32))
  data = data.slice(32)

  // 2. WC_anchorpoststate (32 bytes) - Gray Paper compliant
  if (data.length < 32) {
    return safeError(
      new Error('[decodeWorkContext] Insufficient data for anchor post state'),
    )
  }
  const stateRoot = bytesToHex(data.slice(0, 32))
  data = data.slice(32)

  // 3. WC_anchoraccoutlog (32 bytes) - Gray Paper compliant
  if (data.length < 32) {
    return safeError(
      new Error('[decodeWorkContext] Insufficient data for anchor accout log'),
    )
  }
  const beefyRoot = bytesToHex(data.slice(0, 32))
  data = data.slice(32)

  // 4. WC_lookupanchorhash (32 bytes) - Gray Paper compliant
  if (data.length < 32) {
    return safeError(
      new Error('[decodeWorkContext] Insufficient data for lookup anchor hash'),
    )
  }
  const lookupAnchor = bytesToHex(data.slice(0, 32))
  data = data.slice(32)

  // 5. decode[4]{WC_lookupanchortime} (4 bytes fixed-length) - Gray Paper compliant
  if (data.length < 4) {
    return safeError(
      new Error('[decodeWorkContext] Insufficient data for lookup anchor time'),
    )
  }
  const [error5, lookupAnchorSlotResult] = decodeFixedLength(data, 4n)
  if (error5) {
    return safeError(error5)
  }
  const lookupAnchorSlot = lookupAnchorSlotResult.value
  data = lookupAnchorSlotResult.remaining

  // 6. var{WC_prerequisites} (variable-length sequence) - Gray Paper compliant
  if (data.length < 1) {
    return safeError(
      new Error(
        '[decodeWorkContext] Insufficient data for prerequisites length',
      ),
    )
  }
  const [error6, prerequisitesCountResult] = decodeNatural(data)
  if (error6) {
    return safeError(error6)
  }
  const prerequisitesCount = prerequisitesCountResult.value
  data = prerequisitesCountResult.remaining

  // Validate prerequisites count is reasonable
  if (prerequisitesCount > 1000n) {
    return safeError(
      new Error('[decodeWorkContext] Too many prerequisites (max 1000)'),
    )
  }

  const prerequisites: Hex[] = []
  for (let i = 0; i < Number(prerequisitesCount); i++) {
    if (data.length < 32) {
      return safeError(
        new Error(
          `[decodeWorkContext] Insufficient data for prerequisite ${i}`,
        ),
      )
    }
    const [error7, prerequisiteResult] = decodeFixedLength(data, 32n)
    if (error7) {
      return safeError(error7)
    }
    prerequisites.push(bytesToHex(numberToBytes(prerequisiteResult.value)))
    data = prerequisiteResult.remaining
  }

  return safeResult({
    value: {
      anchorHash: anchor,
      anchorPostState: stateRoot,
      anchorAccoutLog: beefyRoot,
      lookupAnchorHash: lookupAnchor,
      lookupAnchorTime: lookupAnchorSlot,
      prerequisites,
    },
    remaining: data,
  })
}
