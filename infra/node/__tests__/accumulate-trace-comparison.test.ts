/**
 * Accumulation Trace Comparison Test
 * 
 * This test loads the bytecode from accumulate_ready_queued_reports-1.json
 * and executes the same accumulation with both WASM and TypeScript executors
 * to generate comparable PVM traces for debugging.
 */

import { EventBusService, logger, hexToBytes, blake2bHash, zeroHash } from '@pbnj/core'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { type AccumulateInput, type PartialState, type ServiceAccount, type OperandTuple } from '@pbnj/types'
import { ConfigService } from '../services/config-service'
import { ClockService } from '../services/clock-service'
import { ValidatorSetManager } from '../services/validator-set'
import { ServiceAccountService } from '../services/service-account-service'
import { AccumulationService } from '../services/accumulation-service'
import { AuthQueueService } from '../services/auth-queue-service'
import { ReadyService } from '../services/ready-service'
import { AccumulatePVM } from '@pbnj/pvm-invocations'
import {
  HostFunctionRegistry,
  AccumulateHostFunctionRegistry,
  PVMParser,
  InstructionRegistry,
} from '@pbnj/pvm'
import { decodeProgramFromPreimage, encodeValidatorPublicKeys } from '@pbnj/codec'
import { describe, expect, beforeEach, test } from 'bun:test'
import { StatisticsService } from '../services/statistics-service'
import { PrivilegesService } from '../services/privileges-service'
import { RingVRFProverWasm, RingVRFVerifierWasm } from '@pbnj/bandersnatch-vrf'
import { EntropyService } from '../services/entropy'
import type { Hex } from 'viem'

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
  
  // For this test, we'll use a minimal payload (the actual payload would need to be looked up)
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
 * Parse program and write to file if it doesn't exist
 * @param preimageBlob - The preimage blob to parse
 * @param blockNumber - Optional block number (e.g., "4" or null)
 * @param testVectorName - Test vector name (e.g., "preimages_light" or "accumulate_ready_queued_reports-1")
 */
function parseAndLogProgram(
  preimageBlob: Uint8Array,
  blockNumber: string | null,
  testVectorName: string,
): void {
  // Generate filename based on block number and test vector name
  let filename: string
  if (blockNumber) {
    filename = `parsed-program-block${blockNumber}-${testVectorName}.json`
  } else {
    filename = `parsed-program-${testVectorName}.json`
  }
  
  const parsedProgramDir = path.join(WORKSPACE_ROOT, 'parsed-programs')
  const filePath = path.join(parsedProgramDir, filename)
  
  // Check if file already exists
  if (fs.existsSync(filePath)) {
    logger.info('Parsed program file already exists, skipping', { filePath })
    return
  }
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(parsedProgramDir)) {
    fs.mkdirSync(parsedProgramDir, { recursive: true })
  }
  
  try {
    // Decode preimage to get code blob
    const [decodeError, decodedPreimage] = decodeProgramFromPreimage(preimageBlob)
    if (decodeError || !decodedPreimage) {
      logger.error('Failed to decode preimage for program parsing', {
        error: decodeError?.message,
      })
      return
    }
    
    const codeBlob = decodedPreimage.value.code
    
    // Parse the program
    const parser = new PVMParser()
    const registry = new InstructionRegistry()
    const parseResult = parser.parseProgram(codeBlob)
    
    if (!parseResult.success) {
      logger.error('Failed to parse program', {
        errors: parseResult.errors,
      })
      return
    }
    
    // Build the parsed program data
    const parsedProgramData = {
      metadata: {
        blockNumber: blockNumber || null,
        testVectorName,
        codeLength: parseResult.codeLength,
        instructionCount: parseResult.instructions.length,
        jumpTableEntries: parseResult.jumpTable.length,
        bitmaskLength: parseResult.bitmask.length,
      },
      jumpTable: parseResult.jumpTable.map((addr) => addr.toString()),
      instructions: parseResult.instructions.map((inst) => {
        const handler = registry.getHandler(inst.opcode)
        return {
          pc: inst.pc.toString(),
          opcode: inst.opcode.toString(),
          opcodeHex: `0x${inst.opcode.toString(16)}`,
          name: handler?.name || 'UNKNOWN',
          fskip: inst.fskip,
          operands: Array.from(inst.operands).map((b) => `0x${b.toString(16).padStart(2, '0')}`),
          operandsLength: inst.operands.length,
        }
      }),
      bitmask: Array.from(parseResult.bitmask),
      code: Array.from(codeBlob).map((b) => `0x${b.toString(16).padStart(2, '0')}`),
    }
    
    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(parsedProgramData, null, 2), 'utf-8')
    
    logger.info('Parsed program written to file', {
      filePath,
      instructionCount: parseResult.instructions.length,
      jumpTableEntries: parseResult.jumpTable.length,
    })
  } catch (error) {
    logger.error('Error parsing and writing program', {
      error: error instanceof Error ? error.message : String(error),
      filePath,
    })
  }
}

