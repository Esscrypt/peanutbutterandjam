/**
 * Accumulation WASM Test
 * 
 * This test loads the bytecode from accumulate_ready_queued_reports-1.json
 * and executes a single accumulation using the WASM PVM implementation
 */

import { logger, hexToBytes, blake2bHash, bytesToHex } from '@pbnjam/core'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { type PartialState, type ServiceAccount, type ImplicationsPair, type Implications } from '@pbnjam/types'
import { ConfigService } from '../services/config-service'
import { encodeImplicationsPair, decodeImplicationsPair } from '@pbnjam/codec'
import { decodeProgramFromPreimage } from '@pbnjam/codec'
import { describe, expect, beforeEach, test } from 'bun:test'
import type { Hex } from 'viem'
import { instantiate } from '@pbnjam/pvm-assemblyscript/wasmAsInit'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PVMParser, InstructionRegistry } from '@pbnjam/pvm'

const WORKSPACE_ROOT = process.cwd().includes('/packages/pvm')
  ? process.cwd().split('/packages/pvm')[0]
  : process.cwd()

const TEST_VECTOR_PATH = path.join(
  WORKSPACE_ROOT,
  'submodules',
  'jam-test-vectors',
  'stf',
  'accumulate',
  'tiny',
  'accumulate_ready_queued_reports-1.json'
)

interface TestVectorData {
  codeHash: Hex
  preimageBlob: Uint8Array
  payload: Uint8Array
  expectedGasUsed: number
  serviceBalance: bigint
  minItemGas: bigint
  minMemoGas: bigint
}

/**
 * Load service code and test data from the test vector
 */
function loadTestVectorData(): TestVectorData {
  // Read the test vector file
  const testVectorContent = fs.readFileSync(TEST_VECTOR_PATH, 'utf-8')
  const testVector = JSON.parse(testVectorContent)
  
  // Find service account (ID 1729)
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
  
  // Get the first work report from the ready queue to extract payload
  const firstQueueItem = testVector.pre_state.ready_queue[0][0]
  const payloadHash = firstQueueItem.report.results[0].payload_hash as Hex
  
  // The test vector shows the expected gas used in post_state.statistics
  const expectedStats = testVector.post_state.statistics.find(
    (stat: any) => stat.id === 1729
  )
  const expectedGasUsed = expectedStats?.record?.accumulate_gas_used || 0
  
  // Get one of the payloads from the report results
  const payload = hexToBytes(payloadHash)
  
  logger.info('Loaded test vector data', {
    codeHash,
    preimageLength: preimageBlob.length,
    payloadLength: payload.length,
    expectedGasUsed,
    serviceBalance: serviceAccount.data.service.balance,
  })
  
  return {
    codeHash,
    preimageBlob,
    payload,
    expectedGasUsed,
    serviceBalance: BigInt(serviceAccount.data.service.balance),
    minItemGas: BigInt(serviceAccount.data.service.min_item_gas),
    minMemoGas: BigInt(serviceAccount.data.service.min_memo_gas),
  }
}

/**
 * Encode accumulate arguments according to Gray Paper
 * encode{t, s, len(i)} where:
 * - t: timeslot (4 bytes)
 * - s: serviceId (4 bytes)
 * - len(i): input length (4 bytes)
 */
function encodeAccumulateArgs(timeslot: bigint, serviceId: bigint, inputLength: bigint): Uint8Array {
  const parts: Uint8Array[] = []
  
  // encode[4]{timeslot}
  const timeslotBytes = new Uint8Array(4)
  const timeslotView = new DataView(timeslotBytes.buffer)
  timeslotView.setUint32(0, Number(timeslot), true)
  parts.push(timeslotBytes)
  
  // encode[4]{serviceId}
  const serviceIdBytes = new Uint8Array(4)
  const serviceIdView = new DataView(serviceIdBytes.buffer)
  serviceIdView.setUint32(0, Number(serviceId), true)
  parts.push(serviceIdBytes)
  
  // encode[4]{inputLength}
  const inputLengthBytes = new Uint8Array(4)
  const inputLengthView = new DataView(inputLengthBytes.buffer)
  inputLengthView.setUint32(0, Number(inputLength), true)
  parts.push(inputLengthBytes)
  
  return new Uint8Array(Buffer.concat(parts))
}

