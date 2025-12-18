/**
 * Accumulation Gas Debug Test
 * 
 * This test loads the bytecode from accumulate_ready_queued_reports-1.json
 * and executes a single accumulation to verify gas consumption
 */

import { EventBusService, logger, hexToBytes, blake2bHash, zeroHash } from '@pbnjam/core'
import { decodeProgramFromPreimage, encodeValidatorPublicKeys } from '@pbnjam/codec'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { type AccumulateInput, type PartialState, type ServiceAccount, type OperandTuple } from '@pbnjam/types'
import { ConfigService } from '../services/config-service'
import { ClockService } from '../services/clock-service'
import { ValidatorSetManager } from '../services/validator-set'
import { ServiceAccountService } from '../services/service-account-service'
import { AccumulationService } from '../services/accumulation-service'
import { AuthQueueService } from '../services/auth-queue-service'
import { ReadyService } from '../services/ready-service'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'
import { HostFunctionRegistry, AccumulateHostFunctionRegistry, PVMParser, InstructionRegistry } from '@pbnjam/pvm'
import { describe, expect, beforeEach, test } from 'bun:test'
import { StatisticsService } from '../services/statistics-service'
import { PrivilegesService } from '../services/privileges-service'
import { RingVRFProverWasm, RingVRFVerifierWasm } from '@pbnjam/bandersnatch-vrf'
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
 * Parse program bytecode and write disassembled instructions to file
 */
function parseAndWriteInstructions(preimageBlob: Uint8Array, codeHash: Hex): void {
  const parser = new PVMParser()
  const registry = new InstructionRegistry()
  
  logger.info('Parsing program bytecode', {
    preimageLength: preimageBlob.length,
    codeHash,
  })
  
  // First, decode the preimage to extract the actual code blob
  const [decodeError, decodedPreimage] = decodeProgramFromPreimage(preimageBlob)
  if (decodeError || !decodedPreimage) {
    logger.error('Failed to decode preimage', {
      error: decodeError?.message,
    })
    return
  }
  
  const decoded = decodedPreimage.value
  
  logger.info('Preimage decoded', {
    codeLength: decoded.code.length,
    roDataLength: decoded.roDataLength,
    rwDataLength: decoded.rwDataLength,
    heapZeroPaddingSize: decoded.heapZeroPaddingSize,
    stackSize: decoded.stackSize,
  })
  
  // Now parse the actual code
  const parseResult = parser.parseProgram(decoded.code)
  
  if (!parseResult.success) {
    logger.error('Failed to parse program', {
      errors: parseResult.errors,
    })
    return
  }
  
  logger.info('Parse successful', {
    instructionCount: parseResult.instructions.length,
    jumpTableEntries: parseResult.jumpTable.length,
    bitmaskLength: parseResult.bitmask.length,
    codeLength: parseResult.codeLength,
  })
  
  // Build disassembly output
  const lines: string[] = []
  lines.push('=' .repeat(80))
  lines.push('PVM PROGRAM DISASSEMBLY')
  lines.push('=' .repeat(80))
  lines.push('')
  lines.push(`Code Hash: ${codeHash}`)
  lines.push(`Blob Length: ${preimageBlob.length} bytes`)
  lines.push(`Code Length: ${parseResult.codeLength} bytes`)
  lines.push(`Total Instructions: ${parseResult.instructions.length}`)
  lines.push(`Jump Table Entries: ${parseResult.jumpTable.length}`)
  lines.push('')
  lines.push('Jump Table:')
  for (let i = 0; i < parseResult.jumpTable.length; i++) {
    lines.push(`  [${i}] → PC ${parseResult.jumpTable[i]}`)
  }
  lines.push('')
  lines.push('=' .repeat(80))
  lines.push('INSTRUCTIONS')
  lines.push('=' .repeat(80))
  lines.push('')
  
  // Disassemble each instruction
  for (const instruction of parseResult.instructions) {
    const handler = registry.getHandler(instruction.opcode)
    const instructionName = handler?.name || `UNKNOWN_${instruction.opcode}`
    
    // Format operands as hex bytes
    const operandsHex = Array.from(instruction.operands)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')
    
    // Try to get disassembly from handler if available
    let disassembly = ''
    if (handler && typeof handler.disassemble === 'function') {
      try {
        disassembly = handler.disassemble(instruction.operands)
      } catch (e) {
        disassembly = `<disassembly error: ${e}>`
      }
    }
    
    // Format: PC | Opcode | Name | Operands | Disassembly
    lines.push(`PC ${instruction.pc.toString().padStart(6, ' ')} | 0x${instruction.opcode.toString(16).padStart(4, '0')} | ${instructionName.padEnd(25, ' ')} | ${operandsHex || '(no operands)'}`)
    if (disassembly) {
      lines.push(`         | ${disassembly}`)
    }
  }
  
  lines.push('')
  lines.push('=' .repeat(80))
  lines.push('END OF DISASSEMBLY')
  lines.push('=' .repeat(80))
  
  // Write to file
  const outputPath = path.join(WORKSPACE_ROOT, 'program-disassembly.txt')
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8')
  
  logger.info('Disassembly written to file', {
    path: outputPath,
    lineCount: lines.length,
  })
}

