/**
 * Operand tuple serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 279-287):
 *
 * encode[U](OT ∈ operandtuple) ≡ encode(
 *   OT_packagehash,
 *   OT_segroot,
 *   OT_authorizer,
 *   OT_payloadhash,
 *   OT_gaslimit,
 *   encodeResult(OT_result),
 *   var{OT_authtrace}
 * )
 *
 * Operand tuples represent work item execution results that are passed
 * between services during PVM accumulation. The [U] parameter indicates
 * the accumulation context for the encoding.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Operand tuples are the primary outputs of successful work item execution.
 * They contain both the result data and metadata about execution.
 *
 * Operand Tuple structure:
 * 1. **Package hash**: Hash of work package that produced this result
 * 2. **Segment root**: Merkle root of data segments produced
 * 3. **Authorizer**: Public key that authorized the original work package
 * 4. **Payload hash**: Hash of input data that was processed
 * 5. **Gas limit**: Maximum gas the work item was allowed to use
 * 6. **Result**: The actual output data or error code (encodeResult)
 * 7. **Auth trace** (variable): Execution trace of authorization logic
 *
 * Key concepts:
 * - **Work item outputs**: Results from successful PVM execution
 * - **Import/Export**: Other work items can import these as inputs
 * - **Traceability**: Full audit trail from input to output
 * - **Gas accounting**: Precise resource usage tracking
 *
 * Result encoding:
 * - Success: var{output_data} with type 0
 * - Errors: specific error codes (1=∞, 2=panic, 3=badexports, etc.)
 *
 * This structure enables work items to produce verifiable outputs
 * that other work items can safely consume with full provenance.
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import type {
  OperandTuple,
  SerializationWorkError as WorkError,
  WorkResult,
} from '@pbnj/types'
import { encodeNatural } from '../core/natural-number'

/**
 * Encode operand tuple
 *
 * @param operandTuple - Operand tuple to encode
 * @returns Encoded octet sequence
 */
export function encodeOperandTuple(operandTuple: OperandTuple): Uint8Array {
  const parts: Uint8Array[] = []

  // Package hash (32 Uint8Array)
  parts.push(hexToBytes(operandTuple.packageHash))

  // Segment root (32 Uint8Array)
  parts.push(hexToBytes(operandTuple.segmentRoot))

  // Authorizer (32 Uint8Array)
  parts.push(hexToBytes(operandTuple.authorizer))

  // Payload hash (32 Uint8Array)
  parts.push(hexToBytes(operandTuple.payloadHash))

  // Gas limit (8 Uint8Array)
  parts.push(encodeNatural(BigInt(operandTuple.gasLimit)))

  // Result (variable length)
  if (typeof operandTuple.result === 'string') {
    // Error result
    const errorUint8Array = new TextEncoder().encode(operandTuple.result)
    const lengthEncoded = encodeNatural(BigInt(errorUint8Array.length))
    parts.push(lengthEncoded)
    parts.push(errorUint8Array)
  } else {
    // Success result (hex string, convert to bytes)
    const resultBytes = operandTuple.result as Uint8Array
    const lengthEncoded = encodeNatural(BigInt(resultBytes.length))
    parts.push(lengthEncoded)
    parts.push(resultBytes)
  }

  // Auth trace (variable length)
  parts.push(encodeNatural(BigInt(operandTuple.authTrace.length))) // Length prefix
  parts.push(operandTuple.authTrace)

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
 * Decode operand tuple
 *
 * @param data - Octet sequence to decode
 * @returns Decoded operand tuple and remaining data
 */
export function decodeOperandTuple(data: Uint8Array): {
  value: OperandTuple
  remaining: Uint8Array
} {
  let currentData = data

  // Package hash (32 Uint8Array)
  const packageHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Segment root (32 Uint8Array)
  const segRoot = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Authorizer (32 Uint8Array)
  const authorizer = bytesToHex(currentData.slice(0, 32))
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
      [
        'oversize',
        'bad_exports',
        'invalid_result',
        'gas_limit_exceeded',
      ].includes(resultString)
    ) {
      result = resultString as WorkError
    } else {
      result = resultData
    }
  } catch {
    result = resultData
  }

  // Auth trace (variable length)
  const authTraceLength = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)
  const authTrace = currentData.slice(0, Number(authTraceLength))
  currentData = currentData.slice(Number(authTraceLength))

  return {
    value: {
      packageHash,
      segmentRoot: segRoot,
      authorizer,
      payloadHash,
      gasLimit: Number(gasLimit),
      result,
      authTrace,
    },
    remaining: currentData,
  }
}
