/**
 * AccumulatePVM Preimage Test
 * Executes AccumulatePVM using the preimage blob from accumulate_ready_queued_reports-1.json
 * 
 * This test loads the preimage blob from the test vector and executes it directly
 * using AccumulatePVM, similar to how all-programs.test.ts executes PVM programs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Hex } from 'viem'
import { hexToBytes, EventBusService, zeroHash, logger } from '@pbnj/core'
import type { PartialState, ServiceAccount, AccumulateInput } from '@pbnj/types'
import { AccumulatePVM, AccumulateHostFunctionRegistry, HostFunctionRegistry } from '../../index'
import { ConfigService } from '../../../../../infra/node/services/config-service'
import { ServiceAccountService } from '../../../../../infra/node/services/service-account-service'
import { ClockService } from '../../../../../infra/node/services/clock-service'
import { PreimageRequestProtocol } from '@pbnj/networking'
import { EntropyService } from '../../../../../infra/node/services/entropy'
import { PVMParser } from '../../parser'
import { InstructionRegistry } from '../../instructions/registry'
import { decodeProgramFromPreimage } from '../../../../codec/src/pvm'

// Test vector file path
const WORKSPACE_ROOT = process.cwd().includes('/packages/pvm')
  ? process.cwd().split('/packages/pvm')[0]
  : process.cwd()
const TEST_VECTOR_PATH = join(
  WORKSPACE_ROOT,
  'submodules',
  'jam-test-vectors',
  'stf',
  'accumulate',
  'tiny',
//   'accumulate_ready_queued_reports-1.json',
  'transfer_for_ejected_service-1.json',
)

interface TestVector {
  pre_state: {
    accounts: Array<{
      id: number
      data: {
        service: {
          code_hash: string
          balance: number
          min_item_gas: number
          min_memo_gas: number
          bytes: number
          deposit_offset: number
          items: number
          creation_slot: number
          last_accumulation_slot: number
          parent_service: number
        }
        preimages_blob: Array<{
          hash: string
          blob: string // hex string
        }>
      }
    }>
  }
}

/**
 * Execute AccumulatePVM with preimage blob from test vector
 */
async function executeAccumulateWithPreimage(): Promise<{
  ok: boolean
  err?: string
  gasUsed?: bigint
  result?: string
}> {
  // Load test vector
  const fileContents = readFileSync(TEST_VECTOR_PATH, 'utf-8')
  const testVector: TestVector = JSON.parse(fileContents)

  // Extract preimage blob from test vector
  const account = testVector.pre_state.accounts[0]
  const preimageBlob = account.data.preimages_blob[0]
  if (!preimageBlob) {
    throw new Error('No preimage blob found in test vector')
  }

  // Convert hex string to Uint8Array
  const preimageBytes = hexToBytes(preimageBlob.blob as `0x${string}`)
  const [error, decoded] = decodeProgramFromPreimage(preimageBytes)
  if (error || !decoded) {
    throw new Error(`Failed to decode program from preimage: ${error.message}`)
  }
  const { code} = decoded.value

  console.log(`Loaded preimage blob: ${preimageBytes.length} bytes`)
  console.log(`Preimage hash: ${preimageBlob.hash}`)
  console.log(`Service ID: ${account.id}`)

  // Set up services
  const configService = new ConfigService('tiny')
  const eventBusService = new EventBusService()
  const clockService = new ClockService({
    eventBusService: eventBusService,
    configService: configService,
  })
  const preimageRequestProtocol = new PreimageRequestProtocol(eventBusService)
  const serviceAccountService = new ServiceAccountService({
    configService: configService,
    eventBusService: eventBusService,
    clockService: clockService,
    networkingService: null,
    preimageRequestProtocol: preimageRequestProtocol,
  })
  const entropyService = new EntropyService(eventBusService)
  
  // Set entropy from test vector - EntropyState expects Hex strings, not Uint8Array
  entropyService.setEntropy({
    accumulator: '0xae85d6635e9ae539d0846b911ec86a27fe000f619b78bcac8a74b77e36f6dbcf' as Hex,
    entropy1: zeroHash,
    entropy2: zeroHash,
    entropy3: zeroHash,
  })

  // Create AccumulatePVM
  const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(configService)
  const hostFunctionRegistry = new HostFunctionRegistry(serviceAccountService, configService)
  const accumulatePVM = new AccumulatePVM({
    hostFunctionRegistry: hostFunctionRegistry,
    accumulateHostFunctionRegistry: accumulateHostFunctionRegistry,
    configService: configService,
    entropyService: entropyService,
    pvmOptions: { gasCounter: 1_000_000n },
  })

  // Create partial state with service account
  const serviceId = BigInt(account.id)
  const serviceAccount: ServiceAccount = {
    codehash: preimageBlob.hash as Hex,
    balance: BigInt(account.data.service.balance),
    minaccgas: BigInt(account.data.service.min_item_gas),
    minmemogas: BigInt(account.data.service.min_memo_gas),
    octets: BigInt(account.data.service.bytes),
    gratis: 0n,
    items: BigInt(account.data.service.items),
    created: BigInt(account.data.service.creation_slot),
    lastacc: BigInt(account.data.service.last_accumulation_slot),
    parent: BigInt(account.data.service.parent_service),
    storage: new Map(),
    preimages: new Map([[preimageBlob.hash as Hex, preimageBytes]]), // Store preimage blob
    requests: new Map(),
  }

  const partialState: PartialState = {
    accounts: new Map([[serviceId, serviceAccount]]),
    authqueue: [],
    assigners: [],
    stagingset: [],
    manager: 0n,
    registrar: 0n,
    delegator: 0n,
    alwaysaccers: new Map(),
  }

  // Prepare accumulate inputs (empty for this test)
  const inputs: AccumulateInput[] = []

  const registry = new InstructionRegistry()
  const parser = new PVMParser()
  const parseResult = parser.parseProgram(code)

  //store to file instead of simply logging
  const instructionsText = parseResult.instructions
    .map(i => `${registry.getHandler(i.opcode)?.name} (${i.opcode}) operands: ${i.operands.join(', ')} pc: ${i.pc}`)
    .join('\n')
  writeFileSync('./instructions.txt', instructionsText)

  logger.info('instructions:', { instructions: parseResult.instructions.map(i => `${registry.getHandler(i.opcode)?.name} (${i.opcode}) operands: ${i.operands.join(', ')} pc: ${i.pc}`) })
    

  // Execute accumulate invocation
  const timeslot = 43n // From test vector input.slot
  const gas = 100_000n // From test vector results[0].accumulate_gas
  const result = await accumulatePVM.executeAccumulate(
    partialState,
    timeslot,
    serviceId,
    gas,
    inputs,
  )

  return {
    ok: result.ok,
    err: result.ok ? undefined : result.err,
    gasUsed: result.ok ? result.value.gasused : undefined,
    result: result.ok ? 'OK' : result.err,
  }
}

// Execute the test
console.log('Executing AccumulatePVM with preimage blob from accumulate_ready_queued_reports-1.json...')

try {
  const result = await executeAccumulateWithPreimage()
  console.log('\n✅ Test completed:')
  console.log(`  Result: ${result.ok ? 'OK' : 'FAILED'}`)
  if (result.err) {
    console.log(`  Error: ${result.err}`)
  }
  if (result.gasUsed !== undefined) {
    console.log(`  Gas Used: ${result.gasUsed.toString()}`)
  }
  process.exit(result.ok ? 0 : 1)
} catch (error) {
  console.error('\n❌ Test failed with error:')
  console.error(error)
  process.exit(1)
}

