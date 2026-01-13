/**
 * Round-trip test for AccumulateInput encoding/decoding
 * 
 * Tests interoperability between TypeScript and AssemblyScript implementations:
 * 1. TypeScript encode -> AssemblyScript decode -> AssemblyScript encode -> TypeScript decode
 * 2. AssemblyScript encode -> TypeScript decode -> TypeScript encode -> AssemblyScript decode
 * 3. Jamduna test vector round-trip through both implementations
 */

import { instantiate } from './wasmAsInit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  encodeAccumulateInput,
  encodeVariableSequence,
  decodeAccumulateInput,
  decodeVariableSequence,
} from '@pbnjam/codec'
import { logger, hexToBytes, type Hex } from '@pbnjam/core'
import type { AccumulateInput, OperandTuple, DeferredTransfer } from '@pbnjam/types'

/**
 * Load WASM module
 */
async function loadWasmModule(): Promise<any> {
  const wasmPath = join(__dirname, '../build/debug.wasm')
  const wasmBytes = readFileSync(wasmPath)
  const wasmModule = await instantiate(wasmBytes)
  return wasmModule
}

/**
 * Create a test OperandTuple
 */
function createTestOperandTuple(index: number): OperandTuple {
  return {
    packageHash: `0x${(index + 1).toString(16).padStart(64, '0')}` as Hex,
    segmentRoot: `0x${(index + 2).toString(16).padStart(64, '0')}` as Hex,
    authorizer: `0x${(index + 3).toString(16).padStart(64, '0')}` as Hex,
    payloadHash: `0x${(index + 4).toString(16).padStart(64, '0')}` as Hex,
    gasLimit: BigInt(10000000 + index * 1000),
    result: new Uint8Array([0x01, 0x02, 0x03, 0x04, index]),
    authTrace: new Uint8Array([0xAA, 0xBB, 0xCC, index]),
  }
}

/**
 * Create a test DeferredTransfer
 */
function createTestDeferredTransfer(index: number): DeferredTransfer {
  // Memo must be exactly 128 bytes
  const memo = new Uint8Array(128)
  memo.fill(index + 1)
  memo[0] = 0xDE
  memo[1] = 0xAD
  memo[2] = 0xBE
  memo[3] = 0xEF
  
  return {
    source: BigInt(index + 1),
    dest: BigInt(index + 2),
    amount: BigInt(10000 * (index + 1)),
    memo,
    gasLimit: BigInt(1000 * (index + 1)),
  }
}

/**
 * Create test AccumulateInputs array
 */
function createTestAccumulateInputs(): AccumulateInput[] {
  return [
    // OperandTuple type (type = 0)
    {
      type: 0,
      value: createTestOperandTuple(1),
    },
    // Another OperandTuple
    {
      type: 0,
      value: createTestOperandTuple(2),
    },
    // DeferredTransfer type (type = 1)
    {
      type: 1,
      value: createTestDeferredTransfer(1),
    },
  ]
}

/**
 * Compare two OperandTuples for equality
 */
function compareOperandTuples(a: OperandTuple, b: OperandTuple): boolean {
  if (a.packageHash !== b.packageHash) {
    logger.error(`packageHash mismatch: ${a.packageHash} !== ${b.packageHash}`)
    return false
  }
  if (a.segmentRoot !== b.segmentRoot) {
    logger.error(`segmentRoot mismatch: ${a.segmentRoot} !== ${b.segmentRoot}`)
    return false
  }
  if (a.authorizer !== b.authorizer) {
    logger.error(`authorizer mismatch: ${a.authorizer} !== ${b.authorizer}`)
    return false
  }
  if (a.payloadHash !== b.payloadHash) {
    logger.error(`payloadHash mismatch: ${a.payloadHash} !== ${b.payloadHash}`)
    return false
  }
  if (a.gasLimit !== b.gasLimit) {
    logger.error(`gasLimit mismatch: ${a.gasLimit} !== ${b.gasLimit}`)
    return false
  }
  
  // Compare result
  const aResult = a.result as Uint8Array
  const bResult = b.result as Uint8Array
  if (aResult.length !== bResult.length) {
    logger.error(`result length mismatch: ${aResult.length} !== ${bResult.length}`)
    return false
  }
  for (let i = 0; i < aResult.length; i++) {
    if (aResult[i] !== bResult[i]) {
      logger.error(`result[${i}] mismatch: ${aResult[i]} !== ${bResult[i]}`)
      return false
    }
  }
  
  // Compare authTrace
  if (a.authTrace.length !== b.authTrace.length) {
    logger.error(`authTrace length mismatch: ${a.authTrace.length} !== ${b.authTrace.length}`)
    return false
  }
  for (let i = 0; i < a.authTrace.length; i++) {
    if (a.authTrace[i] !== b.authTrace[i]) {
      logger.error(`authTrace[${i}] mismatch: ${a.authTrace[i]} !== ${b.authTrace[i]}`)
      return false
    }
  }
  
  return true
}

