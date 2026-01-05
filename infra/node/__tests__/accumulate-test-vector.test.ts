import { describe, it, expect, beforeAll } from 'bun:test'
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
} from '@pbnjam/types'
import { ConfigService } from '../services/config-service'
import { HostFunctionRegistry, AccumulateHostFunctionRegistry } from '@pbnjam/pvm'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'
import { bytesToHex, hexToBytes, zeroHash } from '../../../packages/core/src/utils/crypto'
import { ServiceAccountService } from '../services/service-account-service'
import { EventBusService } from '@pbnjam/core'
import { ClockService } from '../services/clock-service'
// import { PreimageRequestProtocol } from '@pbnjam/networking'
import { AccumulationService } from '../services/accumulation-service'
import { ReadyService } from '../services/ready-service'
import { EntropyService } from '../services/entropy'
import { StatisticsService } from '../services/statistics-service'
import { AuthQueueService } from '../services/auth-queue-service'
import { ValidatorSetManager } from '../services/validator-set'
import { PrivilegesService } from '../services/privileges-service'
import { RingVRFProverWasm, RingVRFVerifierWasm } from '@pbnjam/bandersnatch-vrf'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../')
const PVM_TRACES_DIR = path.join(WORKSPACE_ROOT, 'pvm-traces')

// Mock config services for tiny and full test vectors
const tinyConfigService = new ConfigService('tiny')
const fullConfigService = new ConfigService('full')

/**
 * Clear all trace files before test execution
 */
function clearTraces(): void {
  try {
    if (fs.existsSync(PVM_TRACES_DIR)) {
      const files = fs.readdirSync(PVM_TRACES_DIR)
      for (const file of files) {
        fs.unlinkSync(path.join(PVM_TRACES_DIR, file))
      }
    } else {
      fs.mkdirSync(PVM_TRACES_DIR, { recursive: true })
    }
  } catch (error) {
    console.warn('Failed to clear traces:', error)
  }
}

/**
 * Count instructions in trace files and report counts
 */
