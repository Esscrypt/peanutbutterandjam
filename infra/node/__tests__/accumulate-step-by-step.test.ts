/**
 * Accumulation Step-by-Step Execution Test
 * 
 * This test sets up accumulateInvocation and executes step-by-step to get
 * detailed execution dumps similar to riscv-programs.test.ts
 */

import { logger, hexToBytes, blake2bHash } from '@pbnj/core'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { type PartialState, type ServiceAccount, type ImplicationsPair, type Implications } from '@pbnj/types'
import { ConfigService } from '../services/config-service'
import { encodeImplicationsPair } from '@pbnj/codec'
import { decodeProgramFromPreimage } from '@pbnj/codec'
import { describe, expect, beforeEach, test } from 'bun:test'
import type { Hex } from 'viem'
import { instantiate } from '../../../packages/pvm-assemblyscript/tests/wasmAsInit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PVMParser, InstructionRegistry } from '@pbnj/pvm'
import { mkdirSync, writeFileSync } from 'node:fs'

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
  const testVectorContent = fs.readFileSync(TEST_VECTOR_PATH, 'utf-8')
  const testVector = JSON.parse(testVectorContent)
  
  const serviceAccount = testVector.pre_state.accounts.find(
    (acc: any) => acc.id === 1729
  )
  
  if (!serviceAccount) {
    throw new Error('Service account 1729 not found in test vector')
  }
  
  const codeHash = serviceAccount.data.service.code_hash as Hex
  
  const preimageEntry = serviceAccount.data.preimages_blob.find(
    (entry: any) => entry.hash === codeHash
  )
  
  if (!preimageEntry) {
    throw new Error(`Preimage not found for code hash ${codeHash}`)
  }
  
  const preimageBlob = hexToBytes(preimageEntry.blob as Hex)
  
  const firstQueueItem = testVector.pre_state.ready_queue[0][0]
  const payloadHash = firstQueueItem.report.results[0].payload_hash as Hex
  
  const expectedStats = testVector.post_state.statistics.find(
    (stat: any) => stat.id === 1729
  )
  const expectedGasUsed = expectedStats?.record?.accumulate_gas_used || 0
  
  const payload = hexToBytes(payloadHash)
  
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
 */
function encodeAccumulateArgs(timeslot: bigint, serviceId: bigint, inputLength: bigint): Uint8Array {
  const parts: Uint8Array[] = []
  
  const timeslotBytes = new Uint8Array(4)
  const timeslotView = new DataView(timeslotBytes.buffer)
  timeslotView.setUint32(0, Number(timeslot), true)
  parts.push(timeslotBytes)
  
  const serviceIdBytes = new Uint8Array(4)
  const serviceIdView = new DataView(serviceIdBytes.buffer)
  serviceIdView.setUint32(0, Number(serviceId), true)
  parts.push(serviceIdBytes)
  
  const inputLengthBytes = new Uint8Array(4)
  const inputLengthView = new DataView(inputLengthBytes.buffer)
  inputLengthView.setUint32(0, Number(inputLength), true)
  parts.push(inputLengthBytes)
  
  return new Uint8Array(Buffer.concat(parts))
}

