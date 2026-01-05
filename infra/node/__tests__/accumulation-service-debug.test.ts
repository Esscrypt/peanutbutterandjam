/**
 * Accumulation Service Debug Test
 * 
 * This test directly uses the AccumulationService to debug the fetch host function issue
 */

import { EventBusService, logger, hexToBytes, blake2bHash, bytesToHex} from '@pbnjam/core'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { type AccumulateInput, type PartialState, type ServiceAccount } from '@pbnjam/types'
import { ConfigService } from '../services/config-service'
import { ClockService } from '../services/clock-service'
import { ValidatorSetManager } from '../services/validator-set'
import { ServiceAccountService } from '../services/service-account-service'
import { AccumulationService } from '../services/accumulation-service'
import { AuthQueueService } from '../services/auth-queue-service'
import { ReadyService } from '../services/ready-service'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'
import { HostFunctionRegistry } from '@pbnjam/pvm'
import { AccumulateHostFunctionRegistry } from '@pbnjam/pvm'
import { describe, expect, beforeEach, test } from 'bun:test'
import { StateService } from '../services/state-service'
import { TicketService } from '../services/ticket-service'
import { AuthPoolService } from '../services/auth-pool-service'
import { StatisticsService } from '../services/statistics-service'
import { DisputesService } from '../services/disputes-service'
import { WorkReportService } from '../services/work-report-service'
import { PrivilegesService } from '../services/privileges-service'
import { RecentHistoryService } from '../services/recent-history-service'  
import { RingVRFProverWasm, RingVRFVerifierWasm } from '@pbnjam/bandersnatch-vrf'
import { EntropyService } from '../services/entropy'
import { NodeGenesisManager } from '../services/genesis-manager'
import { SealKeyService } from '../services/seal-key'
import { decodeProgramFromPreimage } from '@pbnjam/codec'
import { PVMParser } from '@pbnjam/pvm'
import { InstructionRegistry } from '@pbnjam/pvm'

  /**
 * Load the preimage from the test vector file
 * 
 * The test vector file contains a preimage with hash 0x483be53243cb07d50beae39059e765a05d7f529868c1923815df49d5f5bbbdee
 * This preimage is stored in the pre-state keyvals with key 0x008e00200007009363619235b9fdd711cfc47ca834f2000f95bc7ab94b0e9d
 */

  const WORKSPACE_ROOT = process.cwd().includes('/packages/pvm')
  ? process.cwd().split('/packages/pvm')[0]
  : process.cwd()
  const TEST_VECTOR_PATH = path.join(
    WORKSPACE_ROOT,
    'submodules',
    'jam-test-vectors',
    'traces',
    'storage',
    '00000001.json'
  )
function loadPreimageFromTestVector(): Uint8Array {
  // Read the test vector file
  const testVectorContent = fs.readFileSync(TEST_VECTOR_PATH, 'utf-8')
  const testVector = JSON.parse(testVectorContent)
  
  // Find the preimage in the pre-state keyvals
  const preimageKey = '0x008e00200007009363619235b9fdd711cfc47ca834f2000f95bc7ab94b0e9d'
  const preimageEntry = testVector.pre_state.keyvals.find(
    (kv: { key: string; value: string }) => kv.key === preimageKey
  )
  
  if (!preimageEntry) {
    throw new Error(`Preimage not found with key ${preimageKey}`)
  }
  
  // Convert the preimage value from hex to bytes
  const preimageValue = preimageEntry.value
  logger.info('Found preimage in test vector', {
    key: preimageKey,
    valueLength: preimageValue.length,
  })
  
  return hexToBytes(preimageValue)
}