/**
 * Create accumulation service with specified executor type
 */
function createAccumulationService(
  useWasm: boolean,
  configService: ConfigService,
  eventBusService: EventBusService,
  clockService: ClockService,
  entropyService: EntropyService,
  validatorSetManager: ValidatorSetManager,
  authQueueService: AuthQueueService,
  readyService: ReadyService,
  privilegesService: PrivilegesService,
  serviceAccountsService: ServiceAccountService,
): AccumulationService {
  const hostFunctionRegistry = new HostFunctionRegistry(serviceAccountsService, configService)
  const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(configService)
  const accumulatePVM = new AccumulatePVM({
    hostFunctionRegistry,
    accumulateHostFunctionRegistry,
    configService: configService,
    entropyService: entropyService,
    pvmOptions: { gasCounter: 100000n }, // High gas limit for debugging
    useWasm,
  })

  const statisticsService = new StatisticsService({
    eventBusService: eventBusService,
    configService: configService,
    clockService: clockService,
  })

  return new AccumulationService({
    configService: configService,
    clockService: clockService,
    serviceAccountsService: serviceAccountsService,
    privilegesService: privilegesService,
    validatorSetManager: validatorSetManager,
    authQueueService: authQueueService,
    accumulatePVM: accumulatePVM,
    readyService: readyService,
    statisticsService: statisticsService,
  })
}