/**
 * Compare two DeferredTransfers for equality
 */
function compareDeferredTransfers(a: DeferredTransfer, b: DeferredTransfer): boolean {
  if (a.source !== b.source) {
    logger.error(`source mismatch: ${a.source} !== ${b.source}`)
    return false
  }
  if (a.dest !== b.dest) {
    logger.error(`dest mismatch: ${a.dest} !== ${b.dest}`)
    return false
  }
  if (a.amount !== b.amount) {
    logger.error(`amount mismatch: ${a.amount} !== ${b.amount}`)
    return false
  }
  if (a.gasLimit !== b.gasLimit) {
    logger.error(`gasLimit mismatch: ${a.gasLimit} !== ${b.gasLimit}`)
    return false
  }
  
  // Compare memo (128 bytes)
  if (a.memo.length !== b.memo.length) {
    logger.error(`memo length mismatch: ${a.memo.length} !== ${b.memo.length}`)
    return false
  }
  for (let i = 0; i < a.memo.length; i++) {
    if (a.memo[i] !== b.memo[i]) {
      logger.error(`memo[${i}] mismatch: ${a.memo[i]} !== ${b.memo[i]}`)
      return false
    }
  }
  
  return true
}

/**
 * Compare two AccumulateInputs for equality
 */
function compareAccumulateInput(a: AccumulateInput, b: AccumulateInput): boolean {
  if (a.type !== b.type) {
    logger.error(`type mismatch: ${a.type} !== ${b.type}`)
    return false
  }
  
  if (a.type === 0) {
    return compareOperandTuples(a.value as OperandTuple, b.value as OperandTuple)
  } else if (a.type === 1) {
    return compareDeferredTransfers(a.value as DeferredTransfer, b.value as DeferredTransfer)
  }
  
  logger.error(`Unknown type: ${a.type}`)
  return false
}

/**
 * Compare two AccumulateInput arrays for equality
 */
function compareAccumulateInputArrays(a: AccumulateInput[], b: AccumulateInput[]): boolean {
  if (a.length !== b.length) {
    logger.error(`Array length mismatch: ${a.length} !== ${b.length}`)
    return false
  }
  
  for (let i = 0; i < a.length; i++) {
    if (!compareAccumulateInput(a[i], b[i])) {
      logger.error(`AccumulateInput[${i}] mismatch`)
      return false
    }
  }
  
  return true
}

/**
 * Test: TypeScript encode -> AssemblyScript decode -> AssemblyScript encode -> TypeScript decode
 */
