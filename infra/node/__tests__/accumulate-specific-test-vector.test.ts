import { describe, it, expect } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Hex } from 'viem'
import type { 
  Accumulated,
  ServiceAccount, 
  AccumulateTestVector,
  Ready,
  ReadyItem,
  WorkReport,
  PreimageRequestStatus,
} from '@pbnj/types'
import { ConfigService } from '../services/config-service'
import { HostFunctionRegistry, AccumulateHostFunctionRegistry } from '@pbnj/pvm'
import { AccumulatePVM } from '@pbnj/pvm-invocations'
import { hexToBytes, zeroHash } from '../../../packages/core/src/utils/crypto'
import { ServiceAccountService } from '../services/service-account-service'
import { EventBusService } from '@pbnj/core'
import { ClockService } from '../services/clock-service'
import { PreimageRequestProtocol } from '@pbnj/networking'
import { AccumulationService } from '../services/accumulation-service'
import { ReadyService } from '../services/ready-service'
import { EntropyService } from '../services/entropy'
import { StatisticsService } from '../services/statistics-service'
import { AuthQueueService } from '../services/auth-queue-service'
import { ValidatorSetManager } from '../services/validator-set'
import { PrivilegesService } from '../services/privileges-service'
import { RingVRFProverWasm, RingVRFVerifierWasm } from '@pbnj/bandersnatch-vrf'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../')

// Mock config services for tiny and full test vectors
const tinyConfigService = new ConfigService('tiny')
const fullConfigService = new ConfigService('full')

// Module-level flag to stop execution on first failure
let shouldStopOnFailure = false

// Get test vector name from CLI argument: bun test <file> -- <test-vector-name>
// Example: bun test accumulate-specific-test-vector.test.ts -- accumulate_ready_queued_reports-1
const args = process.argv.slice(2)
const testVectorArg = args.find((arg) => !arg.startsWith('-'))
const SPECIFIC_TEST_VECTOR: string | null = testVectorArg || null

console.log('Test execution settings:')
console.log(`  Specific test vector: ${SPECIFIC_TEST_VECTOR || 'ALL'}`)
console.log(`  Args: ${JSON.stringify(args)}`)

/**
 * Load all test vector JSON files from the directory for a given configuration
 */