describe('Accumulation Gas Debug Tests', () => {
  let configService: ConfigService
  let accumulationService: AccumulationService
  let validatorSetManager: ValidatorSetManager
  let testData: TestVectorData

  beforeEach(async () => {
    configService = new ConfigService('tiny')
    const eventBusService = new EventBusService()
    const clockService = new ClockService({
      configService: configService,
      eventBusService: eventBusService,
    })
    const entropyService = new EntropyService(eventBusService)

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

    const authQueueService = new AuthQueueService({
      configService,
    })

    const readyService = new ReadyService({
      configService: configService,
    })

    const privilegesService = new PrivilegesService({
      configService,
    })

    const serviceAccountsService = new ServiceAccountService({
      configService,
      eventBusService,
      clockService,
      networkingService: null,
      preimageRequestProtocol: null,
    })

    const hostFunctionRegistry = new HostFunctionRegistry(serviceAccountsService, configService)
    const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(configService)
    const accumulatePVM = new AccumulatePVM({
      hostFunctionRegistry,
      accumulateHostFunctionRegistry,
      configService: configService,
      entropyService: entropyService,
      pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) }, // Use config's maxBlockGas (20M)
      useWasm: true,
    })

    const statisticsService = new StatisticsService({
      eventBusService: eventBusService,
      configService: configService,
      clockService: clockService,
    })

    accumulationService = new AccumulationService({
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

    // Load test data
    testData = loadTestVectorData()
  })

  test('should execute accumulation with correct gas usage', async () => {
    const { codeHash, preimageBlob, payload, expectedGasUsed, serviceBalance, minItemGas, minMemoGas } = testData

    // Calculate codehash to verify it matches
    const [hashError, calculatedCodeHash] = blake2bHash(preimageBlob)
    if (hashError || !calculatedCodeHash) {
      throw new Error('Failed to calculate code hash')
    }

    expect(calculatedCodeHash).toBe(codeHash)

    // Parse and write disassembled instructions to file
    logger.info('Parsing program and writing disassembly...')
    parseAndWriteInstructions(preimageBlob, codeHash)

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

    const gas = 1000n // Total gas available for this accumulation

    logger.info('Executing accumulation', {
      serviceId: serviceId.toString(),
      timeslot: timeslot.toString(),
      gas: gas.toString(),
      inputsCount: inputs.length,
      serviceCodeLength: preimageBlob.length,
      payloadLength: payload.length,
      codeHash,
      expectedGasUsed,
    })

    const executionStartTime = performance.now()
    const result = await accumulationService.executeAccumulateInvocation(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
    )
    const executionEndTime = performance.now()

    logger.info('Execution completed', {
      duration: `${(executionEndTime - executionStartTime).toFixed(2)}ms`,
      ok: result.ok,
    })

    // Log the result
    if (result.ok) {
      const gasUsed = result.value.gasused
      const resultCode = result.value.resultCode
      
      logger.info('Accumulation result', {
        ok: true,
        resultCode,
        gasUsed: gasUsed.toString(),
        yieldLength: result.value.yield?.length || 0,
        expectedGasUsed,
        gasRatio: expectedGasUsed > 0 ? (Number(gasUsed) / expectedGasUsed).toFixed(2) : 'N/A',
      })

      // If we got a result, log the first few bytes
      if (result.value.yield && result.value.yield.length > 0) {
        const resultPreview = Array.from(result.value.yield.slice(0, 32))
          .map((b: number) => b.toString(16).padStart(2, '0'))
          .join(' ')
        logger.info('Result preview', { resultPreview })
      }

      // Verify the result
      expect(result.ok).toBe(true)
      expect(gasUsed).toBeGreaterThan(0n)
      
      // Check if gas usage is reasonable (not the full 100k)
      // The test vector shows total gas for 9 items is 16,240, so per item ~1,800
      expect(Number(gasUsed)).toBeLessThan(10000)
      expect(Number(gasUsed)).toBeGreaterThan(100)
      
      // Log comparison with expected
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
    } else {
      logger.error('Accumulation failed', { error: result.err })
      throw new Error(`Accumulation failed: ${result.err}`)
    }
  }, { timeout: 10000 }) // 10 second timeout
})

