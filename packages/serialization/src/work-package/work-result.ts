/**
 * Work result serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 216-229):
 *
 * encode(WR ∈ workresult) ≡ encode(
 *   encode[4](WR_serviceid),
 *   WR_codehash,
 *   WR_payloadhash,
 *   encode[8](WR_accumulategas),
 *   encodeResult(WR_result),
 *   WR_refineload
 * )
 *
 * Work results provide structured summaries of work item execution results.
 * They contain service information, execution results, and refinement statistics.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Work results are structured summaries that allow validators to verify
 * work item results and track execution statistics.
 *
 * Work Result structure:
 * 1. **Service ID** (4 bytes): Which service executed this work item
 * 2. **Code hash**: Hash of the code that was executed
 * 3. **Payload hash**: Hash of the work item payload
 * 4. **Accumulate gas** (8 bytes): Gas limit for accumulation
 * 5. **Result**: Execution result (ok, error, etc.)
 * 6. **Refine load**: Refinement load statistics
 */

import {
  bytesToHex,
  concatBytes,
  type Hex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  DecodingResult,
  RefineLoad,
  WorkExecResultValue,
  WorkResult,
} from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'

/**
 * Encode work execution result according to Gray Paper specification.
 *
 * Gray Paper encodeResult semantics:
 * - Success: var{output_data} - variable-length blob with actual result data
 * - Error codes: specific discriminators for different error types
 *
 * @param result - Work result (success data or error string)
 * @returns Encoded result with proper Gray Paper encoding
 */
/**
 * Encode work execution result according to Gray Paper specification.
 *
 * Gray Paper encodeResult semantics:
 * - Success: discriminator(0) + var{output_data} - variable-length blob with actual result data
 * - Error/Panic: discriminator(1) - single byte discriminator for error states
 *
 * Based on test vector structure:
 * - {"ok": "0xaabbcc"} → discriminator(0) + var{"0xaabbcc"}
 * - {"panic": null} → discriminator(1)
 *
 * @param result - Work result (success data or error object)
 * @returns Encoded result with proper Gray Paper encoding
 */
function encodeWorkExecutionResult(
  result: WorkExecResultValue,
): Safe<Uint8Array> {
  if (typeof result === 'string') {
    // Check if it's a hex string (success case) or error string
    if (result.startsWith('0x')) {
      // Hex string result: encode as success with discriminator 0
      const resultBytes = hexToBytes(result as Hex)
      const [error, lengthEncoded] = encodeNatural(BigInt(resultBytes.length))
      if (error) {
        return safeError(error)
      }
      return safeResult(
        concatBytes([new Uint8Array([0]), lengthEncoded, resultBytes]),
      )
    } else {
      // Error string: encode as discriminator-only case
      switch (result) {
        case 'out_of_gas':
          return safeResult(new Uint8Array([1]))
        case 'bad_exports':
          return safeResult(new Uint8Array([3]))
        case 'oversize':
          return safeResult(new Uint8Array([4]))
        case 'bad_code':
          return safeResult(new Uint8Array([5]))
        case 'code_oversize':
          return safeResult(new Uint8Array([6]))
        default:
          return safeError(new Error(`Unknown error string: ${result}`))
      }
    }
  } else if (typeof result === 'object' && result !== null) {
    // Object result: handle discriminated union
    if ('ok' in result && typeof result.ok === 'string') {
      // Success case: {"ok": "0xaabbcc"}
      const resultBytes = hexToBytes(result.ok)
      const [error, lengthEncoded] = encodeNatural(BigInt(resultBytes.length))
      if (error) {
        return safeError(error)
      }
      return safeResult(
        concatBytes([new Uint8Array([0]), lengthEncoded, resultBytes]),
      )
    } else if ('panic' in result) {
      // Panic case: {"panic": null}
      return safeResult(new Uint8Array([2]))
    } else {
      return safeError(
        new Error(`Unknown result object structure: ${JSON.stringify(result)}`),
      )
    }
  } else {
    return safeError(new Error(`Invalid result type: ${typeof result}`))
  }
}

/**
 * Decode work execution result according to Gray Paper specification.
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work result and remaining data
 */
/**
 * Decode work execution result according to Gray Paper specification.
 *
 * Gray Paper decodeResult semantics:
 * - Success: discriminator(0) + var{output_data} - decode discriminator then variable-length data
 * - Error/Panic: discriminator(1) - single byte discriminator for error states
 *
 * @param data - Octet sequence to decode
 * @returns Decoded work result and remaining data
 */
