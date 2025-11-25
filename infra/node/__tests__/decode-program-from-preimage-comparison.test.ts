import { describe, test, expect, beforeEach } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { instantiate } from '../../../packages/pvm-assemblyscript/tests/wasmAsInit'
import { decodeProgramFromPreimage } from '@pbnj/codec'
import { logger, hexToBytes } from '@pbnj/core'
import type { Hex } from 'viem'

const WORKSPACE_ROOT = process.cwd().includes('/packages/pvm')
  ? process.cwd().split('/packages/pvm')[0]
  : process.cwd()

describe('decodeProgramFromPreimage Comparison', () => {
  let wasm: any

  beforeEach(async () => {
    // Load and initialize WASM module
    const wasmPath = join(WORKSPACE_ROOT, 'packages', 'pvm-assemblyscript', 'build', 'debug.wasm')
    const wasmBytes = readFileSync(wasmPath)
    wasm = await instantiate(wasmBytes, {})
    
    // Initialize PVM with PVMRAM
    wasm.init(wasm.RAMType.PVMRAM)
  })

  test('should decode preimage the same way in TypeScript and AssemblyScript', async () => {
    // Load test vector data (same as accumulate-wasm.test.ts)
    const testVectorPath = join(
      WORKSPACE_ROOT,
      'submodules',
      'jam-test-vectors',
      'stf',
      'accumulate',
      'tiny',
      'accumulate_ready_queued_reports-1.json',
    )
    const testVector = JSON.parse(readFileSync(testVectorPath, 'utf-8'))
    
    // Find service account (ID 1729) and get preimage blob
    const serviceAccount = testVector.pre_state.accounts.find(
      (acc: any) => acc.id === 1729
    )
    
    if (!serviceAccount) {
      throw new Error('Service account 1729 not found in test vector')
    }
    
    const codeHash = serviceAccount.data.service.code_hash as Hex
    
    // Find the preimage blob with the matching code hash
    const preimageEntry = serviceAccount.data.preimages_blob.find(
      (entry: any) => entry.hash === codeHash
    )
    
    if (!preimageEntry) {
      throw new Error(`Preimage not found for code hash ${codeHash}`)
    }
    
    const preimageBlob = hexToBytes(preimageEntry.blob as Hex)
    
    logger.info('Testing decodeProgramFromPreimage comparison', {
      preimageLength: preimageBlob.length,
    })

    // Decode with TypeScript
    const [tsError, tsResult] = decodeProgramFromPreimage(preimageBlob)
    if (tsError) {
      throw new Error(`TypeScript decode failed: ${tsError.message}`)
    }
    const tsDecoded = tsResult.value

    // Decode with AssemblyScript (via WASM) - getDecodedProgramFields does the decode internally
    const asFields = wasm.getDecodedProgramFields(preimageBlob)
    if (!asFields) {
      throw new Error('AssemblyScript decode returned null')
    }

    // Compare metadata
    const tsMetadata = tsDecoded.metadata
    const asMetadata = asFields.metadata
    
    logger.info('Metadata comparison', {
      tsLength: tsMetadata.length,
      asLength: asMetadata.length,
      match: tsMetadata.length === asMetadata.length && 
             tsMetadata.every((b, i) => b === asMetadata[i]),
    })

    expect(asMetadata.length).toBe(tsMetadata.length)
    expect(Array.from(asMetadata)).toEqual(Array.from(tsMetadata))

    // Compare roDataLength
    const tsRoDataLength = tsDecoded.roDataLength
    const asRoDataLength = asFields.roDataLength
    
    logger.info('roDataLength comparison', {
      ts: tsRoDataLength,
      as: asRoDataLength,
      match: tsRoDataLength === asRoDataLength,
    })

    expect(asRoDataLength).toBe(tsRoDataLength)

    // Compare rwDataLength
    const tsRwDataLength = tsDecoded.rwDataLength
    const asRwDataLength = asFields.rwDataLength
    
    logger.info('rwDataLength comparison', {
      ts: tsRwDataLength,
      as: asRwDataLength,
      match: tsRwDataLength === asRwDataLength,
    })

    expect(asRwDataLength).toBe(tsRwDataLength)

    // Compare heapZeroPaddingSize
    const tsHeapZeroPaddingSize = tsDecoded.heapZeroPaddingSize
    const asHeapZeroPaddingSize = asFields.heapZeroPaddingSize
    
    logger.info('heapZeroPaddingSize comparison', {
      ts: tsHeapZeroPaddingSize,
      as: asHeapZeroPaddingSize,
      match: tsHeapZeroPaddingSize === asHeapZeroPaddingSize,
    })

    expect(asHeapZeroPaddingSize).toBe(tsHeapZeroPaddingSize)

    // Compare stackSize
    const tsStackSize = tsDecoded.stackSize
    const asStackSize = asFields.stackSize
    
    logger.info('stackSize comparison', {
      ts: tsStackSize,
      as: asStackSize,
      match: tsStackSize === asStackSize,
    })

    expect(asStackSize).toBe(tsStackSize)

    // Compare roData
    const tsRoData = tsDecoded.roData
    const asRoData = asFields.roData
    
    logger.info('roData comparison', {
      tsLength: tsRoData.length,
      asLength: asRoData.length,
      match: tsRoData.length === asRoData.length && 
             tsRoData.every((b, i) => b === asRoData[i]),
    })

    expect(asRoData.length).toBe(tsRoData.length)
    expect(Array.from(asRoData)).toEqual(Array.from(tsRoData))

    // Compare rwData
    const tsRwData = tsDecoded.rwData
    const asRwData = asFields.rwData
    
    logger.info('rwData comparison', {
      tsLength: tsRwData.length,
      asLength: asRwData.length,
      match: tsRwData.length === asRwData.length && 
             tsRwData.every((b, i) => b === asRwData[i]),
    })

    expect(asRwData.length).toBe(tsRwData.length)
    expect(Array.from(asRwData)).toEqual(Array.from(tsRwData))

    // Compare codeSize
    const tsCodeSize = tsDecoded.codeSize
    const asCodeSize = asFields.codeSize
    
    logger.info('codeSize comparison', {
      ts: tsCodeSize,
      as: asCodeSize,
      match: tsCodeSize === asCodeSize,
    })

    expect(asCodeSize).toBe(tsCodeSize)

    // Compare code
    const tsCode = tsDecoded.code
    const asCode = asFields.code
    
    logger.info('code comparison', {
      tsLength: tsCode.length,
      asLength: asCode.length,
      match: tsCode.length === asCode.length && 
             tsCode.every((b, i) => b === asCode[i]),
    })

    expect(asCode.length).toBe(tsCode.length)
    expect(Array.from(asCode)).toEqual(Array.from(tsCode))

    logger.info('✅ All fields match between TypeScript and AssemblyScript')
  })
})