describe('Accumulation Service Debug Tests', () => {
  let configService: ConfigService
  let stateService: StateService
  let accumulatedService: AccumulationService

  beforeEach(async () => {
    configService = new ConfigService('tiny')
    const eventBusService = new EventBusService()
    const clockService = new ClockService({
      configService: configService,
      eventBusService: eventBusService,
    })
    const entropyService = new EntropyService(eventBusService)
    const genesisJsonPath = path.join(
      WORKSPACE_ROOT,
      'submodules',
      'jam-test-vectors',
      'traces',
      'preimages',
      'genesis.json',
    )

    const genesisManager = new NodeGenesisManager(configService, {
      genesisJsonPath,
    })

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

    // Verify genesis JSON was loaded
    const [error, genesisJson] = genesisManager.getGenesisJson()
    expect(error).toBeUndefined()
    expect(genesisJson).toBeDefined()

    if (!genesisJson) {
      throw new Error('Genesis JSON not loaded')
    }

    const ticketService = new TicketService({
      configService: configService,
      eventBusService: eventBusService,
      keyPairService: null,
      entropyService: entropyService,
      networkingService: null,
      ce131TicketDistributionProtocol: null,
      ce132TicketDistributionProtocol: null,
      clockService: clockService,
      prover: ringProver,
      ringVerifier: ringVerifier,
      validatorSetManager: null,
    })
    const sealKeyService = new SealKeyService({
      configService,
      eventBusService,
      entropyService,
      ticketService,
    })

    // Extract validators from genesis.json header
    const initialValidators = genesisJson.header?.epoch_mark?.validators || []

  const validatorSetManager = new ValidatorSetManager({
      eventBusService,
      sealKeyService,
      ringProver,
      ticketService,
      configService,
      initialValidators: initialValidators.map((validator) => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
        bls: bytesToHex(new Uint8Array(144)), // Gray Paper: BLS key must be 144 bytes
        metadata: bytesToHex(new Uint8Array(128)),
      })),
    })
    
    ticketService.setValidatorSetManager(validatorSetManager)

    const authQueueService = new AuthQueueService({
      configService,
    })

    const disputesService = new DisputesService({
      eventBusService: eventBusService,
      configService: configService,
      validatorSetManagerService: validatorSetManager,
    })
    const readyService = new ReadyService({
      configService: configService,
    })

    const workReportService = new WorkReportService({
      eventBus: eventBusService,
      networkingService: null,
      ce136WorkReportRequestProtocol: null,
      validatorSetManager: validatorSetManager,
      configService: configService,
      entropyService: entropyService,
      clockService: clockService,
    })

    const authPoolService = new AuthPoolService({
      configService,
      eventBusService: eventBusService,
      workReportService: workReportService,
      authQueueService: authQueueService,
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
      pvmOptions: { gasCounter: 1_000n },
    })


    const statisticsService = new StatisticsService({
      eventBusService: eventBusService,
      configService: configService,
      clockService: clockService,
    })

    accumulatedService = new AccumulationService({
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
          
    const recentHistoryService = new RecentHistoryService({
      eventBusService: eventBusService,
      configService: configService,
      accumulationService: accumulatedService,
    })


    stateService = new StateService({
      configService,
      genesisManagerService: genesisManager,
      validatorSetManager: validatorSetManager,
      entropyService: entropyService,
      ticketService: ticketService,
      authQueueService: authQueueService,
      authPoolService: authPoolService,
      statisticsService: statisticsService,
      disputesService: disputesService,
      readyService: readyService,
      accumulationService: accumulatedService,
      workReportService: workReportService,
      privilegesService: privilegesService,
      serviceAccountsService: serviceAccountsService,
      recentHistoryService: recentHistoryService,
      sealKeyService: sealKeyService,
      clockService: clockService,
    })

  })


  test('should execute accumulation with actual preimage service code', async () => {
    // Load the actual preimage from the test vector
    const serviceCode = loadPreimageFromTestVector()

    // Calculate codehash for the service code
    const [hashError, codeHash] = blake2bHash(serviceCode)
    if (hashError || !codeHash) {
      throw new Error('Failed to calculate code hash')
    }

    // parse the program from the service code
    const [error, program] = decodeProgramFromPreimage(serviceCode)
    if (error) {
      throw new Error('Failed to decode program from preimage')
    }
    const { code } = program.value
    const pvmParser = new PVMParser()
    const parseResult = pvmParser.parseProgram(code)
    if (!parseResult.success) {
      throw new Error('Failed to parse program')
    }
    const registry = new InstructionRegistry()
    // all instructions to file
    fs.writeFileSync('instructions.txt', parseResult.instructions.map(i => `${registry.getHandler(i.opcode)?.name} (${i.opcode}) operands: ${i.operands.join(', ')} pc: ${i.pc}`).join('\n'))
    // Create a minimal partial state with our service
    // AccumulatePVM expects the code to be in preimages map, keyed by codehash
    const serviceId = 1n
    const preimages = new Map([[codeHash, serviceCode]])
    const partialState: PartialState = {
      accounts: new Map([
        [
          serviceId,
          {
            codehash: codeHash,
            balance: 0n,
            minaccgas: 0n,
            minmemogas: 0n,
            octets: 0n,
            gratis: 0n,
            items: 0n,
            created: 0n,
            lastacc: 0n,
            parent: 0n,
            preimages: preimages,
            requests: new Map(),
            storage: new Map(),
          } as ServiceAccount,
        ],
      ]),
      authqueue: [],
      assigners: [],
      stagingset: [],
      manager: 0n,
      registrar: 0n,
      delegator: 0n,
      alwaysaccers: new Map(),
    }

    // Execute accumulation
    const timeslot = 1n
    const inputs: AccumulateInput[] = [] // No inputs for this test
    const gas = 100000n

    logger.info('Executing accumulation', {
      serviceId: serviceId.toString(),
      timeslot: timeslot.toString(),
      gas: gas.toString(),
      serviceCodeLength: serviceCode.length,
      codeHash,
    })

    const result = await accumulatedService.executeAccumulateInvocation(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
    )

    // Log the result
    if (result.ok) {
        logger.info('Accumulation succeeded', {
          gasUsed: result.value.gasused.toString(),
          result: result.value.yield ? 'Has result' : 'No result',
          resultLength: result.value.yield?.length,
        })

      // If we got a result, log the first few bytes
      if (result.value.yield && result.value.yield.length > 0) {
        const resultPreview = Array.from(result.value.yield.slice(0, 16))
          .map((b: number) => b.toString(16).padStart(2, '0'))
          .join(' ')
        logger.info('Result preview', { resultPreview })
      }
    } else {
      logger.error('Accumulation failed', { error: result.err })
    }

    // Verify the result
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.gasused).toBeGreaterThan(0n)
    expect(result.value.yield).toBeDefined()
    expect(result.value.yield?.length).toBeGreaterThan(0)
  })
})