describe('Accumulation Trace Comparison Tests', () => {
  let configService: ConfigService
  let eventBusService: EventBusService
  let clockService: ClockService
  let entropyService: EntropyService
  let validatorSetManager: ValidatorSetManager
  let authQueueService: AuthQueueService
  let readyService: ReadyService
  let privilegesService: PrivilegesService
  let serviceAccountsService: ServiceAccountService
  let testData: TestVectorData

  beforeEach(async () => {
    configService = new ConfigService('tiny')
    eventBusService = new EventBusService()
    clockService = new ClockService({
      configService: configService,
      eventBusService: eventBusService,
    })
    entropyService = new EntropyService(eventBusService)

    const srsFilePath = path.join(
      WORKSPACE_ROOT,
      'packages',
      'bandersnatch-vrf',
      'test-data',
      'srs',
      'zcash-srs-2-11-uncompressed.bin',
    )
    const ringProver = new RingVRFProverWasm(srsFilePath)
    const ringVerifier = new RingVRFVerifierWasm(srsFilePath)

    await ringProver.init()
    await ringVerifier.init()

    validatorSetManager = new ValidatorSetManager({
      eventBusService,
      sealKeyService: null,
      ringProver,
      ticketService: null,
      configService,
      initialValidators: null,
    })

    authQueueService = new AuthQueueService({
      configService,
    })

    readyService = new ReadyService({
      configService: configService,
    })

    privilegesService = new PrivilegesService({
      configService,
    })

    serviceAccountsService = new ServiceAccountService({
      configService,
      eventBusService,
      clockService,
      networkingService: null,
      preimageRequestProtocol: null,
    })

    // Load test data
    testData = loadTestVectorData()
  })

  test('should generate traces for both WASM and TypeScript executors', async () => {
    const { codeHash, preimageBlob, payload, serviceBalance, minItemGas, minMemoGas } = testData

    // Parse and log program to file
    const testVectorName = path.basename(TEST_VECTOR_PATH, '.json')
    parseAndLogProgram(preimageBlob, null, testVectorName)

    // Calculate codehash to verify it matches
    const [hashError, calculatedCodeHash] = blake2bHash(preimageBlob)
    if (hashError || !calculatedCodeHash) {
      throw new Error('Failed to calculate code hash')
    }

    expect(calculatedCodeHash).toBe(codeHash)

    // Create a minimal partial state with our service
    const serviceId = 1729n
    const preimages = new Map([[codeHash, preimageBlob]])
    
    // Create staging set with exactly Cvalcount (6) null validators
    // Gray Paper accumulation.tex equation 134: ps_stagingset must have exactly Cvalcount validators
    const requiredValidatorCount = configService.numValidators
    const nullValidators = validatorSetManager.createNullValidatorSet(requiredValidatorCount)
    const stagingset = nullValidators.map(encodeValidatorPublicKeys)
    
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
            items: 2n, // From test vector
            created: 0n,
            lastacc: 0n,
            parent: 0n,
            preimages: preimages,
            requests: new Map(),
            storage: new Map(),
          } as ServiceAccount,
        ],
      ]),
      authqueue: [[], []], // Empty auth queue
      assigners: [],
      stagingset, // Now has exactly 6 null validators
      manager: 0n,
      registrar: 0n,
      delegator: 0n,
      alwaysaccers: new Map(),
    }

    // Create accumulation input with the payload
    // Get work report data from test vector
    const firstQueueItem = JSON.parse(fs.readFileSync(TEST_VECTOR_PATH, 'utf-8')).pre_state.ready_queue[0][0]
    const workResult = firstQueueItem.report.results[0]
    
    const timeslot = 43n // From test vector
    const operandTuple: OperandTuple = {
      packageHash: firstQueueItem.report.package_spec.hash as Hex,
      segmentRoot: zeroHash, // No segment root for this test
      authorizer: firstQueueItem.report.authorizer_hash as Hex,
      payloadHash: workResult.payload_hash as Hex,
      gasLimit: BigInt(workResult.accumulate_gas),
      result: workResult.result,
      authTrace: new Uint8Array(0), // Empty auth trace
    }
    
    const inputs: AccumulateInput[] = [
      {
        type: 0,
        value: operandTuple,
      },
    ]

    const gas = 10000n // Total gas available for this accumulation

    logger.info('Executing accumulation with WASM executor', {
      serviceId: serviceId.toString(),
      timeslot: timeslot.toString(),
      gas: gas.toString(),
      inputsCount: inputs.length,
      serviceCodeLength: preimageBlob.length,
      payloadLength: payload.length,
      codeHash,
    })

    // Execute with WASM executor
    const wasmAccumulationService = createAccumulationService(
      true, // useWasm
      configService,
      eventBusService,
      clockService,
      entropyService,
      validatorSetManager,
      authQueueService,
      readyService,
      privilegesService,
      serviceAccountsService,
    )

    const wasmExecutionStartTime = performance.now()
    const wasmResult = await wasmAccumulationService.executeAccumulateInvocation(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
    )
    const wasmExecutionEndTime = performance.now()

    logger.info('WASM execution completed', {
      duration: `${(wasmExecutionEndTime - wasmExecutionStartTime).toFixed(2)}ms`,
      ok: wasmResult.ok,
    })

    if (!wasmResult.ok) {
      logger.error('WASM accumulation failed', { error: wasmResult.err })
    } else {
      logger.info('WASM accumulation result', {
        gasUsed: wasmResult.value.gasused.toString(),
        resultCode: wasmResult.value.resultCode,
        yieldLength: wasmResult.value.yield?.length || 0,
      })
    }

    // Compare code arrays after execution (they should be set up by now)
    try {
      const wasmExecutor = (wasmAccumulationService as any).accumulatePVM.executor as any
      if (wasmExecutor?.wasm && wasmExecutor.wasm.getCode && wasmExecutor.wasm.getBitmask) {
        const wasmCode = wasmExecutor.wasm.getCode()
        const wasmBitmask = wasmExecutor.wasm.getBitmask()
        const tsCode = wasmExecutor.code // Set in executeAccumulationInvocation
        const tsBitmask = wasmExecutor.bitmask
        
        if (wasmCode && wasmBitmask && tsCode && tsBitmask) {
          logger.info('Code array comparison', {
            wasmCodeLength: wasmCode.length,
            tsCodeLength: tsCode.length,
            wasmBitmaskLength: wasmBitmask.length,
            tsBitmaskLength: tsBitmask.length,
          })
          
          // Detailed comparison: check if arrays are exactly the same
          const codeMatch = wasmCode.length === tsCode.length && 
            Array.from(wasmCode).every((val, idx) => val === tsCode[idx])
          const bitmaskMatch = wasmBitmask.length === tsBitmask.length && 
            Array.from(wasmBitmask).every((val, idx) => val === tsBitmask[idx])
          
          logger.info('Exact array comparison', {
            codeArraysMatch: codeMatch,
            bitmaskArraysMatch: bitmaskMatch,
          })
          
          if (!codeMatch || !bitmaskMatch) {
            // Find first mismatch
            let firstCodeMismatch = -1
            let firstBitmaskMismatch = -1
            
            for (let i = 0; i < Math.min(wasmCode.length, tsCode.length); i++) {
              if (wasmCode[i] !== tsCode[i] && firstCodeMismatch === -1) {
                firstCodeMismatch = i
              }
            }
            
            for (let i = 0; i < Math.min(wasmBitmask.length, tsBitmask.length); i++) {
              if (wasmBitmask[i] !== tsBitmask[i] && firstBitmaskMismatch === -1) {
                firstBitmaskMismatch = i
              }
            }
            
            logger.error('Array mismatch detected', {
              firstCodeMismatch,
              firstBitmaskMismatch,
              wasmCodeAtMismatch: firstCodeMismatch >= 0 ? {
                index: firstCodeMismatch,
                value: wasmCode[firstCodeMismatch],
                hex: `0x${wasmCode[firstCodeMismatch].toString(16)}`,
              } : null,
              tsCodeAtMismatch: firstCodeMismatch >= 0 ? {
                index: firstCodeMismatch,
                value: tsCode[firstCodeMismatch],
                hex: `0x${tsCode[firstCodeMismatch].toString(16)}`,
              } : null,
              wasmBitmaskAtMismatch: firstBitmaskMismatch >= 0 ? {
                index: firstBitmaskMismatch,
                value: wasmBitmask[firstBitmaskMismatch],
              } : null,
              tsBitmaskAtMismatch: firstBitmaskMismatch >= 0 ? {
                index: firstBitmaskMismatch,
                value: tsBitmask[firstBitmaskMismatch],
              } : null,
              // Show first 50 bytes for comparison
              wasmCodeFirst50: Array.from(wasmCode.slice(0, 50)).map(b => `0x${b.toString(16).padStart(2, '0')}`),
              tsCodeFirst50: Array.from(tsCode.slice(0, 50)).map(b => `0x${b.toString(16).padStart(2, '0')}`),
              wasmBitmaskFirst50: Array.from(wasmBitmask.slice(0, 50)),
              tsBitmaskFirst50: Array.from(tsBitmask.slice(0, 50)),
            })
          }
          
          // Compare at position 5 (where execution starts)
          if (wasmCode.length > 5 && tsCode.length > 5) {
            const wasmCodeAt5 = wasmCode[5]
            const tsCodeAt5 = tsCode[5]
            const wasmBitmaskAt5 = wasmBitmask[5]
            const tsBitmaskAt5 = tsBitmask[5]
            
            if (wasmCodeAt5 !== tsCodeAt5 || wasmBitmaskAt5 !== tsBitmaskAt5) {
              logger.error('Code/Bitmask mismatch at PC=5', {
                wasmCodeAt5: `0x${wasmCodeAt5.toString(16)}`,
                tsCodeAt5: `0x${tsCodeAt5.toString(16)}`,
                wasmBitmaskAt5,
                tsBitmaskAt5,
                wasmCodeSlice: Array.from(wasmCode.slice(0, 20)).map(b => `0x${b.toString(16)}`),
                tsCodeSlice: Array.from(tsCode.slice(0, 20)).map(b => `0x${b.toString(16)}`),
                wasmBitmaskSlice: Array.from(wasmBitmask.slice(0, 20)),
                tsBitmaskSlice: Array.from(tsBitmask.slice(0, 20)),
              })
              
              // Fail the test if there's a mismatch at PC=5
              expect(wasmCodeAt5).toBe(tsCodeAt5)
              expect(wasmBitmaskAt5).toBe(tsBitmaskAt5)
            } else {
              logger.info('Code/Bitmask match at PC=5', {
                codeAt5: `0x${wasmCodeAt5.toString(16)}`,
                bitmaskAt5: wasmBitmaskAt5,
              })
            }
          }
          
          // Compare first 100 bytes for any differences
          const compareLength = Math.min(100, wasmCode.length, tsCode.length)
          let firstMismatch = -1
          for (let i = 0; i < compareLength; i++) {
            if (wasmCode[i] !== tsCode[i]) {
              firstMismatch = i
              break
            }
          }
          
          if (firstMismatch >= 0) {
            logger.error('Code array mismatch detected', {
              firstMismatchIndex: firstMismatch,
              wasmValue: `0x${wasmCode[firstMismatch].toString(16)}`,
              tsValue: `0x${tsCode[firstMismatch].toString(16)}`,
              contextBefore: {
                wasm: Array.from(wasmCode.slice(Math.max(0, firstMismatch - 5), firstMismatch)).map(b => `0x${b.toString(16)}`),
                ts: Array.from(tsCode.slice(Math.max(0, firstMismatch - 5), firstMismatch)).map(b => `0x${b.toString(16)}`),
              },
              contextAfter: {
                wasm: Array.from(wasmCode.slice(firstMismatch + 1, firstMismatch + 6)).map(b => `0x${b.toString(16)}`),
                ts: Array.from(tsCode.slice(firstMismatch + 1, firstMismatch + 6)).map(b => `0x${b.toString(16)}`),
              },
            })
            
            // Fail the test if code arrays don't match
            expect(wasmCode[firstMismatch]).toBe(tsCode[firstMismatch])
          } else {
            logger.info('Code arrays match in first 100 bytes', { compareLength })
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to compare code arrays', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Wait a bit to ensure trace files are written
    await new Promise(resolve => setTimeout(resolve, 100))

    logger.info('Executing accumulation with TypeScript executor', {
      serviceId: serviceId.toString(),
      timeslot: timeslot.toString(),
      gas: gas.toString(),
      inputsCount: inputs.length,
      serviceCodeLength: preimageBlob.length,
      payloadLength: payload.length,
      codeHash,
    })

    // Execute with TypeScript executor
    const tsAccumulationService = createAccumulationService(
      false, // useWasm
      configService,
      eventBusService,
      clockService,
      entropyService,
      validatorSetManager,
      authQueueService,
      readyService,
      privilegesService,
      serviceAccountsService,
    )

    const tsExecutionStartTime = performance.now()
    const tsResult = await tsAccumulationService.executeAccumulateInvocation(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
    )
    const tsExecutionEndTime = performance.now()

    logger.info('TypeScript execution completed', {
      duration: `${(tsExecutionEndTime - tsExecutionStartTime).toFixed(2)}ms`,
      ok: tsResult.ok,
    })

    if (!tsResult.ok) {
      logger.error('TypeScript accumulation failed', { error: tsResult.err })
    } else {
      logger.info('TypeScript accumulation result', {
        gasUsed: tsResult.value.gasused.toString(),
        resultCode: tsResult.value.resultCode,
        yieldLength: tsResult.value.yield?.length || 0,
      })
    }

    // Wait a bit to ensure trace files are written
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check that trace files were created
    const traceDir = path.join(WORKSPACE_ROOT, 'pvm-traces')
    if (fs.existsSync(traceDir)) {
      const traceFiles = fs.readdirSync(traceDir)
        .filter(f => f.startsWith('trace-') && f.endsWith('.log'))
        .sort()
        .reverse() // Most recent first

      logger.info('Trace files found', {
        traceDir,
        count: traceFiles.length,
        files: traceFiles.slice(0, 10), // Show first 10
      })

      // Find WASM and TypeScript trace files
      const wasmTraces = traceFiles.filter(f => f.includes('wasm'))
      const tsTraces = traceFiles.filter(f => f.includes('ts'))

      logger.info('Trace file summary', {
        wasmTraces: wasmTraces.slice(0, 5),
        tsTraces: tsTraces.slice(0, 5),
      })

      // Verify both executors generated traces
      expect(wasmTraces.length).toBeGreaterThan(0)
      expect(tsTraces.length).toBeGreaterThan(0)

      // Read and compare the most recent traces
      if (wasmTraces.length > 0 && tsTraces.length > 0) {
        const wasmTracePath = path.join(traceDir, wasmTraces[0])
        const tsTracePath = path.join(traceDir, tsTraces[0])

        const wasmTraceContent = fs.readFileSync(wasmTracePath, 'utf-8')
        const tsTraceContent = fs.readFileSync(tsTracePath, 'utf-8')

        const wasmTraceLines = wasmTraceContent.split('\n').filter(l => l.trim().length > 0)
        const tsTraceLines = tsTraceContent.split('\n').filter(l => l.trim().length > 0)

        logger.info('Trace comparison', {
          wasmTraceFile: wasmTraces[0],
          wasmTraceLines: wasmTraceLines.length,
          tsTraceFile: tsTraces[0],
          tsTraceLines: tsTraceLines.length,
        })

        // Log first few lines of each trace for comparison
        logger.info('WASM trace sample (first 10 lines)', {
          lines: wasmTraceLines.slice(0, 10),
        })

        logger.info('TypeScript trace sample (first 10 lines)', {
          lines: tsTraceLines.slice(0, 10),
        })

        // Detailed comparison: find first difference
        const minLength = Math.min(wasmTraceLines.length, tsTraceLines.length)
        let firstDifference = -1
        for (let i = 0; i < minLength; i++) {
          if (wasmTraceLines[i] !== tsTraceLines[i]) {
            firstDifference = i
            break
          }
        }

        if (firstDifference >= 0) {
          logger.error('Trace divergence detected', {
            firstDifferenceLine: firstDifference,
            wasmLine: wasmTraceLines[firstDifference],
            tsLine: tsTraceLines[firstDifference],
            contextBefore: {
              wasm: wasmTraceLines.slice(Math.max(0, firstDifference - 3), firstDifference),
              ts: tsTraceLines.slice(Math.max(0, firstDifference - 3), firstDifference),
            },
            contextAfter: {
              wasm: wasmTraceLines.slice(firstDifference + 1, firstDifference + 4),
              ts: tsTraceLines.slice(firstDifference + 1, firstDifference + 4),
            },
          })
        } else if (wasmTraceLines.length !== tsTraceLines.length) {
          logger.error('Trace length mismatch', {
            wasmLength: wasmTraceLines.length,
            tsLength: tsTraceLines.length,
            wasmLastLines: wasmTraceLines.slice(-5),
            tsLastLines: tsTraceLines.slice(-5),
        })
        } else {
          logger.info('Traces match completely', {
            totalLines: wasmTraceLines.length,
          })
        }

        // Check for UNKNOWN instructions in WASM trace
        const wasmUnknownCount = wasmTraceLines.filter(l => l.includes('UNKNOWN')).length
        if (wasmUnknownCount > 0) {
          logger.warn('WASM trace contains UNKNOWN instructions', {
            unknownCount: wasmUnknownCount,
            totalLines: wasmTraceLines.length,
            percentage: ((wasmUnknownCount / wasmTraceLines.length) * 100).toFixed(2) + '%',
            unknownLines: wasmTraceLines.filter(l => l.includes('UNKNOWN')).slice(0, 5),
          })
        }

        // Check for TRAP instructions in both traces
        const wasmTrapCount = wasmTraceLines.filter(l => l.includes('TRAP')).length
        const tsTrapCount = tsTraceLines.filter(l => l.includes('TRAP')).length
        if (wasmTrapCount > 0 || tsTrapCount > 0) {
          logger.warn('TRAP instructions detected', {
            wasmTrapCount,
            tsTrapCount,
            wasmTrapLines: wasmTraceLines.filter(l => l.includes('TRAP')).slice(0, 3),
            tsTrapLines: tsTraceLines.filter(l => l.includes('TRAP')).slice(0, 3),
          })
        }

        // Check PC values at start
        const wasmFirstPC = wasmTraceLines[0]?.match(/pc:\s*(\d+)/)?.[1]
        const tsFirstPC = tsTraceLines[0]?.match(/pc:\s*(\d+)/)?.[1]
        if (wasmFirstPC !== tsFirstPC) {
          logger.error('Initial PC mismatch', {
            wasmPC: wasmFirstPC,
            tsPC: tsFirstPC,
          })
        }

        // Verify both traces have some content
        expect(wasmTraceLines.length).toBeGreaterThan(0)
        expect(tsTraceLines.length).toBeGreaterThan(0)
      }
    } else {
      logger.warn('Trace directory not found', { traceDir })
    }

    // Verify both executions completed
    expect(wasmResult.ok || tsResult.ok).toBe(true) // At least one should succeed
  }, { timeout: 30000 }) // 30 second timeout for both executions

  test('should compare traces for block 4 from preimages_light', async () => {
    // Load block 4 data
    const block4Path = path.join(
      WORKSPACE_ROOT,
      'submodules',
      'jam-test-vectors',
      'traces',
      'preimages_light',
      '00000004.json',
    )

    if (!fs.existsSync(block4Path)) {
      logger.warn('Block 4 test vector not found, skipping test', { block4Path })
      return
    }

    const block4Data = JSON.parse(fs.readFileSync(block4Path, 'utf-8'))
    
    // Extract work reports from guarantees
    const guarantees = block4Data.block?.extrinsic?.guarantees || []
    if (guarantees.length === 0) {
      logger.warn('No guarantees found in block 4, skipping test')
      return
    }

    // Get the first work report
    const firstGuarantee = guarantees[0]
    const workReport = firstGuarantee.report
    
    // Find the service account for this work report
    const serviceId = BigInt(workReport.results[0]?.service_id || 0)
    if (serviceId === 0n) {
      logger.warn('No service ID found in work report, skipping test')
      return
    }

    // Find service account in pre_state
    const serviceAccount = block4Data.pre_state?.keyvals?.find((kv: any) => {
      const key = kv.key as string
      // Service account key format: 0x0001007100a000... (chapter 255, service ID)
      return key.startsWith('0x00010071') && key.includes(serviceId.toString(16).padStart(16, '0'))
    })

    if (!serviceAccount) {
      logger.warn(`Service account ${serviceId} not found in pre_state, skipping test`)
      return
    }

    // Parse and log program to file if preimage is available
    if (serviceAccount.value?.preimages_blob) {
      // Find the preimage blob (use the first one or match by code hash)
      const preimageEntry = Array.isArray(serviceAccount.value.preimages_blob)
        ? serviceAccount.value.preimages_blob[0]
        : serviceAccount.value.preimages_blob
      
      if (preimageEntry?.blob) {
        try {
          const preimageBlob = hexToBytes(preimageEntry.blob as Hex)
          parseAndLogProgram(preimageBlob, '4', 'preimages_light')
        } catch (error) {
          logger.warn('Failed to parse preimage blob for logging', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    logger.info('Loaded block 4 data', {
      serviceId: serviceId.toString(),
      guaranteesCount: guarantees.length,
      workReportHash: workReport.package_spec?.hash?.slice(0, 40),
    })

    // Create partial state (simplified - would need full state decoding)
    // Create staging set with exactly Cvalcount (6) null validators
    const requiredValidatorCount = configService.numValidators
    const nullValidators = validatorSetManager.createNullValidatorSet(requiredValidatorCount)
    const stagingset = nullValidators.map(encodeValidatorPublicKeys)
    
    const partialState: PartialState = {
      accounts: new Map(),
      authqueue: [[], []],
      assigners: [],
      stagingset, // Now has exactly 6 null validators
      manager: 0n,
      registrar: 0n,
      delegator: 0n,
      alwaysaccers: new Map(),
    }

    // Create accumulation input
    const workResult = workReport.results[0]
    const operandTuple: OperandTuple = {
      packageHash: workReport.package_spec.hash as Hex,
      segmentRoot: workReport.package_spec.erasure_root as Hex || zeroHash,
      authorizer: workReport.authorizer_hash as Hex,
      payloadHash: workResult.payload_hash as Hex,
      gasLimit: BigInt(workResult.accumulate_gas),
      result: workResult.result,
      authTrace: hexToBytes(workReport.auth_output as Hex || '0x'),
    }

    const inputs: AccumulateInput[] = [
      {
        type: 0,
        value: operandTuple,
      },
    ]

    const timeslot = BigInt(block4Data.block?.header?.slot || 4)
    const gas = BigInt(workResult.accumulate_gas || 20000000)

    logger.info('Executing block 4 accumulation with both executors', {
      serviceId: serviceId.toString(),
      timeslot: timeslot.toString(),
      gas: gas.toString(),
      inputsCount: inputs.length,
    })

    // Execute with WASM executor
    const wasmAccumulationService = createAccumulationService(
      true, // useWasm
      configService,
      eventBusService,
      clockService,
      entropyService,
      validatorSetManager,
      authQueueService,
      readyService,
      privilegesService,
      serviceAccountsService,
    )

    const wasmResult = await wasmAccumulationService.executeAccumulateInvocation(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
    )

    // Wait for trace files
    await new Promise(resolve => setTimeout(resolve, 200))

    // Execute with TypeScript executor
    const tsAccumulationService = createAccumulationService(
      false, // useWasm
      configService,
      eventBusService,
      clockService,
      entropyService,
      validatorSetManager,
      authQueueService,
      readyService,
      privilegesService,
      serviceAccountsService,
    )

    const tsResult = await tsAccumulationService.executeAccumulateInvocation(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
    )

    // Wait for trace files
    await new Promise(resolve => setTimeout(resolve, 200))

    // Compare traces
    const traceDir = path.join(WORKSPACE_ROOT, 'pvm-traces')
    if (fs.existsSync(traceDir)) {
      const traceFiles = fs.readdirSync(traceDir)
        .filter(f => f.startsWith('trace-') && f.endsWith('.log'))
        .sort()
        .reverse()

      const wasmTraces = traceFiles.filter(f => f.includes('wasm') && f.includes(serviceId.toString()))
      const tsTraces = traceFiles.filter(f => f.includes('ts') && f.includes(serviceId.toString()))

      if (wasmTraces.length > 0 && tsTraces.length > 0) {
        const wasmTracePath = path.join(traceDir, wasmTraces[0])
        const tsTracePath = path.join(traceDir, tsTraces[0])

        const wasmTraceContent = fs.readFileSync(wasmTracePath, 'utf-8')
        const tsTraceContent = fs.readFileSync(tsTracePath, 'utf-8')

        const wasmTraceLines = wasmTraceContent.split('\n').filter(l => l.trim().length > 0)
        const tsTraceLines = tsTraceContent.split('\n').filter(l => l.trim().length > 0)

        logger.info('Block 4 trace comparison', {
          wasmTraceFile: wasmTraces[0],
          wasmTraceLines: wasmTraceLines.length,
          tsTraceFile: tsTraces[0],
          tsTraceLines: tsTraceLines.length,
        })

        // Find first difference
        const minLength = Math.min(wasmTraceLines.length, tsTraceLines.length)
        let firstDifference = -1
        for (let i = 0; i < minLength; i++) {
          if (wasmTraceLines[i] !== tsTraceLines[i]) {
            firstDifference = i
            break
          }
        }

        if (firstDifference >= 0) {
          logger.error('Block 4 trace divergence detected', {
            firstDifferenceLine: firstDifference,
            wasmLine: wasmTraceLines[firstDifference],
            tsLine: tsTraceLines[firstDifference],
            contextBefore: {
              wasm: wasmTraceLines.slice(Math.max(0, firstDifference - 5), firstDifference),
              ts: tsTraceLines.slice(Math.max(0, firstDifference - 5), firstDifference),
            },
            contextAfter: {
              wasm: wasmTraceLines.slice(firstDifference + 1, firstDifference + 6),
              ts: tsTraceLines.slice(firstDifference + 1, firstDifference + 6),
            },
          })
        }

        // Check for TRAP at the start
        const wasmFirstLine = wasmTraceLines[0] || ''
        const tsFirstLine = tsTraceLines[0] || ''
        if (wasmFirstLine.includes('TRAP') || tsFirstLine.includes('TRAP')) {
          logger.error('TRAP detected at start of execution', {
            wasmFirstLine,
            tsFirstLine,
            wasmPC: wasmFirstLine.match(/pc:\s*(\d+)/)?.[1],
            tsPC: tsFirstLine.match(/pc:\s*(\d+)/)?.[1],
          })
        }

        // Check PC values
        const wasmPCs = wasmTraceLines.map(l => l.match(/pc:\s*(\d+)/)?.[1]).filter(Boolean)
        const tsPCs = tsTraceLines.map(l => l.match(/pc:\s*(\d+)/)?.[1]).filter(Boolean)
        if (wasmPCs[0] !== tsPCs[0]) {
          logger.error('Initial PC mismatch in block 4', {
            wasmInitialPC: wasmPCs[0],
            tsInitialPC: tsPCs[0],
            expectedPC: '5',
          })
        }
      }
    }

    logger.info('Block 4 execution results', {
      wasmOk: wasmResult.ok,
      wasmResultCode: wasmResult.ok ? wasmResult.value.resultCode : undefined,
      tsOk: tsResult.ok,
      tsResultCode: tsResult.ok ? tsResult.value.resultCode : undefined,
    })
  }, { timeout: 60000 })
})