function loadTestVectors(
  config: 'tiny' | 'full',
): Array<{ name: string; vector: AccumulateTestVector }> {
  const testVectorsDir = path.join(
    WORKSPACE_ROOT,
    `submodules/jam-test-vectors/stf/accumulate/${config}`,
  )

  const files = fs.readdirSync(testVectorsDir)
  const jsonFiles = files.filter((file) => file.endsWith('.json'))

  const allVectors = jsonFiles.map((file) => {
    const filePath = path.join(testVectorsDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const vector = JSON.parse(content) as AccumulateTestVector

    return {
      name: file.replace('.json', ''),
      vector,
    }
  })

  // Filter by specific test vector name if specified
  if (SPECIFIC_TEST_VECTOR) {
    return allVectors.filter((v) => v.name === SPECIFIC_TEST_VECTOR)
  }

  return allVectors
}

// Helper function to convert JSON numbers to bigints for WorkReport
function convertJsonReportToWorkReport(jsonReport: any): WorkReport {
  return {
    ...jsonReport,
    core_index: BigInt(jsonReport.core_index || 0),
    auth_gas_used: BigInt(jsonReport.auth_gas_used || 0),
    context: {
      ...jsonReport.context,
      lookup_anchor_slot: BigInt(jsonReport.context.lookup_anchor_slot || 0),
    },
    results: jsonReport.results.map((r: any) => ({
      ...r,
      service_id: BigInt(r.service_id || 0),
      accumulate_gas: BigInt(r.accumulate_gas || 0),
      refine_load: {
        ...r.refine_load,
        gas_used: BigInt(r.refine_load.gas_used || 0),
        imports: BigInt(r.refine_load.imports || 0),
        extrinsic_count: BigInt(r.refine_load.extrinsic_count || 0),
        extrinsic_size: BigInt(r.refine_load.extrinsic_size || 0),
        exports: BigInt(r.refine_load.exports || 0),
      },
    })),
  }
}

describe('Accumulate Test Vector Execution', () => {
  // Test both tiny and full configurations
  for (const configType of ['tiny', 'full'] as const) {
    describe(`Configuration: ${configType}`, () => {
      const configService = configType === 'tiny' ? tinyConfigService : fullConfigService
      const testVectors = loadTestVectors(configType)

      // Test each vector sequentially, stopping on first failure
      for (const { name, vector } of testVectors) {
        describe(`Test Vector: ${name}`, () => {
          it(
            'should correctly transition accumulation state',
            async () => {
              // Skip if a previous test failed
              if (shouldStopOnFailure) {
                return
              }
              
              try {
            const testStartTime = performance.now()
            console.log(`\n[${name}] Test started at ${new Date().toISOString()}`)
            
            // Create services
            const servicesStartTime = performance.now()
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
            const statisticsService = new StatisticsService({
              configService: configService,
              eventBusService: eventBusService,
              clockService: clockService,
            })
            const entropyService = new EntropyService(eventBusService)
            const readyService = new ReadyService({ configService: configService })
            const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(configService)
            const pvm = new AccumulatePVM({
              hostFunctionRegistry: new HostFunctionRegistry(serviceAccountService, configService),
              accumulateHostFunctionRegistry: accumulateHostFunctionRegistry,
              configService: configService,
              entropyService: entropyService,
              pvmOptions: { gasCounter: 10000n },
              useWasm: true,
            })
            const privilegesService = new PrivilegesService({
              configService: configService,
            })

            const srsFilePath = path.join(
              WORKSPACE_ROOT,
              'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
            )
            const ringProver = new RingVRFProverWasm(srsFilePath)
            const ringVerifier = new RingVRFVerifierWasm(srsFilePath)
            await ringProver.init()
            await ringVerifier.init()
            const validatorSetManager = new ValidatorSetManager({
              eventBusService: eventBusService,
              sealKeyService: null,
              ringProver: ringProver,
              ticketService: null,
              initialValidators: null,
              configService: configService,
            })
            const authQueueService = new AuthQueueService({
              configService: configService,
            })
            const accumulationService = new AccumulationService({
              configService: configService,
              clockService: clockService,
              serviceAccountsService: serviceAccountService,
              privilegesService: privilegesService,
              validatorSetManager: validatorSetManager,
              authQueueService: authQueueService,
              accumulatePVM: pvm,
              readyService: readyService,
              statisticsService: statisticsService,
              // entropyService: entropyService,
            })


            const servicesEndTime = performance.now()
            console.log(`[${name}] Services initialized in ${(servicesEndTime - servicesStartTime).toFixed(2)}ms`)
            
            // Set up pre-state
            const preStateStartTime = performance.now()
            entropyService.setEntropy({
              accumulator: vector.pre_state.entropy as Hex,
              entropy1: zeroHash,
              entropy2: zeroHash,
              entropy3: zeroHash,
            })

            // Initialize pre_state
            // Note: Clock service slot is managed internally, we don't need to set it explicitly

            // Set service accounts from pre_state.accounts
            const accounts = convertToAccounts(vector.pre_state.accounts)
            for (const [serviceId, account] of accounts) {
              serviceAccountService.setServiceAccount(serviceId, account)
            }

            // Set ready queue from pre_state.ready_queue
            const readyQueue = convertToReady(
              vector.pre_state.ready_queue,
              vector.pre_state.slot,
              configService.epochDuration,
            )
            readyService.setReady(readyQueue)

            // Set accumulated from pre_state.accumulated
            const accumulated = convertToAccumulated(vector.pre_state.accumulated)
            accumulationService.setAccumulated(accumulated)

            // Set lastProcessedSlot from pre_state
            accumulationService.setLastProcessedSlot(BigInt(vector.pre_state.slot))

            // Convert input.reports to WorkReport[]
            const reports = vector.input.reports.map(convertJsonReportToWorkReport)

            const preStateEndTime = performance.now()
            console.log(`[${name}] Pre-state setup in ${(preStateEndTime - preStateStartTime).toFixed(2)}ms`)
            console.log(`[${name}] Total setup time: ${(preStateEndTime - testStartTime).toFixed(2)}ms`)
            console.log(`[${name}] Ready queue size: ${vector.pre_state.ready_queue.reduce((sum, slot) => sum + slot.length, 0)} items`)
            console.log(`[${name}] Input reports: ${vector.input.reports.length}`)
            
            // Apply transition
            const transitionStartTime = performance.now()
            console.log(`[${name}] Starting applyTransition...`)
            const result = await accumulationService.applyTransition(
              BigInt(vector.input.slot),
              reports,
            )
            const transitionEndTime = performance.now()
            console.log(`[${name}] applyTransition completed in ${(transitionEndTime - transitionStartTime).toFixed(2)}ms`)

            // Verify result
            const verificationStartTime = performance.now()
            if (vector.output.err !== undefined && vector.output.err !== null) {
              expect(result.ok).toBe(false)
              if (!result.ok && result.err) {
                const errorMessage =
                  result.err instanceof Error ? result.err.message : String(result.err)
                expect(errorMessage).toBe(vector.output.err)
              }
              return
            }

            if (!result.ok) {
              const errorMessage =
                result.err instanceof Error ? result.err.message : String(result.err)
              console.error('applyTransition failed:', errorMessage)
              if (result.err instanceof Error && result.err.stack) {
                console.error('Stack trace:', result.err.stack)
              }
            }
            expect(result.ok).toBe(true)

            // Verify post_state
            // 1. Verify ready_queue - exact match
            const postReady = accumulationService.getReady()
            const expectedReady = convertToReady(
              vector.post_state.ready_queue,
              vector.post_state.slot,
              configService.epochDuration,
            )
            expect(postReady.epochSlots.length).toBe(expectedReady.epochSlots.length)
            for (let i = 0; i < postReady.epochSlots.length; i++) {
              const postSlot = postReady.epochSlots[i]
              const expectedSlot = expectedReady.epochSlots[i]
              if (postSlot.length !== expectedSlot.length) {
                console.error(`Slot ${i} mismatch: expected ${expectedSlot.length}, got ${postSlot.length}`)
                console.error(`Expected slot ${i}:`, expectedSlot.map(item => ({
                  package: item.workReport.package_spec.hash.slice(0, 40),
                  deps: Array.from(item.dependencies).map(d => d.slice(0, 20))
                })))
                console.error(`Actual slot ${i}:`, postSlot.map(item => ({
                  package: item.workReport.package_spec.hash.slice(0, 40),
                  deps: Array.from(item.dependencies).map(d => d.slice(0, 20))
                })))
              }
              expect(postSlot.length).toBe(expectedSlot.length)
              
              // Sort items by package hash for comparison
              const hashComparator = (a: ReadyItem, b: ReadyItem): number =>
                a.workReport.package_spec.hash.localeCompare(b.workReport.package_spec.hash)
              
              const postSorted = [...postSlot].sort(hashComparator)
              const expectedSorted = [...expectedSlot].sort(hashComparator)
              
              // Compare each item exactly
              for (let j = 0; j < postSorted.length; j++) {
                const postItem = postSorted[j]
                const expectedItem = expectedSorted[j]
                
                // Compare package hash
                expect(postItem.workReport.package_spec.hash).toBe(
                  expectedItem.workReport.package_spec.hash
                )
                
                // Compare dependencies (as sorted arrays)
                const postDeps = Array.from(postItem.dependencies).sort()
                const expectedDeps = Array.from(expectedItem.dependencies).sort()
                expect(postDeps).toEqual(expectedDeps)
              }
            }

            // 2. Verify accumulated
            const postAccumulated = accumulationService.getAccumulated()
            const expectedAccumulated = convertToAccumulated(vector.post_state.accumulated)
            expect(postAccumulated.packages.length).toBe(expectedAccumulated.packages.length)
            for (let i = 0; i < postAccumulated.packages.length; i++) {
              const postPackages = Array.from(postAccumulated.packages[i]).sort()
              const expectedPackages = Array.from(expectedAccumulated.packages[i]).sort()
              if (postPackages.length !== expectedPackages.length) {
                console.error(`\nAccumulated packages mismatch at slot ${i}:`)
                console.error(`Expected ${expectedPackages.length} packages, got ${postPackages.length}`)
                console.error(`Expected packages:`, expectedPackages)
                console.error(`Actual packages:`, postPackages)
                console.error(`\nTest vector: ${name}`)
                console.error(`Input slot: ${vector.input.slot}`)
                console.error(`Pre-state slot: ${vector.pre_state.slot}`)
                console.error(`Number of input reports: ${vector.input.reports.length}`)
                console.error(`Ready queue size: ${vector.pre_state.ready_queue.reduce((sum, slot) => sum + slot.length, 0)}`)
              }
              expect(postPackages).toEqual(expectedPackages)
            }

            // 3. Verify accounts
            const postAccounts = serviceAccountService.getServiceAccounts()
            const expectedAccounts = convertToAccounts(vector.post_state.accounts)
            for (const [serviceId, expectedAccount] of expectedAccounts) {
              const postAccount = postAccounts.accounts.get(serviceId)
              expect(postAccount).toBeDefined()
              if (postAccount) {
                expect(postAccount.codehash).toBe(expectedAccount.codehash)
                expect(postAccount.balance).toBe(expectedAccount.balance)
                expect(postAccount.lastacc).toBe(expectedAccount.lastacc)
              }
            }

            const verificationEndTime = performance.now()
            const testEndTime = performance.now()
            console.log(`[${name}] Verification completed in ${(verificationEndTime - verificationStartTime).toFixed(2)}ms`)
            console.log(`[${name}] Total test time: ${(testEndTime - testStartTime).toFixed(2)}ms`)
            console.log(`[${name}] Breakdown:`)
            console.log(`  - Setup: ${(preStateEndTime - testStartTime).toFixed(2)}ms`)
            console.log(`  - Transition: ${(transitionEndTime - transitionStartTime).toFixed(2)}ms`)
            console.log(`  - Verification: ${(verificationEndTime - verificationStartTime).toFixed(2)}ms`)
              } catch (error) {
                // Mark that we should stop on first failure
                shouldStopOnFailure = true
                throw error
              }
            },
            { timeout: 60000 }
          )
        })
      }
    })
  }
})

function convertToAccounts(accounts: AccumulateTestVector['pre_state']['accounts']): Map<bigint, ServiceAccount> {
  const result = new Map<bigint, ServiceAccount>()
  
  for (const accountData of accounts) {
    const serviceId = BigInt(accountData.id)
    const serviceInfo = accountData.data.service
    
    const serviceAccount: ServiceAccount = {
      codehash: serviceInfo.code_hash as Hex,
      balance: BigInt(serviceInfo.balance),
      minaccgas: BigInt(serviceInfo.min_item_gas),
      minmemogas: BigInt(serviceInfo.min_memo_gas),
      octets: BigInt(serviceInfo.bytes),
      gratis: BigInt(0),
      items: BigInt(serviceInfo.items),
      created: BigInt(serviceInfo.creation_slot),
      lastacc: BigInt(serviceInfo.last_accumulation_slot),
      parent: BigInt(serviceInfo.parent_service),
      storage: new Map(),
      preimages: new Map(),
      requests: new Map(),
    }

    // Convert storage
    for (const storageEntry of accountData.data.storage) {
      serviceAccount.storage.set(storageEntry.key as Hex, hexToBytes(storageEntry.value as Hex))
    }

    // Convert preimages
    for (const preimageEntry of accountData.data.preimages_blob) {
      serviceAccount.preimages.set(preimageEntry.hash as Hex, hexToBytes(preimageEntry.blob as Hex))
    }

    // Convert preimage status (requests)
    // requests is Map<Hex, Map<bigint, PreimageRequestStatus>>
    // where PreimageRequestStatus = bigint[]
    // Test vector has preimages_status with hash and status array
    // We need to map status array to PreimageRequestStatus for each hash
    // The test vector doesn't provide length, so we'll use 0 as default
    for (const statusEntry of accountData.data.preimages_status) {
      const hash = statusEntry.hash as Hex
      const statusMap = new Map<bigint, PreimageRequestStatus>()
      // Convert status array to PreimageRequestStatus (bigint[])
      const status: PreimageRequestStatus = statusEntry.status.map(BigInt)
      // Use 0 as default length (test vectors don't provide length)
      statusMap.set(0n, status)
      serviceAccount.requests.set(hash, statusMap)
    }

    result.set(serviceId, serviceAccount)
  }
  
  return result
}

function convertToReady(readyQueue: AccumulateTestVector['pre_state']['ready_queue'], currentSlot: number, epochDuration: number): Ready {
  // Initialize epoch slots array
  const epochSlots: ReadyItem[][] = new Array(epochDuration).fill(null).map(() => [])
  
  // The ready_queue in the test vector is organized by slot index
  // Each slot index maps to an array of ready items
  for (let slotIndex = 0; slotIndex < readyQueue.length && slotIndex < epochDuration; slotIndex++) {
    const slotItems = readyQueue[slotIndex] || []
    for (const queueItem of slotItems) {
      const workReport = convertJsonReportToWorkReport(queueItem.report)
      const dependencies = new Set<Hex>(queueItem.dependencies.map(dep => dep as Hex))
      
      const readyItem: ReadyItem = {
        workReport,
        dependencies,
      }
      
      epochSlots[slotIndex].push(readyItem)
    }
  }
  
  return {
    epochSlots,
  }
}

function convertToAccumulated(accumulated: AccumulateTestVector['pre_state']['accumulated']): Accumulated {
  // Initialize accumulated packages array
  const packages: Set<Hex>[] = accumulated.map((slotPackages: string[]) => {
    return new Set<Hex>(slotPackages.map((pkg: string) => pkg as Hex))
  })
  
  return {
    packages,
  }
}