function decodeWorkExecutionResult(
  data: Uint8Array,
): Safe<DecodingResult<WorkExecResultValue>> {
  let currentData = data

  if (currentData.length < 1) {
    return safeError(new Error('Insufficient data for result discriminator'))
  }

  const discriminator = currentData[0]
  currentData = currentData.slice(1)

  if (discriminator === 0) {
    // Success case: decode variable-length data
    const [error, lengthResult] = decodeNatural(currentData)
    if (error) {
      return safeError(error)
    }
    const length = Number(lengthResult.value)
    currentData = lengthResult.remaining

    if (currentData.length < length) {
      return safeError(new Error('Insufficient data for result'))
    }

    // Extract result data and convert to hex string
    const resultData = currentData.slice(0, length)
    currentData = currentData.slice(length)
    const result = bytesToHex(resultData)

    return safeResult({
      value: result,
      remaining: currentData,
      consumed: data.length - currentData.length,
    })
  } else if (discriminator === 1) {
    // Out of gas case: return out of gas error
    const result = 'out_of_gas'

    return safeResult({
      value: result,
      remaining: currentData,
      consumed: data.length - currentData.length,
    })
  } else if (discriminator === 2) {
    // Panic case: return panic object
    const result = { panic: null }

    return safeResult({
      value: result,
      remaining: currentData,
      consumed: data.length - currentData.length,
    })
  } else if (discriminator === 3) {
    // Bad exports case: return bad exports error
    const result = 'bad_exports'

    return safeResult({
      value: result,
      remaining: currentData,
      consumed: data.length - currentData.length,
    })
  } else if (discriminator === 4) {
    // Oversize case: return oversize error
    const result = 'oversize'

    return safeResult({
      value: result,
      remaining: currentData,
      consumed: data.length - currentData.length,
    })
  } else if (discriminator === 5) {
    // Bad code case: return bad code error
    const result = 'bad_code'

    return safeResult({
      value: result,
      remaining: currentData,
      consumed: data.length - currentData.length,
    })
  } else if (discriminator === 6) {
    // Code oversize case: return code oversize error
    const result = 'code_oversize'

    return safeResult({
      value: result,
      remaining: currentData,
      consumed: data.length - currentData.length,
    })
  } else {
    return safeError(
      new Error(`Unknown result discriminator: ${discriminator}`),
    )
  }
}

/**
 * Encode work result according to Gray Paper specification.
 *
 * Gray Paper Equation 216-229 (label: encode{WR ∈ workresult}):
 * encode{WR ∈ workresult} ≡ encode{
 *   encode[4]{WR_serviceid},
 *   WR_codehash,
 *   WR_payloadhash,
 *   encode[8]{WR_accumulategas},
 *   encodeResult{WR_result},
 *   WR_refineload
 * }
 *
 * Work results describe the outcome of work item execution, including
 * service information, execution results, and refinement statistics.
 *
 * Field encoding per Gray Paper:
 * 1. encode[4]{WR_serviceid}: 4-byte fixed-length - service identifier
 * 2. WR_codehash: 32-byte hash - service code hash
 * 3. WR_payloadhash: 32-byte hash - payload hash
 * 4. encode[8]{WR_accumulategas}: 8-byte fixed-length - accumulation gas limit
 * 5. encodeResult{WR_result}: variable-length - execution result
 * 6. WR_refineload: variable-length - refinement load statistics
 *
 * ✅ CORRECT: All 6 fields present in correct Gray Paper order
 * ✅ CORRECT: Hash fields use raw 32-byte encoding
 * ✅ CORRECT: Uses encode[4] for serviceid (4-byte fixed-length)
 * ✅ CORRECT: Uses encode[8] for accumulategas (8-byte fixed-length)
 * ✅ CORRECT: Uses variable-length encoding for result and refine load
 */
export function encodeWorkResult(result: WorkResult): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Service ID (4 bytes)
  const [error1, serviceIdEncoded] = encodeFixedLength(result.service_id, 4n)
  if (error1) return safeError(error1)
  parts.push(serviceIdEncoded)

  // Code hash (32 bytes)
  parts.push(hexToBytes(result.code_hash))

  // Payload hash (32 bytes)
  parts.push(hexToBytes(result.payload_hash))

  // Accumulate gas (8 bytes)
  const [error2, accumulateGasEncoded] = encodeFixedLength(
    result.accumulate_gas,
    8n,
  )
  if (error2) return safeError(error2)
  parts.push(accumulateGasEncoded)

  // Result (variable-length execution result)
  const [error3, resultEncoded] = encodeWorkExecutionResult(result.result)
  if (error3) return safeError(error3)
  parts.push(resultEncoded)

  // Refine load (variable length)
  const [error4, refineLoadEncoded] = encodeRefineLoad(result.refine_load)
  if (error4) return safeError(error4)
  parts.push(refineLoadEncoded)

  return safeResult(concatBytes(parts))
}