describe('Accumulation Step-by-Step Execution', () => {
  let configService: ConfigService
  let testData: TestVectorData
  let wasm: any

  beforeEach(async () => {
    configService = new ConfigService('tiny')
    testData = loadTestVectorData()
    
    const wasmPath = join(WORKSPACE_ROOT, 'packages', 'pvm-assemblyscript', 'build', 'debug.wasm')
    const wasmBytes = readFileSync(wasmPath)
    wasm = await instantiate(wasmBytes, {})
    
    wasm.init(wasm.RAMType.PVMRAM)
  })

  test('should execute accumulation step-by-step and generate execution dump', async () => {
    const { codeHash, preimageBlob, payload, serviceBalance, minItemGas, minMemoGas } = testData

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

    // Create partial state and implications
    const serviceId = 1729n
    const preimages = new Map([[codeHash, preimageBlob]])
    
    const numValidators = configService.numValidators
    const stagingset: Uint8Array[] = []
    for (let i = 0; i < numValidators; i++) {
      const validatorKey = new Uint8Array(336)
      validatorKey.fill(0)
      stagingset.push(validatorKey)
    }
    
    const numCores = configService.numCores
    const authQueueSize = 80
    const authqueue: Uint8Array[][] = []
    for (let i = 0; i < numCores; i++) {
      authqueue.push(new Array(authQueueSize).fill(null).map(() => new Uint8Array(32)))
    }
    
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

    const initialImplications: Implications = {
      id: serviceId,
      state: partialState,
      nextfreeid: serviceId + 1n,
      xfers: [],
      yield: null,
      provisions: new Map(),
    }

    const implicationsPair: ImplicationsPair = [initialImplications, initialImplications]

    // Encode context and args
    const [contextError, encodedContext] = encodeImplicationsPair(implicationsPair, configService)
    if (contextError || !encodedContext) {
      throw new Error(`Failed to encode context: ${contextError?.message}`)
    }

    const timeslot = 43n
    const inputLength = 1n
    const encodedArgs = encodeAccumulateArgs(timeslot, serviceId, inputLength)
    const gasLimit = 100000

    // Set up accumulateInvocation without running to completion
    // Use setupAccumulateInvocation which does all the setup but doesn't call run()
    wasm.setupAccumulateInvocation(gasLimit, preimageBlob, encodedArgs, encodedContext, numCores, numValidators, authQueueSize)
    
    // Get the decoded code blob to parse instructions
    const codeBlob = decodedPreimage.value.code
    
    // Parse program to get instruction info
    const parser = new PVMParser()
    const registry = new InstructionRegistry()
    const parseResult = parser.parseProgram(codeBlob)
    
    // Create instruction lookup by PC
    const instructionMap = new Map<number, { name: string; opcode: string; operands: number[] }>()
    if (parseResult.success) {
      for (const inst of parseResult.instructions) {
        const pc = Number(inst.pc)
        const handler = registry.getHandler(BigInt(inst.opcode))
        instructionMap.set(pc, {
          name: handler?.name || `UNKNOWN_${inst.opcode}`,
          opcode: `0x${Number(inst.opcode).toString(16)}`,
          operands: Array.from(inst.operands),
        })
      }
    }
    
    // Note: We can't easily set accumulationContext from outside the PVM
    // So we'll create a modified accumulateInvocation that stops before run(null)
    // For now, let's create a helper that does the setup

    // Status map
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

    // Verify initial state after setup
    const initialPC = wasm.getProgramCounter()
    const initialGas = wasm.getGasLeft()
    const initialStatus = wasm.getStatus()
    
    logger.info('Initial state after setup', {
      pc: initialPC,
      gas: initialGas,
      status: statusMap[initialStatus] || 'unknown',
    })
    
    expect(initialPC).toBe(5) // Accumulate starts at PC = 5
    expect(initialGas).toBe(gasLimit)

    // Execute step-by-step
    const executionTrace: Array<{
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
    const finalRegisters = wasm.getRegisters()
    const finalPC = wasm.getProgramCounter()
    const finalGas = wasm.getGasLeft()
    const finalStatus = wasm.getStatus()
    const gasUsed = gasLimit - finalGas

    logger.info('Step-by-step execution completed', {
      totalSteps: step,
      finalPC,
      finalGas,
      gasUsed,
      finalStatus: statusMap[finalStatus] || 'unknown',
    })

    // Create execution dump
    const executionDump = {
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
        gasUsed,
        finalStatus: statusMap[finalStatus] || 'unknown',
        executionTrace,
      },
      parsedProgram: parseResult.success ? {
        programInfo: {
          codeLength: parseResult.codeLength,
          jumpTableSize: parseResult.jumpTable.length,
          bitmaskLength: parseResult.bitmask.length,
          instructionsCount: parseResult.instructions.length,
        },
        instructions: parseResult.instructions.map((inst, index) => {
          const handler = registry.getHandler(BigInt(inst.opcode))
          return {
            index,
            pc: inst.pc.toString(),
            pcHex: `0x${inst.pc.toString(16)}`,
            opcode: inst.opcode.toString(),
            opcodeHex: `0x${inst.opcode.toString(16)}`,
            name: handler?.name || `UNKNOWN_${inst.opcode}`,
            operands: Array.from(inst.operands).map(b => `0x${b.toString(16).padStart(2, '0')}`),
            fskip: inst.fskip,
          }
        }),
        jumpTable: parseResult.jumpTable.map((target, index) => ({
          index,
          target: target.toString(),
          targetHex: `0x${target.toString(16)}`,
        })),
      } : {
        instructions: [],
        jumpTable: [],
        parseErrors: parseResult.errors,
      },
      finalRegisters: decodeRegisters(finalRegisters),
    }

    // Save dump to file
    const dumpDir = join(WORKSPACE_ROOT, 'infra', 'node', '__tests__', 'accumulate-execution-dumps')
    mkdirSync(dumpDir, { recursive: true })
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `accumulate-execution-${timestamp}.json`
    const filepath = join(dumpDir, filename)
    
    writeFileSync(
      filepath,
      JSON.stringify(executionDump, (_key, value) => {
        if (typeof value === 'bigint') {
          return value.toString()
        }
        return value
      }, 2),
      'utf-8',
    )

    logger.info(`Execution dump saved to: ${filepath}`)

    // Verify execution completed
    expect(finalStatus).toBeDefined()
    expect(executionTrace.length).toBeGreaterThan(0)
  }, { timeout: 60000 })
})

