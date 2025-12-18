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
} from '@pbnjam/core'
import type { DecodingResult, Safe, WorkReport } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import {
  decodeWorkPackageSpec,
  encodeWorkPackageSpec,
} from './availability-specification'
import { decodeRefineContext, encodeRefineContext } from './context'
import { decodeWorkResult, encodeWorkResult } from './work-result'

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
  const [error0, encoded0] = encodeWorkPackageSpec(report.package_spec)
  if (error0) {
    return safeError(error0)
  }
  parts.push(encoded0)

  // 2. Context
  const [error1, encoded1] = encodeRefineContext(report.context)
  if (error1) {
    return safeError(error1)
  }
  parts.push(encoded1)

  // 3. Core index (natural encoding)
  const [error2, encoded2] = encodeNatural(report.core_index)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // 4. Authorizer hash (hash, 32 bytes)
  parts.push(hexToBytes(report.authorizer_hash))

  // 5. Auth gas used (natural encoding)
  const [error3, encoded3] = encodeNatural(report.auth_gas_used)
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // 6. var{auth_output} (variable-length blob)
  const authOutputBytes = hexToBytes(report.auth_output)
  const [error4, encoded4] = encodeNatural(BigInt(authOutputBytes.length))
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)
  parts.push(authOutputBytes)

  // 7. var{segment_root_lookup} (variable-length array)
  const srLookupEntries = report.segment_root_lookup
  const [error5, encoded5] = encodeNatural(BigInt(srLookupEntries.length))
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)
  for (const entry of srLookupEntries) {
    parts.push(hexToBytes(entry.work_package_hash))
    parts.push(hexToBytes(entry.segment_tree_root))
  }

  // 8. var{results} (variable-length sequence)
  const [error6, encoded6] = encodeNatural(BigInt(report.results.length))
  if (error6) {
    return safeError(error6)
  }
  parts.push(encoded6)
  for (const result of report.results) {
    const [error7, encoded7] = encodeWorkResult(result)
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

  // Work package specification (fixed size)
  const [error0, packageSpecResult] = decodeWorkPackageSpec(currentData)
  if (error0) {
    return safeError(error0)
  }
  const packageSpec = packageSpecResult.value
  currentData = packageSpecResult.remaining

  // Context (fixed size)
  const [error1, result1] = decodeRefineContext(currentData)
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
  const core_index = result2.value
  currentData = result2.remaining

  // Authorizer hash (32 bytes)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for authorizer hash'))
  }
  const authorizer_hash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Auth gas used (convert bigint to number)
  const [error4, gasUsedResult] = decodeNatural(currentData)
  if (error4) {
    return safeError(error4)
  }
  const auth_gas_used = gasUsedResult.value
  currentData = gasUsedResult.remaining

  // Auth output (variable length)
  const [error5, authOutputLengthResult] = decodeNatural(currentData)
  if (error5) {
    return safeError(error5)
  }
  const authOutputLength = authOutputLengthResult.value
  currentData = authOutputLengthResult.remaining
  const auth_output = bytesToHex(currentData.slice(0, Number(authOutputLength)))
  currentData = currentData.slice(Number(authOutputLength))

  // Segment root lookup (array of SegmentRootLookupItem)
  const [error6, srLookupEntryCountResult] = decodeNatural(currentData)
  if (error6) {
    return safeError(error6)
  }
  const srLookupEntryCount = srLookupEntryCountResult.value
  currentData = srLookupEntryCountResult.remaining
  const segment_root_lookup: Array<{
    work_package_hash: Hex
    segment_tree_root: Hex
  }> = []
  for (let i = 0; i < Number(srLookupEntryCount); i++) {
    const [error7, keyResult] = decodeFixedLength(currentData, 32n)
    if (error7) {
      return safeError(error7)
    }
    const work_package_hash = bytesToHex(numberToBytes(keyResult.value))
    currentData = keyResult.remaining
    const [error8, valueResult] = decodeFixedLength(currentData, 32n)
    if (error8) {
      return safeError(error8)
    }
    const segment_tree_root = bytesToHex(numberToBytes(valueResult.value))
    currentData = valueResult.remaining
    segment_root_lookup.push({ work_package_hash, segment_tree_root })
  }

  // Results (array of work results) - length-prefixed sequence
  const [error9, resultsCountResult] = decodeNatural(currentData)
  if (error9) {
    return safeError(error9)
  }
  const resultsCount = Number(resultsCountResult.value)
  currentData = resultsCountResult.remaining

  const results = []
  for (let i = 0; i < resultsCount; i++) {
    const [error10, result10] = decodeWorkResult(currentData)
    if (error10) {
      return safeError(error10)
    }
    const result = result10.value
    currentData = result10.remaining
    results.push(result)
  }

  const consumed = data.length - currentData.length

  return safeResult({
    value: {
      package_spec: {
        hash: packageSpec.hash,
        length: packageSpec.length,
        erasure_root: packageSpec.erasure_root,
        exports_root: packageSpec.exports_root,
        exports_count: packageSpec.exports_count,
      },
      context,
      core_index,
      authorizer_hash,
      auth_gas_used,
      auth_output,
      segment_root_lookup,
      results,
    },
    remaining: currentData,
    consumed,
  })
}