/**
 * Decode work result according to Gray Paper specification.
 *
 * Gray Paper Equation 216-229 (label: decode{WR ∈ workresult}):
 * Inverse of encode{WR ∈ workresult} ≡ decode{
 *   decode[4]{WR_serviceid},
 *   WR_codehash,
 *   WR_payloadhash,
 *   decode[8]{WR_accumulategas},
 *   decodeResult{WR_result},
 *   WR_refineload
 * }
 *
 * Decodes work result from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. decode[4]{WR_serviceid}: 4-byte fixed-length - service identifier
 * 2. WR_codehash: 32-byte hash - service code hash
 * 3. WR_payloadhash: 32-byte hash - payload hash
 * 4. decode[8]{WR_accumulategas}: 8-byte fixed-length - accumulation gas limit
 * 5. decodeResult{WR_result}: variable-length - execution result
 * 6. WR_refineload: variable-length - refinement load statistics
 *
 * ✅ CORRECT: All 6 fields decoded in correct Gray Paper order
 * ✅ CORRECT: Hash fields use raw 32-byte decoding
 * ✅ CORRECT: Uses decode[4] for serviceid (4-byte fixed-length)
 * ✅ CORRECT: Uses decode[8] for accumulategas (8-byte fixed-length)
 * ✅ CORRECT: Uses variable-length decoding for result and refine load
 */
export function decodeWorkResult(
  data: Uint8Array,
): Safe<DecodingResult<WorkResult>> {
  let currentData = data

  // Service ID (4 bytes)
  if (currentData.length < 4) {
    return safeError(new Error('Insufficient data for service ID'))
  }
  const [error1, serviceIdResult] = decodeFixedLength(currentData, 4n)
  if (error1) return safeError(error1)
  const service_id = serviceIdResult.value
  currentData = serviceIdResult.remaining

  // Code hash (32 bytes)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for code hash'))
  }
  const code_hash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Payload hash (32 bytes)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for payload hash'))
  }
  const payload_hash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Accumulate gas (8 bytes)
  if (currentData.length < 8) {
    return safeError(new Error('Insufficient data for accumulate gas'))
  }
  const [error2, accumulateGasResult] = decodeFixedLength(currentData, 8n)
  if (error2) return safeError(error2)
  const accumulate_gas = accumulateGasResult.value
  currentData = accumulateGasResult.remaining

  // Result (variable-length execution result)
  const [error3, resultDecoded] = decodeWorkExecutionResult(currentData)
  if (error3) return safeError(error3)
  const result = resultDecoded.value
  currentData = resultDecoded.remaining

  // Refine load (variable length)
  const [error4, refineLoadResult] = decodeRefineLoad(currentData)
  if (error4) return safeError(error4)
  const refine_load = refineLoadResult.value
  currentData = refineLoadResult.remaining

  return safeResult({
    value: {
      service_id,
      code_hash,
      payload_hash,
      accumulate_gas,
      result,
      refine_load,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encode refine load according to Gray Paper specification.
 *
 * Refine load contains execution statistics:
 * 1. gas_used: Gas consumed during execution
 * 2. imports: Number of imports
 * 3. extrinsic_count: Number of extrinsics
 * 4. extrinsic_size: Size of extrinsics
 * 5. exports: Number of exports
 */
function encodeRefineLoad(load: RefineLoad): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Gas used (variable length)
  const [error1, gasUsedEncoded] = encodeNatural(load.gas_used)
  if (error1) return safeError(error1)
  parts.push(gasUsedEncoded)

  // Imports (variable length)
  const [error2, importsEncoded] = encodeNatural(load.imports)
  if (error2) return safeError(error2)
  parts.push(importsEncoded)

  // Extrinsic count (variable length)
  const [error3, extrinsicCountEncoded] = encodeNatural(load.extrinsic_count)
  if (error3) return safeError(error3)
  parts.push(extrinsicCountEncoded)

  // Extrinsic size (variable length)
  const [error4, extrinsicSizeEncoded] = encodeNatural(load.extrinsic_size)
  if (error4) return safeError(error4)
  parts.push(extrinsicSizeEncoded)

  // Exports (variable length)
  const [error5, exportsEncoded] = encodeNatural(load.exports)
  if (error5) return safeError(error5)
  parts.push(exportsEncoded)

  return safeResult(concatBytes(parts))
}

/**
 * Decode refine load according to Gray Paper specification.
 */
function decodeRefineLoad(data: Uint8Array): Safe<DecodingResult<RefineLoad>> {
  let currentData = data

  // Gas used
  const [error1, gasUsedResult] = decodeNatural(currentData)
  if (error1) return safeError(error1)
  const gas_used = gasUsedResult.value
  currentData = gasUsedResult.remaining

  // Imports
  const [error2, importsResult] = decodeNatural(currentData)
  if (error2) return safeError(error2)
  const imports = importsResult.value
  currentData = importsResult.remaining

  // Extrinsic count
  const [error3, extrinsicCountResult] = decodeNatural(currentData)
  if (error3) return safeError(error3)
  const extrinsic_count = extrinsicCountResult.value
  currentData = extrinsicCountResult.remaining

  // Extrinsic size
  const [error4, extrinsicSizeResult] = decodeNatural(currentData)
  if (error4) return safeError(error4)
  const extrinsic_size = extrinsicSizeResult.value
  currentData = extrinsicSizeResult.remaining

  // Exports
  const [error5, exportsResult] = decodeNatural(currentData)
  if (error5) return safeError(error5)
  const exports = exportsResult.value
  currentData = exportsResult.remaining

  return safeResult({
    value: {
      gas_used,
      imports,
      extrinsic_count,
      extrinsic_size,
      exports,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}
