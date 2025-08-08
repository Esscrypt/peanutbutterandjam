/**
 * Operand tuple serialization
 *
 * Implements Gray Paper operand tuple serialization
 * Reference: graypaper/text/operand_tuple.tex
 */

import { bytesToHex, hexToUint8Array } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type {
  Uint8Array,
  OperandTuple,
  WorkError,
  WorkResult,
} from '../types'

/**
 * Encode operand tuple
 *
 * @param operandTuple - Operand tuple to encode
 * @returns Encoded octet sequence
 */
export function encodeOperandTuple(operandTuple: OperandTuple): Uint8Array {
  const parts: Uint8Array[] = []

  // Package hash (32 Uint8Array)
  parts.push(hexToUint8Array(operandTuple.packageHash))

  // Segment root (32 Uint8Array)
  parts.push(hexToUint8Array(operandTuple.segmentRoot))

  // Authorizer (32 Uint8Array)
  parts.push(hexToUint8Array(operandTuple.authorizer))

  // Payload hash (32 Uint8Array)
  parts.push(hexToUint8Array(operandTuple.payloadHash))

  // Gas limit (8 Uint8Array)
  parts.push(encodeNatural(operandTuple.gasLimit))

  // Result (variable length)
  if (typeof operandTuple.result === 'string') {
    // Error result
    const errorUint8Array = new TextEncoder().encode(operandTuple.result)
    const lengthEncoded = encodeNatural(BigInt(errorUint8Array.length))
    parts.push(lengthEncoded)
    parts.push(errorUint8Array)
  } else {
    // Success result (octet sequence)
    const lengthEncoded = encodeNatural(BigInt(operandTuple.result.length))
    parts.push(lengthEncoded)
    parts.push(operandTuple.result)
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
      gasLimit,
      result,
      authTrace,
    },
    remaining: currentData,
  }
}