describe('Accumulation WASM Tests', () => {
  let configService: ConfigService
  let testData: TestVectorData
  let wasm: any

  beforeEach(async () => {
    configService = new ConfigService('tiny')
    
    // Load test data
    testData = loadTestVectorData()
    
    // Load and initialize WASM module
    const wasmPath = join(WORKSPACE_ROOT, 'packages', 'pvm-assemblyscript', 'build', 'debug.wasm')
    const wasmBytes = readFileSync(wasmPath)
    wasm = await instantiate(wasmBytes, {})
    
    // Initialize PVM with PVMRAM
    wasm.init(wasm.RAMType.PVMRAM)
  })

  test('should execute accumulation invocation on WASM', async () => {
    const { codeHash, preimageBlob, payload, expectedGasUsed, serviceBalance, minItemGas, minMemoGas } = testData

    // Verify code hash
    const [hashError, calculatedCodeHash] = blake2bHash(preimageBlob)
    if (hashError || !calculatedCodeHash) {
      throw new Error('Failed to calculate code hash')
    }
    expect(calculatedCodeHash).toBe(codeHash)

    // Decode preimage to get program blob
    const [decodeError, decodedPreimage] = decodeProgramFromPreimage(preimageBlob)
    if (decodeError || !decodedPreimage) {
      throw new Error(`Failed to decode preimage: ${decodeError?.message}`)
    }

    logger.info('Preimage decoded', {
      codeLength: decodedPreimage.value.code.length,
      roDataLength: decodedPreimage.value.roDataLength,
      rwDataLength: decodedPreimage.value.rwDataLength,
    })

    // Create minimal partial state with our service
    const serviceId = 1729n
    const preimages = new Map([[codeHash, preimageBlob]])
    
    // Create stagingset with correct number of validators (6 for tiny config)
    const numValidators = configService.numValidators
    const stagingset: Uint8Array[] = []
    for (let i = 0; i < numValidators; i++) {
      // Create a 336-byte validator key (Bandersnatch + Ed25519 + BLS + Metadata)
      const validatorKey = new Uint8Array(336)
      validatorKey.fill(0) // Zero-filled for now
      stagingset.push(validatorKey)
    }
    
    // Create authqueue with correct number of cores
    const numCores = configService.numCores
    const authQueueSize = 80
    const authqueue: Uint8Array[][] = []
    for (let i = 0; i < numCores; i++) {
      authqueue.push(new Array(authQueueSize).fill(null).map(() => new Uint8Array(32)))
    }
    
    // Create assigners
    const assigners: bigint[] = []
    for (let i = 0; i < numCores; i++) {
      assigners.push(0n)
    }
    
    const partialState: PartialState = {
      accounts: new Map([
        [
          serviceId,
          {
            codehash: codeHash,
            balance: serviceBalance,
            minaccgas: minItemGas,
            minmemogas: minMemoGas,
            octets: BigInt(preimageBlob.length),
            gratis: 0n,
            items: 2n,
            created: 0n,
            lastacc: 0n,
            parent: 0n,
            preimages: preimages,
            requests: new Map(),
            storage: new Map(),
          } as ServiceAccount,
        ],
      ]),
      authqueue,
      assigners,
      stagingset,
      manager: 0n,
      registrar: 0n,
      delegator: 0n,
      alwaysaccers: new Map(),
    }

    // Create initial implications pair
    const initialImplications: Implications = {
      id: serviceId,
      state: partialState,
      nextfreeid: serviceId + 1n,
      xfers: [],
      yield: null,
      provisions: new Map(),
    }

    const implicationsPair: ImplicationsPair = [initialImplications, initialImplications]

    // Encode implications pair for context
    const [contextError, encodedContext] = encodeImplicationsPair(implicationsPair, configService)
    if (contextError || !encodedContext) {
      throw new Error(`Failed to encode context: ${contextError?.message}`)
    }

    // Encode accumulate arguments
    const timeslot = 43n
    const inputLength = 1n
    const encodedArgs = encodeAccumulateArgs(timeslot, serviceId, inputLength)

    // Set gas limit
    const gasLimit = 100000

    // Deep log context before call
    logger.info('Context BEFORE accumulateInvocation', {
      serviceId: serviceId.toString(),
      timeslot: timeslot.toString(),
      gasLimit,
      preimageLength: preimageBlob.length,
      codeLength: decodedPreimage.value.code.length,
      contextLength: encodedContext.length,
      argsLength: encodedArgs.length,
      contextHex: bytesToHex(encodedContext).slice(0, 200) + '...',
      argsHex: bytesToHex(encodedArgs),
      initialImplications: {
        id: initialImplications.id.toString(),
        nextfreeid: initialImplications.nextfreeid.toString(),
        stateAccountsSize: initialImplications.state.accounts.size,
        xfersLength: initialImplications.xfers.length,
        yield: initialImplications.yield ? bytesToHex(initialImplications.yield) : null,
        provisionsSize: initialImplications.provisions.size,
      },
    })

    // Decode context to verify it's correct
    const [beforeDecodeError, beforeDecoded] = decodeImplicationsPair(encodedContext, configService)
    if (beforeDecodeError || !beforeDecoded) {
      logger.error('Failed to decode context before call', { error: beforeDecodeError?.message })
    } else {
      logger.info('Context decoded successfully before call', {
        regularId: beforeDecoded.value[0].id.toString(),
        regularAccountsSize: beforeDecoded.value[0].state.accounts.size,
        regularXfersLength: beforeDecoded.value[0].xfers.length,
        regularYield: beforeDecoded.value[0].yield ? bytesToHex(beforeDecoded.value[0].yield) : null,
      })
    }

    // Get registers BEFORE accumulateInvocation
    const registersBefore = wasm.getRegisters()
    const registerViewBefore = new DataView(registersBefore.buffer)
    const decodedRegistersBefore: bigint[] = []
    for (let j = 0; j < 13; j++) {
      decodedRegistersBefore[j] = registerViewBefore.getBigUint64(j * 8, true)
    }
    
    logger.info('Registers BEFORE accumulateInvocation', {
      r0: decodedRegistersBefore[0].toString(),
      r1: decodedRegistersBefore[1].toString(),
      r2: decodedRegistersBefore[2].toString(),
      r3: decodedRegistersBefore[3].toString(),
      r4: decodedRegistersBefore[4].toString(),
      r5: decodedRegistersBefore[5].toString(),
      r6: decodedRegistersBefore[6].toString(),
      r7: decodedRegistersBefore[7].toString(),
      r8: decodedRegistersBefore[8].toString(),
      r9: decodedRegistersBefore[9].toString(),
      r10: decodedRegistersBefore[10].toString(),
      r11: decodedRegistersBefore[11].toString(),
      r12: decodedRegistersBefore[12].toString(),
    })

    // Verify WASM function exists
    if (typeof wasm.accumulateInvocation !== 'function') {
      throw new Error('accumulateInvocation is not a function in WASM exports')
    }
    
    logger.info('About to call accumulateInvocation', {
      gasLimit,
      preimageBlobLength: preimageBlob.length,
      encodedArgsLength: encodedArgs.length,
      encodedContextLength: encodedContext.length,
      wasmFunctionExists: typeof wasm.accumulateInvocation === 'function',
    })
    
    // Get config values to pass to accumulateInvocation (already declared above for PartialState creation)
    logger.info('Calling accumulateInvocation with config', {
      numCores,
      numValidators,
      authQueueSize,
    })
    
    // Parse program to get instruction info for execution logs
    const codeBlob = decodedPreimage.value.code
    const parser = new PVMParser()
    const registry = new InstructionRegistry()
    const parseResult = parser.parseProgram(codeBlob)
    
    // Create instruction lookup by PC
    const instructionMap = new Map<number, { name: string; opcode: string; operands: number[] }>()
    if (parseResult.success) {
      for (const inst of parseResult.instructions) {
        const pc = Number(inst.pc)
        const handler = registry.getHandler(inst.opcode)
        instructionMap.set(pc, {
          name: handler?.name || `UNKNOWN_${inst.opcode}`,
          opcode: `0x${inst.opcode.toString(16)}`,
          operands: Array.from(inst.operands),
        })
      }
    }

    // Status map for execution logs
    const statusMap: Record<number, string> = {
      0: 'ok',
      1: 'halt',
      2: 'panic',
      3: 'page-fault',
      4: 'host',
      5: 'out-of-gas',
    }

    // Helper to decode registers
    const decodeRegisters = (registers: Uint8Array): Record<string, string> => {
      const view = new DataView(registers.buffer)
      const result: Record<string, string> = {}
      for (let i = 0; i < 13; i++) {
        const value = view.getBigUint64(i * 8, true)
        result[`r${i}`] = value.toString()
      }
      return result
    }

    // Set up accumulation invocation without running to completion
    // This allows us to step through execution and log each step
    const executionStartTime = performance.now()
    let result: any = {
      gasConsumed: 0,
      result: { resultType: 1, data: new Uint8Array(0) },
      encodedContext: encodedContext,
    }
    
    // Execute step-by-step and collect execution logs
    // Declare executionTrace outside try block so it's accessible in catch/failure dump
    let executionTrace: Array<{
      step: number
      pc: number
      instructionName: string
      opcode: string
      operands: number[]
      registersBefore: Record<string, string>
      registersAfter: Record<string, string>
      gas: number
      status: string
    }> = []
    
    try {
      wasm.setupAccumulateInvocation(gasLimit, preimageBlob, encodedArgs, encodedContext, numCores, numValidators, authQueueSize)
      
      // Verify initial state after setup
      const initialPC = wasm.getProgramCounter()
      const initialGas = wasm.getGasLeft()
      const initialStatus = wasm.getStatus()
      
      logger.info('Initial state after setupAccumulateInvocation', {
        pc: initialPC,
        gas: initialGas,
        status: statusMap[initialStatus] || 'unknown',
      })

      let step = 0
      const maxSteps = 10000
      let lastPC = initialPC

      while (step < maxSteps) {
        const pcBefore = wasm.getProgramCounter()
        const gasBefore = wasm.getGasLeft()
        const statusBefore = wasm.getStatus()
        const registersBefore = wasm.getRegisters()
        
        const instInfo = instructionMap.get(pcBefore) || {
          name: 'UNKNOWN',
          opcode: '0x0',
          operands: [],
        }

        // Execute one step
        const shouldContinue = wasm.nextStep()
        
        const pcAfter = wasm.getProgramCounter()
        const gasAfter = wasm.getGasLeft()
        const statusAfter = wasm.getStatus()
        const registersAfter = wasm.getRegisters()

        // Record step
        executionTrace.push({
          step: step + 1,
          pc: pcBefore,
          instructionName: instInfo.name,
          opcode: instInfo.opcode,
          operands: instInfo.operands,
          registersBefore: decodeRegisters(registersBefore),
          registersAfter: decodeRegisters(registersAfter),
          gas: Number(gasAfter),
          status: statusMap[statusAfter] || 'unknown',
        })

        // Log every 100 steps for progress
        if ((step + 1) % 100 === 0) {
          logger.info(`Step ${step + 1}`, {
            pc: pcAfter,
            gas: gasAfter,
            status: statusMap[statusAfter] || 'unknown',
          })
        }

        // Check if execution should stop
        if (!shouldContinue || statusAfter !== 0) {
          logger.info('Execution stopped', {
            step: step + 1,
            shouldContinue,
            status: statusMap[statusAfter] || 'unknown',
          })
          break
        }

        // Safety check
        if (pcAfter === lastPC && statusAfter === 0) {
          logger.warn(`PC did not advance at step ${step + 1}, stopping execution`)
          break
        }

        lastPC = pcAfter
        step++
      }

      // Get final state
      const finalPC = wasm.getProgramCounter()
      const finalGas = wasm.getGasLeft()
      const finalStatus = wasm.getStatus()
      const gasConsumed = gasLimit - finalGas

      logger.info('Step-by-step execution completed', {
        totalSteps: step,
        finalPC,
        finalGas,
        gasConsumed,
        finalStatus: statusMap[finalStatus] || 'unknown',
      })

      // Create execution log dump
      const executionLog = {
        timestamp: new Date().toISOString(),
        testVector: 'accumulate_ready_queued_reports-1',
        setup: {
          serviceId: serviceId.toString(),
          timeslot: timeslot.toString(),
          gasLimit,
          preimageLength: preimageBlob.length,
          codeLength: codeBlob.length,
          contextLength: encodedContext.length,
          argsLength: encodedArgs.length,
        },
        execution: {
          totalSteps: step,
          finalPC,
          finalGas,
          gasConsumed,
          finalStatus: statusMap[finalStatus] || 'unknown',
          executionTrace,
        },
      }

      // Save execution log to file
      const logDir = join(WORKSPACE_ROOT, 'infra', 'node', '__tests__', 'accumulate-execution-logs')
      mkdirSync(logDir, { recursive: true })
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `accumulate-execution-${timestamp}.json`
      const filepath = join(logDir, filename)
      
      writeFileSync(
        filepath,
        JSON.stringify(executionLog, (_key, value) => {
          if (typeof value === 'bigint') {
            return value.toString()
          }
          return value
        }, 2),
        'utf-8',
      )

      logger.info(`Execution log saved to: ${filepath}`)

      // Save instructions to separate file with deterministic name
      if (parseResult.success) {
        const instructionsDir = join(WORKSPACE_ROOT, 'infra', 'node', '__tests__', 'accumulate-failure-dumps')
        mkdirSync(instructionsDir, { recursive: true })
        
        // Use deterministic filename based on test vector name
        const instructionsFilename = 'accumulate-instructions.json'
        const instructionsFilepath = join(instructionsDir, instructionsFilename)
        
        // Only write if file doesn't exist
        if (!existsSync(instructionsFilepath)) {
          const instructionsDump = {
            timestamp: new Date().toISOString(),
            testVector: 'accumulate_ready_queued_reports-1',
            testName: 'accumulate-wasm',
            instructions: parseResult.instructions.map((inst, index) => {
              const handler = registry.getHandler(inst.opcode)
              return {
                index,
                pc: inst.pc.toString(),
                pcHex: `0x${inst.pc.toString(16)}`,
                instructionName: handler?.name || `UNKNOWN_${inst.opcode}`,
                operands: Array.from(inst.operands).map(b => `0x${b.toString(16).padStart(2, '0')}`),
                fskip: inst.fskip,
              }
            }),
            jumpTable: parseResult.jumpTable.map((target, index) => ({
              index,
              target: target.toString(),
              targetHex: `0x${target.toString(16)}`,
            })),
          }
          
          writeFileSync(
            instructionsFilepath,
            JSON.stringify(
              instructionsDump,
              (_key, value) => {
                if (typeof value === 'bigint') {
                  return value.toString()
                }
                return value
              },
              2,
            ),
            'utf-8',
          )
          
          logger.info(`Instructions dump saved to: ${instructionsFilepath}`)
        } else {
          logger.info(`Instructions dump already exists, skipping: ${instructionsFilepath}`)
        }
      }

      // Now get the final result by encoding the context
      // Note: We need to get the updated context from WASM, but accumulateInvocation clears it
      // For now, we'll use the execution trace to determine the result
      result = {
        gasConsumed,
        result: {
          resultType: finalStatus === 0 ? 0 : finalStatus === 2 ? 1 : finalStatus === 5 ? 2 : 1,
          data: new Uint8Array(0),
        },
        encodedContext: encodedContext, // Use original context for now
      }
      
      // Check if there was a WASM error even if no exception was thrown
      const wasmError = wasm.getLastWasmError?.()
      if (wasmError) {
        logger.warn('WASM error detected after execution', {
          message: wasmError.message,
          fileName: wasmError.fileName,
          lineNumber: wasmError.lineNumber,
          columnNumber: wasmError.columnNumber,
          timestamp: wasmError.timestamp,
        })
      }
    } catch (error) {
      // Log detailed error information including WASM error details if available
      const errorDetails: any = {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
      
      // Check for WASM error details in the error object
      if (error && typeof error === 'object') {
        if ('wasmError' in error) {
          errorDetails.wasmError = (error as any).wasmError
        }
        if ('wasmErrorDetails' in error) {
          errorDetails.wasmErrorDetails = (error as any).wasmErrorDetails
        }
        if ('wasmFileName' in error) {
          errorDetails.wasmFileName = (error as any).wasmFileName
          errorDetails.wasmLineNumber = (error as any).wasmLineNumber
          errorDetails.wasmColumnNumber = (error as any).wasmColumnNumber
        }
      }
      
      // Also try to get error from WASM module if available
      try {
        const wasmError = wasm.getLastWasmError?.()
        if (wasmError) {
          errorDetails.lastWasmError = wasmError
        }
      } catch {
        // Ignore if getLastWasmError doesn't exist
      }
      
      logger.error('accumulateInvocation threw an error', errorDetails)
      throw error
    }
    const executionEndTime = performance.now()
    
    logger.info('accumulateInvocation returned', {
      duration: `${(executionEndTime - executionStartTime).toFixed(2)}ms`,
    })
    
    // Get registers AFTER accumulateInvocation
    const registersAfter = wasm.getRegisters()
    const registerViewAfter = new DataView(registersAfter.buffer)
    const decodedRegistersAfter: bigint[] = []
    for (let j = 0; j < 13; j++) {
      decodedRegistersAfter[j] = registerViewAfter.getBigUint64(j * 8, true)
    }
    
    logger.info('Registers AFTER accumulateInvocation', {
      r0: decodedRegistersAfter[0].toString(),
      r1: decodedRegistersAfter[1].toString(),
      r2: decodedRegistersAfter[2].toString(),
      r3: decodedRegistersAfter[3].toString(),
      r4: decodedRegistersAfter[4].toString(),
      r5: decodedRegistersAfter[5].toString(),
      r6: decodedRegistersAfter[6].toString(),
      r7: decodedRegistersAfter[7].toString(),
      r8: decodedRegistersAfter[8].toString(),
      r9: decodedRegistersAfter[9].toString(),
      r10: decodedRegistersAfter[10].toString(),
      r11: decodedRegistersAfter[11].toString(),
      r12: decodedRegistersAfter[12].toString(),
    })
    
    // Compare registers before and after
    const registerChanges: Array<{ register: number; before: string; after: string; changed: boolean }> = []
    for (let j = 0; j < 13; j++) {
      const before = decodedRegistersBefore[j]
      const after = decodedRegistersAfter[j]
      const changed = before !== after
      registerChanges.push({
        register: j,
        before: before.toString(),
        after: after.toString(),
        changed,
      })
    }
    
    logger.info('=== REGISTER COMPARISON ===', {
      changes: registerChanges.filter(r => r.changed),
      allRegisters: registerChanges,
    })
    
    // Try to decode context after call (if it's still accessible)
    // Note: accumulateInvocation clears accumulationContext, so we can't get it from WASM
    // But we can try to decode the same encoded context again to see if anything changed
    const [afterDecodeError, afterDecoded] = decodeImplicationsPair(encodedContext, configService)
    if (afterDecodeError || !afterDecoded) {
      logger.error('Failed to decode context after call', { error: afterDecodeError?.message })
    } else {
      logger.info('Context decoded successfully after call', {
        regularId: afterDecoded.value[0].id.toString(),
        regularAccountsSize: afterDecoded.value[0].state.accounts.size,
        regularXfersLength: afterDecoded.value[0].xfers.length,
        regularYield: afterDecoded.value[0].yield ? bytesToHex(afterDecoded.value[0].yield) : null,
      })
      
      // Deep compare
      if (beforeDecoded && afterDecoded) {
        const before = beforeDecoded.value[0]
        const after = afterDecoded.value[0]
        
        logger.info('Deep comparison of context', {
          idMatch: before.id === after.id,
          nextfreeidMatch: before.nextfreeid === after.nextfreeid,
          accountsSizeMatch: before.state.accounts.size === after.state.accounts.size,
          xfersLengthMatch: before.xfers.length === after.xfers.length,
          yieldMatch: (before.yield === null && after.yield === null) || 
                     (before.yield && after.yield && bytesToHex(before.yield) === bytesToHex(after.yield)),
          provisionsSizeMatch: before.provisions.size === after.provisions.size,
        })
        
        // Compare account balances
        for (const [accountId, beforeAccount] of before.state.accounts.entries()) {
          const afterAccount = after.state.accounts.get(accountId)
          if (afterAccount) {
            logger.info(`Account ${accountId} comparison`, {
              balanceMatch: beforeAccount.balance === afterAccount.balance,
              beforeBalance: beforeAccount.balance.toString(),
              afterBalance: afterAccount.balance.toString(),
              storageSizeMatch: beforeAccount.storage.size === afterAccount.storage.size,
              preimagesSizeMatch: beforeAccount.preimages.size === afterAccount.preimages.size,
              requestsSizeMatch: beforeAccount.requests.size === afterAccount.requests.size,
            })
          }
        }
      }
    }

    logger.info('Execution completed', {
      duration: `${(executionEndTime - executionStartTime).toFixed(2)}ms`,
    })

    // Get execution results from WASM state
    const status = wasm.getStatus()
    const resultCode = wasm.getResultCode()
    const gasLeft = wasm.getGasLeft()
    const gasUsed = result?.gasConsumed ?? (gasLimit - gasLeft)
    const exitArg = wasm.getExitArg()
    const pc = wasm.getProgramCounter()
    // Registers already retrieved above

    // Decode context again to see if it changed
    const [finalDecodeError, finalDecoded] = decodeImplicationsPair(encodedContext, configService)
    
    logger.info('Accumulation result', {
      status,
      statusName: status === 0 ? 'OK' : status === 1 ? 'HALT' : status === 2 ? 'PANIC' : status === 3 ? 'FAULT' : status === 4 ? 'HOST' : status === 5 ? 'OOG' : 'UNKNOWN',
      resultCode,
      resultCodeName: resultCode === 0 ? 'OK' : resultCode === 1 ? 'HALT' : resultCode === 2 ? 'PANIC' : resultCode === 3 ? 'FAULT' : resultCode === 4 ? 'HOST' : resultCode === 5 ? 'OOG' : 'UNKNOWN',
      gasLeft,
      gasUsed,
      exitArg,
      pc,
      expectedGasUsed,
      registerR7: decodedRegistersAfter[7].toString(),
      registerR8: decodedRegistersAfter[8].toString(),
      allRegisters: decodedRegistersAfter.map(r => r.toString()),
    })
    
    // Critical check: If resultCode is PANIC but status is OK, there's a mismatch
    if (resultCode === 2 && status === 0) {
      logger.error('CRITICAL: resultCode is PANIC but status is OK - execution failed silently!')
    }
    
    // Check if initializeProgram likely returned null (all registers are 0 after)
    const allZeroAfter = decodedRegistersAfter.every(r => r === 0n)
    if (allZeroAfter) {
      logger.error('CRITICAL: All registers are zero AFTER execution - initializeProgram likely returned null or run() returned early!')
    }
    
    // Check if registers changed at all
    const anyRegisterChanged = registerChanges.some(r => r.changed)
    if (!anyRegisterChanged) {
      logger.warn('WARNING: No registers changed - execution may not have occurred')
    } else {
      logger.info('Registers changed during execution', {
        changedCount: registerChanges.filter(r => r.changed).length,
        changedRegisters: registerChanges.filter(r => r.changed).map(r => `r${r.register}: ${r.before} → ${r.after}`),
      })
    }
    
    // Deep comparison of context after execution
    if (beforeDecoded && finalDecoded) {
      const before = beforeDecoded.value[0]
      const after = finalDecoded.value[0]
      
      logger.info('=== DEEP CONTEXT COMPARISON ===', {
        'BEFORE - id': before.id.toString(),
        'AFTER - id': after.id.toString(),
        'id changed': before.id !== after.id,
        'BEFORE - nextfreeid': before.nextfreeid.toString(),
        'AFTER - nextfreeid': after.nextfreeid.toString(),
        'nextfreeid changed': before.nextfreeid !== after.nextfreeid,
        'BEFORE - accounts size': before.state.accounts.size,
        'AFTER - accounts size': after.state.accounts.size,
        'accounts size changed': before.state.accounts.size !== after.state.accounts.size,
        'BEFORE - xfers length': before.xfers.length,
        'AFTER - xfers length': after.xfers.length,
        'xfers length changed': before.xfers.length !== after.xfers.length,
        'BEFORE - yield': before.yield ? bytesToHex(before.yield) : null,
        'AFTER - yield': after.yield ? bytesToHex(after.yield) : null,
        'yield changed': (before.yield === null && after.yield !== null) || 
                        (before.yield !== null && after.yield === null) ||
                        (before.yield && after.yield && bytesToHex(before.yield) !== bytesToHex(after.yield)),
        'BEFORE - provisions size': before.provisions.size,
        'AFTER - provisions size': after.provisions.size,
        'provisions size changed': before.provisions.size !== after.provisions.size,
      })
      
      // Compare account details
      for (const [accountId, beforeAccount] of before.state.accounts.entries()) {
        const afterAccount = after.state.accounts.get(accountId)
        if (afterAccount) {
          logger.info(`=== ACCOUNT ${accountId} COMPARISON ===`, {
            'BEFORE - balance': beforeAccount.balance.toString(),
            'AFTER - balance': afterAccount.balance.toString(),
            'balance changed': beforeAccount.balance !== afterAccount.balance,
            'BEFORE - storage size': beforeAccount.storage.size,
            'AFTER - storage size': afterAccount.storage.size,
            'storage size changed': beforeAccount.storage.size !== afterAccount.storage.size,
            'BEFORE - preimages size': beforeAccount.preimages.size,
            'AFTER - preimages size': afterAccount.preimages.size,
            'preimages size changed': beforeAccount.preimages.size !== afterAccount.preimages.size,
            'BEFORE - requests size': beforeAccount.requests.size,
            'AFTER - requests size': afterAccount.requests.size,
            'requests size changed': beforeAccount.requests.size !== afterAccount.requests.size,
          })
        } else {
          logger.error(`Account ${accountId} missing in AFTER context`)
        }
      }
    }

    // Verify execution completed
    expect(status).toBeDefined()
    
    // Check for page-fault or other failures and create dump
    if (status === 3) {
      // FAULT (page-fault) - execution failed
      // Get fault address from WASM state (if available)
      let faultAddress = 0n
      try {
        // Try to get fault address - may not be available in WASM exports
        // For now, calculate from the page that failed (we know it's in the stack region)
        const r1 = decodedRegistersAfter[1]
        const targetAddress = (r1 + 4n) & 0xFFFFFFFFn
        const pageIndex = Number(targetAddress / 4096n)
        faultAddress = BigInt(pageIndex * 4096)
      } catch (e) {
        // If we can't get fault address, use 0
        faultAddress = 0n
      }
      logger.error('Execution hit page-fault', { exitArg, pc, faultAddress: faultAddress.toString() })
      
      // Create failure dump with memory
      try {
        // Get page map - collect all initialized pages
        const pageMap: Array<{
          address: string
          length: number
          isWritable: boolean
          contents: number[]
        }> = []
        
        // Get page dumps for relevant pages (stack region and around fault address)
        const faultPageIndex = Number(faultAddress / 4096n)
        const stackStartPage = Math.floor(0xFEFDE000 / 4096)
        const stackEndPage = Math.floor(0xFEFE0000 / 4096)
        
        // Also get the page from r1 + 4 (the actual target address)
        const r1 = decodedRegistersAfter[1]
        const targetAddress = (r1 + 4n) & 0xFFFFFFFFn
        const targetPageIndex = Number(targetAddress / 4096n)
        
        // Collect pages around the fault and in the stack region
        const pagesToDump = new Set<number>()
        // Add pages around fault
        for (let i = Math.max(0, faultPageIndex - 2); i <= faultPageIndex + 2; i++) {
          pagesToDump.add(i)
        }
        // Add pages around target
        for (let i = Math.max(0, targetPageIndex - 2); i <= targetPageIndex + 2; i++) {
          pagesToDump.add(i)
        }
        // Add all stack pages
        for (let i = stackStartPage; i <= stackEndPage; i++) {
          pagesToDump.add(i)
        }
        
        for (const pageIndex of pagesToDump) {
          try {
            const pageData = wasm.getPageDump?.(pageIndex)
            if (pageData && pageData.length === 4096) {
              const pageAddress = pageIndex * 4096
              // Check if page is writable (we can't easily check this from WASM, so assume stack pages are writable)
              const isWritable = pageAddress >= 0xFEFDE000 && pageAddress < 0xFEFE0000
              pageMap.push({
                address: `0x${pageAddress.toString(16)}`,
                length: 4096,
                isWritable,
                contents: Array.from(pageData),
              })
            }
          } catch (e) {
            // Skip pages that don't exist
          }
        }
        
        // Get instruction name from PVM parser for the failed PC
        let instructionName = 'UNKNOWN'
        if (parseResult.success) {
          const failedInstruction = parseResult.instructions.find(inst => Number(inst.pc) === pc)
          if (failedInstruction) {
            const handler = registry.getHandler(failedInstruction.opcode)
            instructionName = handler?.name || `UNKNOWN_${failedInstruction.opcode}`
          }
        }
        
        // Get last step from execution trace for registersAfter
        const lastStep = executionTrace.length > 0 ? executionTrace[executionTrace.length - 1] : null
        const lastInstruction = lastStep ? {
          pc: lastStep.pc.toString(),
          pcHex: `0x${lastStep.pc.toString(16)}`,
          instructionName: instructionName,
          operands: lastStep.operands.map(b => `0x${b.toString(16).padStart(2, '0')}`),
          operandsStr: lastStep.operands.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', '),
          message: 'From execution trace',
          data: {
            registersAfter: lastStep.registersAfter,
            gas: lastStep.gas,
            status: lastStep.status,
          },
        } : null
        
        // Create failure dump
        const failureDump = {
          timestamp: new Date().toISOString(),
          testName: 'accumulate-wasm',
          failure: {
            status: 3,
            statusName: 'page-fault',
            resultCode,
            resultCodeName: resultCode === 0 ? 'OK' : resultCode === 1 ? 'HALT' : resultCode === 2 ? 'PANIC' : resultCode === 3 ? 'FAULT' : resultCode === 4 ? 'HOST' : resultCode === 5 ? 'OOG' : 'UNKNOWN',
            pc,
            pcHex: `0x${pc.toString(16)}`,
            exitArg,
            faultAddress: faultAddress.toString(),
            faultAddressHex: `0x${faultAddress.toString(16)}`,
            gasCounter: gasLeft.toString(),
            gasUsed,
            gasLeft,
            instructionName: instructionName,
          },
          postState: {
            pc: pc.toString(),
            resultCode,
            gasCounter: gasLeft.toString(),
            registers: (() => {
              const regs: Record<string, string> = {}
              for (let i = 0; i < 13; i++) {
                regs[`r${i}`] = decodedRegistersAfter[i].toString()
              }
              return regs
            })(),
            faultAddress: faultAddress.toString(),
          },
          lastInstruction,
          pageMap,
          executionTrace: executionTrace.slice(-10), // Last 10 steps
          parsedProgram: parseResult.success ? {
            programInfo: {
              codeLength: parseResult.codeLength,
              jumpTableSize: parseResult.jumpTable.length,
              bitmaskLength: parseResult.bitmask.length,
              instructionsCount: parseResult.instructions.length,
            },
            failedPC: {
              pc,
              instructionName: instructionName,
            },
            parseErrors: parseResult.errors,
            success: true,
          } : {
            parseErrors: parseResult.errors,
            success: false,
          },
        }
        
        // Create failure dump directory
        const dumpDir = join(WORKSPACE_ROOT, 'infra', 'node', '__tests__', 'accumulate-failure-dumps')
        mkdirSync(dumpDir, { recursive: true })
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `accumulate-failure-${timestamp}.json`
        const filepath = join(dumpDir, filename)
        
        // Write failure dump to file
        writeFileSync(
          filepath,
          JSON.stringify(
            failureDump,
            (_key, value) => {
              if (typeof value === 'bigint') {
                return value.toString()
              }
              return value
            },
            2,
          ),
          'utf-8',
        )
        
        // Instructions are already saved with deterministic name above, so just log the reference
        const instructionsFilepath = join(dumpDir, 'accumulate-instructions.json')
        
        logger.error(`📄 Failure dump saved to: ${filepath}`, {
          filepath,
          instructionsFilepath: existsSync(instructionsFilepath) ? instructionsFilepath : 'not found',
          dumpSize: JSON.stringify(failureDump).length,
          pageMapSize: pageMap.length,
        })
      } catch (dumpError) {
        logger.error('Failed to create failure dump:', dumpError)
      }
      
      throw new Error(`Execution hit page-fault at PC ${pc}, fault address: 0x${faultAddress.toString(16)}`)
    } else if (status === 0) {
      logger.warn('Status is OK but no gas consumed - execution may not have started')
      // This might be expected if the program doesn't execute immediately
      // Let's check if we can get more info
    } else if (status === 1) {
      // HALT - execution completed
      expect(gasUsed).toBeGreaterThan(0)
      expect(gasUsed).toBeLessThan(gasLimit)
    } else if (status === 2) {
      // PANIC - execution failed
      logger.error('Execution panicked', { exitArg, pc })
      throw new Error(`Execution panicked with exit code ${exitArg}`)
    } else {
      // Other status (HOST, OOG)
      logger.warn('Execution ended with status', { status, exitArg, pc })
    }

    // Check if gas usage is reasonable
    if (expectedGasUsed > 0) {
      const gasUsedNumber = Number(gasUsed)
      const gasPerItem = expectedGasUsed / 9 // 9 items in the test vector
      logger.info('Gas comparison', {
        actualGasUsed: gasUsedNumber,
        expectedPerItem: gasPerItem,
        expectedTotal: expectedGasUsed,
        difference: gasUsedNumber - gasPerItem,
        percentDiff: ((gasUsedNumber - gasPerItem) / gasPerItem * 100).toFixed(2) + '%',
      })
    }
  }, { timeout: 30000 }) // 30 second timeout
})