async function testTypeScriptToAssemblyScriptRoundTrip(): Promise<boolean> {
  logger.info('Testing TypeScript -> AssemblyScript AccumulateInputs round-trip')
  
  const wasm = await loadWasmModule()
  
  // Create test AccumulateInputs
  const original = createTestAccumulateInputs()
  
  // Step 1: Encode with TypeScript
  const [encodeError, encoded] = encodeVariableSequence(original, encodeAccumulateInput)
  if (encodeError) {
    logger.error('TypeScript encode failed:', encodeError)
    return false
  }
  
  logger.info(`TypeScript encoded ${encoded.length} bytes`)
  
  // Step 2: Round-trip with AssemblyScript (decode then encode)
  const asDecoded = wasm.roundTripAccumulateInputs(encoded)
  
  if (asDecoded.length === 0) {
    logger.error('AssemblyScript decode failed (returned empty array)')
    return false
  }
  
  logger.info(`AssemblyScript decoded and re-encoded ${asDecoded.length} bytes`)
  
  // Step 3: Decode with TypeScript
  const [decodeError, decodeResult] = decodeVariableSequence(asDecoded, decodeAccumulateInput)
  if (decodeError) {
    logger.error('TypeScript decode failed:', decodeError)
    return false
  }
  
  const final = decodeResult.value
  
  // Step 4: Compare
  if (!compareAccumulateInputArrays(original, final)) {
    logger.error('Round-trip failed: AccumulateInputs do not match')
    return false
  }
  
  logger.info('✅ TypeScript -> AssemblyScript AccumulateInputs round-trip passed')
  return true
}

/**
 * Test: AssemblyScript encode -> TypeScript decode -> TypeScript encode -> AssemblyScript decode
 */
async function testAssemblyScriptToTypeScriptRoundTrip(): Promise<boolean> {
  logger.info('Testing AssemblyScript -> TypeScript AccumulateInputs round-trip')
  
  const wasm = await loadWasmModule()
  
  // Create test AccumulateInputs
  const original = createTestAccumulateInputs()
  
  // Step 1: Encode with TypeScript first (to get valid bytes)
  const [encodeError, tsEncoded] = encodeVariableSequence(original, encodeAccumulateInput)
  if (encodeError) {
    logger.error('TypeScript encode failed:', encodeError)
    return false
  }
  
  // Step 2: Round-trip with AssemblyScript (decode then encode)
  const asEncoded = wasm.roundTripAccumulateInputs(tsEncoded)
  
  if (asEncoded.length === 0) {
    logger.error('AssemblyScript encode failed (returned empty array)')
    return false
  }
  
  logger.info(`AssemblyScript encoded ${asEncoded.length} bytes`)
  
  // Step 3: Decode with TypeScript
  const [decodeError, decodeResult] = decodeVariableSequence(asEncoded, decodeAccumulateInput)
  if (decodeError) {
    logger.error('TypeScript decode failed:', decodeError)
    return false
  }
  
  const decoded = decodeResult.value
  
  // Step 4: Re-encode with TypeScript
  const [reEncodeError, reEncoded] = encodeVariableSequence(decoded, encodeAccumulateInput)
  if (reEncodeError) {
    logger.error('TypeScript re-encode failed:', reEncodeError)
    return false
  }
  
  // Step 5: Round-trip with AssemblyScript (decode then encode)
  const asDecoded = wasm.roundTripAccumulateInputs(reEncoded)
  
  if (asDecoded.length === 0) {
    logger.error('AssemblyScript final decode failed (returned empty array)')
    return false
  }
  
  // Step 6: Final decode with TypeScript and compare
  const [finalDecodeError, finalDecodeResult] = decodeVariableSequence(asDecoded, decodeAccumulateInput)
  if (finalDecodeError) {
    logger.error('TypeScript final decode failed:', finalDecodeError)
    return false
  }
  
  const final = finalDecodeResult.value
  
  // Step 7: Compare
  if (!compareAccumulateInputArrays(original, final)) {
    logger.error('Round-trip failed: AccumulateInputs do not match')
    return false
  }
  
  logger.info('✅ AssemblyScript -> TypeScript AccumulateInputs round-trip passed')
  return true
}

/**
 * Test: Jamduna test vector round-trip
 * Uses the 179-byte accumulate_input from jamduna test vectors
 */