function countInstructionsInTraces(): { totalInstructions: number; traceFiles: Array<{ filename: string; count: number }> } {
  const traceFiles: Array<{ filename: string; count: number }> = []
  let totalInstructions = 0

  try {
    if (!fs.existsSync(PVM_TRACES_DIR)) {
      return { totalInstructions: 0, traceFiles: [] }
    }

    const files = fs.readdirSync(PVM_TRACES_DIR).filter(f => f.endsWith('.log'))
    
    for (const file of files) {
      const filepath = path.join(PVM_TRACES_DIR, file)
      const content = fs.readFileSync(filepath, 'utf-8')
      const lines = content.split('\n')
      
      // Count instruction lines (lines that start with an instruction name, not "Calling host function")
      const instructionLines = lines.filter(line => {
        const trimmed = line.trim()
        return trimmed.length > 0 && 
               !trimmed.startsWith('Calling host function') &&
               /^[A-Z_]+ \d+ \d+/.test(trimmed) // Pattern: INSTRUCTION step pc
      })
      
      const count = instructionLines.length
      traceFiles.push({ filename: file, count })
      totalInstructions += count
    }
  } catch (error) {
    console.warn('Failed to count instructions:', error)
  }

  return { totalInstructions, traceFiles }
}


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

  return jsonFiles.map((file) => {
    const filePath = path.join(testVectorsDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const vector = JSON.parse(content) as AccumulateTestVector

    return {
      name: file.replace('.json', ''),
      vector,
    }
  })
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
  // Clear traces before all tests
  beforeAll(() => {
    clearTraces()
  })

  // Test both tiny and full configurations
  for (const configType of ['tiny', 'full'] as const) {
    describe(`Configuration: ${configType}`, () => {
      const configService = configType === 'tiny' ? tinyConfigService : fullConfigService
      const testVectors = loadTestVectors(configType)

      // Test each vector sequentially, stopping on first failure
      for (const { name, vector } of testVectors) {
        describe(`Test Vector: ${name}`, () => {
          // Run with both TypeScript and WASM executors
          const executorTypes: Array<{ name: string; useWasm: boolean }> = [
            { name: 'TypeScript', useWasm: false },
            { name: 'WASM', useWasm: true },
          ]

          for (const executorType of executorTypes) {
            it(
              `should correctly transition accumulation state (${executorType.name})`,
              async () => {
            // Create services
            const eventBusService = new EventBusService()
            const clockService = new ClockService({
              eventBusService: eventBusService,
              configService: configService,
            })
            const serviceAccountService = new ServiceAccountService({
              configService: configService,
              eventBusService: eventBusService,
              clockService: clockService,
              networkingService: null,
              preimageRequestProtocol: null,
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
              pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) },
              useWasm: executorType.useWasm,
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

            // Set last processed slot from pre_state (so shift delta can be calculated)
            accumulationService.setLastProcessedSlot(BigInt(vector.pre_state.slot))

            // Initialize statistics from pre_state if present
            if (vector.pre_state.statistics && vector.pre_state.statistics.length > 0) {
              statisticsService.setActivityFromPreState({
                vals_curr_stats: [],
                vals_last_stats: [],
                services_statistics: vector.pre_state.statistics,
              })
            }

            // Convert input.reports to WorkReport[]
            const reports = vector.input.reports.map(convertJsonReportToWorkReport)

            // Apply transition
            const result = await accumulationService.applyTransition(
              BigInt(vector.input.slot),
              reports,
            )

            // Verify result
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

            // Verify post_state with EXACT matching against JSON
            const mismatches: string[] = []

            // 1. Verify ready_queue - exact match against raw JSON
            const postReady = accumulationService.getReady()
            const expectedReadyJson = vector.post_state.ready_queue

            // Check ready queue slot by slot
            for (let slotIdx = 0; slotIdx < configService.epochDuration; slotIdx++) {
              const expectedSlotItems = expectedReadyJson[slotIdx] || []
              const actualSlotItems = postReady.epochSlots[slotIdx] || []

              if (expectedSlotItems.length !== actualSlotItems.length) {
                mismatches.push(`ready_queue[${slotIdx}]: expected ${expectedSlotItems.length} items, got ${actualSlotItems.length}`)
              }

              // Sort both by package hash for comparison
              const expectedSorted = [...expectedSlotItems].sort((a, b) => 
                (a.report.package_spec.hash as string).localeCompare(b.report.package_spec.hash as string)
              )
              const actualSorted = [...actualSlotItems].sort((a, b) =>
                a.workReport.package_spec.hash.localeCompare(b.workReport.package_spec.hash)
              )

              for (let itemIdx = 0; itemIdx < Math.max(expectedSorted.length, actualSorted.length); itemIdx++) {
                const expected = expectedSorted[itemIdx]
                const actual = actualSorted[itemIdx]

                if (!expected && actual) {
                  mismatches.push(`ready_queue[${slotIdx}][${itemIdx}]: unexpected item with package ${actual.workReport.package_spec.hash}`)
                  continue
                }
                if (expected && !actual) {
                  mismatches.push(`ready_queue[${slotIdx}][${itemIdx}]: missing item with package ${expected.report.package_spec.hash}`)
                  continue
                }
                if (!expected || !actual) continue
                
                // Compare package hash
                if (actual.workReport.package_spec.hash !== expected.report.package_spec.hash) {
                  mismatches.push(`ready_queue[${slotIdx}][${itemIdx}].package_spec.hash: expected ${expected.report.package_spec.hash}, got ${actual.workReport.package_spec.hash}`)
                }

                // Compare dependencies exactly
                const expectedDeps = [...expected.dependencies].sort()
                const actualDeps = [...actual.dependencies].sort()
                if (JSON.stringify(expectedDeps) !== JSON.stringify(actualDeps)) {
                  mismatches.push(`ready_queue[${slotIdx}][${itemIdx}].dependencies: expected ${JSON.stringify(expectedDeps)}, got ${JSON.stringify(actualDeps)}`)
                }

                // Compare full work report
                const expectedReport = expected.report
                const actualReport = actual.workReport

                if (actualReport.authorizer_hash !== expectedReport.authorizer_hash) {
                  mismatches.push(`ready_queue[${slotIdx}][${itemIdx}].authorizer_hash: expected ${expectedReport.authorizer_hash}, got ${actualReport.authorizer_hash}`)
                }
                if (actualReport.auth_output !== expectedReport.auth_output) {
                  mismatches.push(`ready_queue[${slotIdx}][${itemIdx}].auth_output: expected ${expectedReport.auth_output}, got ${actualReport.auth_output}`)
                }
                if (actualReport.core_index !== BigInt(expectedReport.core_index)) {
                  mismatches.push(`ready_queue[${slotIdx}][${itemIdx}].core_index: expected ${expectedReport.core_index}, got ${actualReport.core_index}`)
                }
              }
            }

            // 2. Verify accumulated - exact match against raw JSON
            const postAccumulated = accumulationService.getAccumulated()
            const expectedAccumulatedJson = vector.post_state.accumulated

            if (postAccumulated.packages.length !== expectedAccumulatedJson.length) {
              mismatches.push(`accumulated.length: expected ${expectedAccumulatedJson.length}, got ${postAccumulated.packages.length}`)
            }

            for (let slotIdx = 0; slotIdx < Math.max(postAccumulated.packages.length, expectedAccumulatedJson.length); slotIdx++) {
              const expectedPackages = (expectedAccumulatedJson[slotIdx] || []).sort()
              const actualPackages = Array.from(postAccumulated.packages[slotIdx] || new Set()).sort()

              if (JSON.stringify(expectedPackages) !== JSON.stringify(actualPackages)) {
                mismatches.push(`accumulated[${slotIdx}]: expected ${JSON.stringify(expectedPackages)}, got ${JSON.stringify(actualPackages)}`)
              }
            }

            // 3. Verify accounts - FULL exact match against raw JSON
            const postAccounts = serviceAccountService.getServiceAccounts()
            const expectedAccountsJson = vector.post_state.accounts

            // Check we have the same service IDs
            const expectedServiceIds = new Set(expectedAccountsJson.map(a => BigInt(a.id)))
            const actualServiceIds = new Set(postAccounts.accounts.keys())

            for (const serviceId of expectedServiceIds) {
              if (!actualServiceIds.has(serviceId)) {
                mismatches.push(`accounts: missing service ${serviceId}`)
              }
            }
            for (const serviceId of actualServiceIds) {
              if (!expectedServiceIds.has(serviceId)) {
                mismatches.push(`accounts: unexpected service ${serviceId}`)
              }
            }

            // Compare each account in detail
            for (const expectedAccountData of expectedAccountsJson) {
              const serviceId = BigInt(expectedAccountData.id)
              const actualAccount = postAccounts.accounts.get(serviceId)
              const expectedService = expectedAccountData.data.service

              if (!actualAccount) continue

              // Compare all service account fields
              if (actualAccount.codehash !== expectedService.code_hash) {
                mismatches.push(`accounts[${serviceId}].codehash: expected ${expectedService.code_hash}, got ${actualAccount.codehash}`)
              }
              if (actualAccount.balance !== BigInt(expectedService.balance)) {
                mismatches.push(`accounts[${serviceId}].balance: expected ${expectedService.balance}, got ${actualAccount.balance}`)
              }
              if (actualAccount.minaccgas !== BigInt(expectedService.min_item_gas)) {
                mismatches.push(`accounts[${serviceId}].minaccgas: expected ${expectedService.min_item_gas}, got ${actualAccount.minaccgas}`)
              }
              if (actualAccount.minmemogas !== BigInt(expectedService.min_memo_gas)) {
                mismatches.push(`accounts[${serviceId}].minmemogas: expected ${expectedService.min_memo_gas}, got ${actualAccount.minmemogas}`)
              }
              if (actualAccount.octets !== BigInt(expectedService.bytes)) {
                mismatches.push(`accounts[${serviceId}].octets: expected ${expectedService.bytes}, got ${actualAccount.octets}`)
              }
              if (actualAccount.items !== BigInt(expectedService.items)) {
                mismatches.push(`accounts[${serviceId}].items: expected ${expectedService.items}, got ${actualAccount.items}`)
              }
              if (actualAccount.created !== BigInt(expectedService.creation_slot)) {
                mismatches.push(`accounts[${serviceId}].created: expected ${expectedService.creation_slot}, got ${actualAccount.created}`)
              }
              if (actualAccount.lastacc !== BigInt(expectedService.last_accumulation_slot)) {
                mismatches.push(`accounts[${serviceId}].lastacc: expected ${expectedService.last_accumulation_slot}, got ${actualAccount.lastacc}`)
              }
              if (actualAccount.parent !== BigInt(expectedService.parent_service)) {
                mismatches.push(`accounts[${serviceId}].parent: expected ${expectedService.parent_service}, got ${actualAccount.parent}`)
              }

              // Compare storage exactly
              const expectedStorage = expectedAccountData.data.storage
              const actualStorageKeys = new Set(actualAccount.storage.keys())
              const expectedStorageKeys = new Set(expectedStorage.map((s: any) => s.key as Hex))

              for (const key of expectedStorageKeys) {
                if (!actualStorageKeys.has(key)) {
                  mismatches.push(`accounts[${serviceId}].storage: missing key ${key}`)
                }
              }
              for (const key of actualStorageKeys) {
                if (!expectedStorageKeys.has(key)) {
                  mismatches.push(`accounts[${serviceId}].storage: unexpected key ${key}`)
                }
              }

              for (const storageEntry of expectedStorage) {
                const key = storageEntry.key as Hex
                const expectedValue = storageEntry.value as Hex
                const actualBytes = actualAccount.storage.get(key)
                if (actualBytes) {
                  const actualValue = bytesToHex(actualBytes)
                  if (actualValue.toLowerCase() !== expectedValue.toLowerCase()) {
                    mismatches.push(`accounts[${serviceId}].storage[${key}]: expected ${expectedValue.slice(0, 40)}..., got ${actualValue.slice(0, 40)}...`)
                  }
                }
              }

              // Compare preimages exactly (handle both old and new key names)
              const expectedDataAny = expectedAccountData.data as any
              const expectedPreimages = expectedDataAny.preimage_blobs || expectedDataAny.preimages_blob || []
              const actualPreimageKeys = new Set(actualAccount.preimages.keys())
              const expectedPreimageKeys = new Set<Hex>(expectedPreimages.map((p: any) => p.hash as Hex))

              for (const hash of expectedPreimageKeys) {
                if (!actualPreimageKeys.has(hash)) {
                  mismatches.push(`accounts[${serviceId}].preimages: missing hash ${hash}`)
                }
              }
              for (const hash of actualPreimageKeys) {
                if (!expectedPreimageKeys.has(hash)) {
                  mismatches.push(`accounts[${serviceId}].preimages: unexpected hash ${hash}`)
                }
              }

              for (const preimageEntry of expectedPreimages) {
                const hash = preimageEntry.hash as Hex
                const expectedBlob = preimageEntry.blob as Hex
                const actualBytes = actualAccount.preimages.get(hash)
                if (actualBytes) {
                  const actualBlob = bytesToHex(actualBytes)
                  if (actualBlob.toLowerCase() !== expectedBlob.toLowerCase()) {
                    mismatches.push(`accounts[${serviceId}].preimages[${hash}]: blob mismatch (${actualBlob.length} vs ${expectedBlob.length} chars)`)
                  }
                }
              }

              // Compare preimage requests exactly (handle both old and new key names and structures)
              const expectedRequests = expectedDataAny.preimage_requests || expectedDataAny.preimages_status || []
              for (const requestEntry of expectedRequests) {
                // Handle new structure: { key: { hash, length }, value: status }
                // and old structure: { hash, length, status }
                let hash: Hex
                let expectedLength: bigint
                let expectedStatusArray: number[]

                if (requestEntry.key && requestEntry.key.hash) {
                  hash = requestEntry.key.hash as Hex
                  expectedLength = BigInt(requestEntry.key.length || 0)
                  expectedStatusArray = requestEntry.value || []
                } else {
                  hash = requestEntry.hash as Hex
                  expectedLength = BigInt(requestEntry.length || 0)
                  expectedStatusArray = requestEntry.status || []
                }

                const actualStatusMap = actualAccount.requests.get(hash)
                
                if (!actualStatusMap) {
                  mismatches.push(`accounts[${serviceId}].requests: missing hash ${hash}`)
                  continue
                }

                // Check the status array for the specific length
                const actualStatus = actualStatusMap.get(expectedLength)
                if (!actualStatus) {
                  mismatches.push(`accounts[${serviceId}].requests[${hash}]: missing length ${expectedLength}`)
                  continue
                }

                // Compare status arrays
                if (actualStatus.length !== expectedStatusArray.length) {
                  mismatches.push(`accounts[${serviceId}].requests[${hash}][${expectedLength}]: status length mismatch, expected ${expectedStatusArray.length}, got ${actualStatus.length}`)
                  continue
                }

                const statusMatch = actualStatus.every((val, idx) => val === BigInt(expectedStatusArray[idx]))
                if (!statusMatch) {
                  mismatches.push(`accounts[${serviceId}].requests[${hash}][${expectedLength}]: status values mismatch`)
                }
              }
            }

            // 4. Verify statistics - MOST IMPORTANT: accumulation gas usage
            const expectedStatisticsJson = vector.post_state.statistics || []
            const actualServiceStats = statisticsService.getServiceStats()

            for (const expectedStat of expectedStatisticsJson) {
              const serviceId = BigInt(expectedStat.id)
              const expectedRecord = expectedStat.record
              const actualStats = actualServiceStats.get(serviceId)

              if (!actualStats) {
                // Only report missing stats if accumulate_gas_used > 0 (service was accumulated)
                if (expectedRecord.accumulate_gas_used > 0 || expectedRecord.accumulate_count > 0) {
                  mismatches.push(`statistics[${serviceId}]: missing service stats (expected accumulate_count=${expectedRecord.accumulate_count}, accumulate_gas_used=${expectedRecord.accumulate_gas_used})`)
                }
                continue
              }

              // MOST IMPORTANT: Verify accumulation gas usage
              if (expectedRecord.accumulate_count !== undefined) {
                const actualCount = actualStats.accumulation?.[0] ?? 0
                if (actualCount !== expectedRecord.accumulate_count) {
                  mismatches.push(`statistics[${serviceId}].accumulate_count: expected ${expectedRecord.accumulate_count}, got ${actualCount}`)
                }
              }

              if (expectedRecord.accumulate_gas_used !== undefined) {
                const actualGas = actualStats.accumulation?.[1] ?? 0
                if (actualGas !== expectedRecord.accumulate_gas_used) {
                  mismatches.push(`statistics[${serviceId}].accumulate_gas_used: expected ${expectedRecord.accumulate_gas_used}, got ${actualGas}`)
                  // Log this prominently as it's the most important metric
                  console.error(`\n⚠️  CRITICAL: Accumulation gas mismatch for service ${serviceId}:`)
                  console.error(`   Expected: ${expectedRecord.accumulate_gas_used}`)
                  console.error(`   Actual: ${actualGas}`)
                  console.error(`   Difference: ${actualGas - expectedRecord.accumulate_gas_used}`)
                }
              }

              // Also verify other statistics fields for completeness
              if (actualStats.provision[0] !== expectedRecord.provided_count) {
                mismatches.push(`statistics[${serviceId}].provided_count: expected ${expectedRecord.provided_count}, got ${actualStats.provision[0]}`)
              }
              if (actualStats.refinement[0] !== expectedRecord.refinement_count) {
                mismatches.push(`statistics[${serviceId}].refinement_count: expected ${expectedRecord.refinement_count}, got ${actualStats.refinement[0]}`)
              }
              if (actualStats.refinement[1] !== expectedRecord.refinement_gas_used) {
                mismatches.push(`statistics[${serviceId}].refinement_gas_used: expected ${expectedRecord.refinement_gas_used}, got ${actualStats.refinement[1]}`)
              }
              if (actualStats.importCount !== expectedRecord.imports) {
                mismatches.push(`statistics[${serviceId}].imports: expected ${expectedRecord.imports}, got ${actualStats.importCount}`)
              }
              if (actualStats.extrinsicCount !== expectedRecord.extrinsic_count) {
                mismatches.push(`statistics[${serviceId}].extrinsic_count: expected ${expectedRecord.extrinsic_count}, got ${actualStats.extrinsicCount}`)
              }
              if (actualStats.extrinsicSize !== expectedRecord.extrinsic_size) {
                mismatches.push(`statistics[${serviceId}].extrinsic_size: expected ${expectedRecord.extrinsic_size}, got ${actualStats.extrinsicSize}`)
              }
              if (actualStats.exportCount !== expectedRecord.exports) {
                mismatches.push(`statistics[${serviceId}].exports: expected ${expectedRecord.exports}, got ${actualStats.exportCount}`)
              }
            }

            // Count instructions in generated traces
            const { totalInstructions, traceFiles } = countInstructionsInTraces()
            if (totalInstructions > 0) {
              console.log(`\n📊 Instruction count for test vector ${name} (${executorType.name}):`)
              console.log(`   Total instructions: ${totalInstructions}`)
              for (const { filename, count } of traceFiles) {
                console.log(`   ${filename}: ${count} instructions`)
              }
            }

            // Report all mismatches
            if (mismatches.length > 0) {
              console.error(`\n❌ Test vector ${name} (${executorType.name}) failed with ${mismatches.length} mismatches:`)
              // Prioritize accumulation gas usage mismatches
              const gasMismatches = mismatches.filter(m => m.includes('accumulate_gas_used'))
              const otherMismatches = mismatches.filter(m => !m.includes('accumulate_gas_used'))
              
              if (gasMismatches.length > 0) {
                console.error(`\n🔥 CRITICAL - Accumulation Gas Mismatches (${gasMismatches.length}):`)
                for (const mismatch of gasMismatches) {
                  console.error(`  - ${mismatch}`)
                }
              }
              
              if (otherMismatches.length > 0) {
                console.error(`\nOther mismatches (${otherMismatches.length}):`)
                for (const mismatch of otherMismatches.slice(0, 20)) {
                  console.error(`  - ${mismatch}`)
                }
                if (otherMismatches.length > 20) {
                  console.error(`  ... and ${otherMismatches.length - 20} more`)
                }
              }
            }

            expect(mismatches.length).toBe(0)
            },
            { timeout: 60000 }
          )
          }
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

    // Convert preimages (handle both old and new key names)
    const accountDataAny = accountData.data as any
    const preimageBlobs = accountDataAny.preimage_blobs || accountDataAny.preimages_blob || []
    for (const preimageEntry of preimageBlobs) {
      serviceAccount.preimages.set(preimageEntry.hash as Hex, hexToBytes(preimageEntry.blob as Hex))
    }

    // Convert preimage requests (handle both old and new key names and structures)
    // requests is Map<Hex, Map<bigint, PreimageRequestStatus>>
    // where PreimageRequestStatus = bigint[]
    const preimageRequests = accountDataAny.preimage_requests || accountDataAny.preimages_status || []
    for (const requestEntry of preimageRequests) {
      // Handle new structure: { key: { hash, length }, value: status }
      // and old structure: { hash, length, status }
      let hash: Hex
      let length: bigint
      let status: PreimageRequestStatus

      if (requestEntry.key && requestEntry.key.hash) {
        // New structure
        hash = requestEntry.key.hash as Hex
        length = BigInt(requestEntry.key.length || 0)
        status = (requestEntry.value || []).map(BigInt)
      } else {
        // Old structure
        hash = requestEntry.hash as Hex
        length = BigInt(requestEntry.length || 0)
        status = (requestEntry.status || []).map(BigInt)
      }

      let statusMap = serviceAccount.requests.get(hash)
      if (!statusMap) {
        statusMap = new Map<bigint, PreimageRequestStatus>()
      serviceAccount.requests.set(hash, statusMap)
      }
      statusMap.set(length, status)
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