async function testJamdunaTestVectorRoundTrip(): Promise<boolean> {
  logger.info('Testing Jamduna test vector AccumulateInputs round-trip')
  
  const wasm = await loadWasmModule()
  
  // The 179-byte hex from jamduna test vectors
  const expectedHex = '0x010025d8314884a4162787493635f1da182a6fbc7b31b55c18ce74ea1369a7999f4500000000000000000000000000000000000000000000000000000000000000002357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8b5fd156d32aa8f25a91c80449f4e3bba4ea1e54aa9855b2ff53c32e42e7bc02de0809698002a0106f5d8957422098a7b2f007db98bce1bcf51c34311ab19671e7f5dcaadf54e0d9f370000000000000000'
  const expectedBytes = hexToBytes(expectedHex)
  
  logger.info(`Jamduna test vector: ${expectedBytes.length} bytes`)
  
  // Step 1: Decode with TypeScript
  const [decodeError, decodeResult] = decodeVariableSequence(expectedBytes, decodeAccumulateInput)
  if (decodeError) {
    logger.error('TypeScript decode of jamduna vector failed:', decodeError)
    return false
  }
  
  const tsDecoded = decodeResult.value
  logger.info(`TypeScript decoded ${tsDecoded.length} AccumulateInputs`)
  
  // Step 2: Round-trip through AssemblyScript
  const asRoundTripped = wasm.roundTripAccumulateInputs(expectedBytes)
  
  if (asRoundTripped.length === 0) {
    logger.error('AssemblyScript round-trip of jamduna vector failed (returned empty array)')
    return false
  }
  
  logger.info(`AssemblyScript round-tripped ${asRoundTripped.length} bytes`)
  
  // Step 3: Decode AssemblyScript result with TypeScript
  const [asDecodeError, asDecodeResult] = decodeVariableSequence(asRoundTripped, decodeAccumulateInput)
  if (asDecodeError) {
    logger.error('TypeScript decode of AS round-tripped vector failed:', asDecodeError)
    return false
  }
  
  const asDecoded = asDecodeResult.value
  
  // Step 4: Compare TS decoded vs AS round-tripped decoded
  if (!compareAccumulateInputArrays(tsDecoded, asDecoded)) {
    logger.error('Jamduna test vector round-trip failed: results do not match')
    return false
  }
  
  // Step 5: Verify specific fields from the 179-byte vector
  if (tsDecoded.length !== 1) {
    logger.error(`Expected 1 AccumulateInput, got ${tsDecoded.length}`)
    return false
  }
  
  const input = tsDecoded[0]
  if (input.type !== 0) {
    logger.error(`Expected type 0 (OperandTuple), got ${input.type}`)
    return false
  }

  const ot = input.value as OperandTuple
  if (ot.gasLimit !== BigInt(10000000)) {
    logger.error(`Expected gasLimit 10000000n, got ${ot.gasLimit}`)
    return false
  }
  
  if (ot.packageHash !== '0x25d8314884a4162787493635f1da182a6fbc7b31b55c18ce74ea1369a7999f45') {
    logger.error(`packageHash mismatch: ${ot.packageHash}`)
    return false
  }
  
  logger.info('✅ Jamduna test vector AccumulateInputs round-trip passed')
  return true
}

import { describe, it, expect } from 'bun:test'

/**
 * Run all round-trip tests using Bun's test framework
 */
describe('AccumulateInput Round-Trip Tests', () => {
  it('should pass TypeScript -> AssemblyScript round-trip', async () => {
    logger.info('Testing TypeScript -> AssemblyScript round-trip')
    const result = await testTypeScriptToAssemblyScriptRoundTrip()
    expect(result).toBe(true)
  })

  it('should pass AssemblyScript -> TypeScript round-trip', async () => {
    logger.info('Testing AssemblyScript -> TypeScript round-trip')
    const result = await testAssemblyScriptToTypeScriptRoundTrip()
    expect(result).toBe(true)
  })

  it('should pass Jamduna test vector round-trip', async () => {
    logger.info('Testing Jamduna test vector round-trip')
    const result = await testJamdunaTestVectorRoundTrip()
    expect(result).toBe(true)
  })
})

export { testTypeScriptToAssemblyScriptRoundTrip, testAssemblyScriptToTypeScriptRoundTrip, testJamdunaTestVectorRoundTrip }

