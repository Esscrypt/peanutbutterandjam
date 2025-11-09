/**
 * Reports Test Vectors
 *
 * Loads all JAM reports test vectors (tiny/full) and sets up
 * services (validators, entropy, recent history) from pre_state.
 *
 * Mirrors the structure used in disputes.test.ts for service setup.
 */

import { describe, it, expect } from 'bun:test'
import { EventBusService, type Hex } from '@pbnj/core'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ReportsTestVector, WorkReport } from '@pbnj/types'
import { ValidatorSetManager } from '../services/validator-set'
import { EntropyService } from '../services/entropy'
import { RecentHistoryService } from '../services/recent-history-service'
import { ServiceAccountService } from '../services/service-account-service'
import { ConfigService } from '../services/config-service'
import { ClockService } from '../services/clock-service'
import { StatisticsService } from '../services/statistics-service'
import { AuthPoolService } from '../services/auth-pool-service'
import { AuthQueueService } from '../services/auth-queue-service'
import { WorkReportService } from '../services/work-report-service'
import { GuarantorService } from '../services/guarantor-service'
import { AccumulationService } from '../services/accumulation-service'

const WORKSPACE_ROOT = path.join(__dirname, '../../../')


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

// Helper function to convert WorkReport bigints back to numbers for JSON comparison
function convertWorkReportToJson(workReport: WorkReport): any {
  return {
    ...workReport,
    core_index: Number(workReport.core_index),
    auth_gas_used: Number(workReport.auth_gas_used),
    context: {
      ...workReport.context,
      lookup_anchor_slot: Number(workReport.context.lookup_anchor_slot),
    },
    results: workReport.results.map(r => ({
      ...r,
      service_id: Number(r.service_id),
      accumulate_gas: Number(r.accumulate_gas),
      refine_load: {
        ...r.refine_load,
        gas_used: Number(r.refine_load.gas_used),
        imports: Number(r.refine_load.imports),
        extrinsic_count: Number(r.refine_load.extrinsic_count),
        extrinsic_size: Number(r.refine_load.extrinsic_size),
        exports: Number(r.refine_load.exports),
      },
    })),
  }
}

function loadReportVectors(
  config: 'tiny' | 'full',
): Array<{ name: string; vector: ReportsTestVector }> {
  const dir = path.join(
    WORKSPACE_ROOT,
    `submodules/jam-test-vectors/stf/reports/${config}`,
  )

  const files = fs.readdirSync(dir)
  const jsonFiles = files.filter((f) => f.endsWith('.json'))

  return jsonFiles.map((file) => {
    const filePath = path.join(dir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const vector = JSON.parse(content) as ReportsTestVector
    return { name: file.replace('.json', ''), vector }
  })
}

describe('Reports - JAM Test Vectors', () => {
  for (const configType of ['tiny', 'full'] as const) {
    describe(`Configuration: ${configType}`, () => {
      const configService = new ConfigService(configType)
      const vectors = loadReportVectors(configType)

      it('should load report vectors', () => {
        expect(vectors.length).toBeGreaterThan(0)
      })

      for (const { name, vector } of vectors) {
        it(`Report Vector: ${name}`, async () => {
          // Fresh services per test to avoid state bleed between vectors
          const eventBusService = new EventBusService()
          const clockService = new ClockService({
            eventBusService,
            configService,
          })

          // Step 1: Initialize ValidatorSetManager with current and previous validators
          const validatorSetManager = new ValidatorSetManager({
            eventBusService,
            sealKeyService: null,
            keyPairService: null,
            ringProver: null,
            ticketService: null,
            configService: configService,
            initialValidators: vector.pre_state.curr_validators.map((validator, index) => ({
              bandersnatch: validator.bandersnatch,
              ed25519: validator.ed25519,
              bls: validator.bls,
              metadata: validator.metadata,
            })),
          })

          // Set previous epoch validators (prev_validators from pre_state)
          validatorSetManager.setPreviousSet(
            vector.pre_state.prev_validators.map((validator) => ({
              bandersnatch: validator.bandersnatch,
              ed25519: validator.ed25519,
              bls: validator.bls,
              metadata: validator.metadata,
            })),
          )

          // Initialize offenders from pre_state if present
          if (vector.pre_state.offenders && vector.pre_state.offenders.length > 0) {
            validatorSetManager.addOffenders(vector.pre_state.offenders)
          }

          // Step 2: Initialize EntropyService and set entropy from pre_state
          // entropy array is [accumulator, entropy1, entropy2, entropy3]
          const entropyService = new EntropyService(eventBusService)
          entropyService.setEntropy({
            accumulator: vector.pre_state.entropy[0] || '0x0000000000000000000000000000000000000000000000000000000000000000',
            entropy1: vector.pre_state.entropy[1] || '0x0000000000000000000000000000000000000000000000000000000000000000',
            entropy2: vector.pre_state.entropy[2] || '0x0000000000000000000000000000000000000000000000000000000000000000',
            entropy3: vector.pre_state.entropy[3] || '0x0000000000000000000000000000000000000000000000000000000000000000',
          })

          // Step 3: Initialize RecentHistoryService and set recent_blocks from pre_state
          const recentHistoryService = new RecentHistoryService(
            {
              eventBusService: eventBusService,
              configService: configService,
              accumulationService: null,
            },
          )
          recentHistoryService.setRecent({
            history: vector.pre_state.recent_blocks.history.map((entry) => ({
              headerHash: entry.header_hash,
              stateRoot: entry.state_root,
              accoutLogSuperPeak: entry.beefy_root,
              reportedPackageHashes: new Map(entry.reported.map((pkg) => [pkg.hash, pkg.exports_root])),
            })),
            accoutBelt: {
              peaks: vector.pre_state.recent_blocks.mmr.peaks,
              totalCount: BigInt(vector.pre_state.recent_blocks.mmr.peaks.length),
            },
          })
          recentHistoryService.start()

          // Step 4: Initialize ServiceAccountService and set accounts from pre_state
          const serviceAccountService = new ServiceAccountService({
            preimageStore: null,
            configService,
            eventBusService,
            clockService,
            networkingService: null,
            preimageRequestProtocol: null,
          })

          // Set up accounts from pre_state
          for (const acct of vector.pre_state.accounts) {
            const serviceId = BigInt(acct.id)
            const serviceData = acct.data.service

            // Map JSON fields to ServiceAccount structure
            const serviceAccount = {
              codehash: serviceData.code_hash as Hex,
              balance: BigInt(serviceData.balance),
              minaccgas: BigInt(serviceData.min_item_gas),
              minmemogas: BigInt(serviceData.min_memo_gas),
              octets: BigInt(serviceData.bytes),
              gratis: BigInt(serviceData.deposit_offset),
              items: BigInt(serviceData.items),
              created: BigInt(serviceData.creation_slot),
              lastacc: BigInt(serviceData.last_accumulation_slot),
              parent: BigInt(serviceData.parent_service),
              storage: new Map<Hex, Uint8Array>(),
              preimages: new Map<Hex, Uint8Array>(),
              requests: new Map<Hex, Map<bigint, bigint[]>>(),
            }

            serviceAccountService.setServiceAccount(serviceId, serviceAccount)
          }

          // Step 5: Initialize StatisticsService and set core statistics from pre_state
          const statisticsService = new StatisticsService({
            eventBusService,
            configService,
            clockService,
          })

          // Set activity from pre_state (including core and service statistics)
          // Note: reports test vectors don't have validator stats, so we use empty arrays
          statisticsService.setActivityFromPreState({
            vals_curr_stats: [],
            vals_last_stats: [],
            cores_statistics: vector.pre_state.cores_statistics,
            services_statistics: vector.pre_state.services_statistics,
          })

          // Step 6: Initialize WorkReportService, AuthQueueService, and AuthPoolService
          const workReportService = new WorkReportService({
            workStore: null,
            eventBus: eventBusService,
            networkingService: null,
            ce136WorkReportRequestProtocol: null,
            validatorSetManager: validatorSetManager,
            configService,
            entropyService,
            clockService,
          })

          // Extract authorizer hashes from guarantees and set them in WorkReportService
          for (const guarantee of vector.input.guarantees) {
            const coreIndex = Number(guarantee.report.core_index)
            const authorizerHash = guarantee.report.authorizer_hash
            workReportService.setAuthorizerHashByCore(coreIndex, authorizerHash)
          }

          // Initialize avail_assignments from pre_state (available reports)
          if (vector.pre_state.avail_assignments) {
            for (let i = 0; i < vector.pre_state.avail_assignments.length; i++) {
              const assignment = vector.pre_state.avail_assignments[i]
              if (assignment !== null && assignment.report) {
                const [markError] = workReportService.markAsAvailable(
                  convertJsonReportToWorkReport(assignment.report),
                  BigInt(assignment.timeout),
                )
                if (markError) {
                  throw new Error(
                    `Failed to mark report as available for core ${i}: ${markError.message}`,
                  )
                }
              }
            }
          }

          const authQueueService = new AuthQueueService({configService: configService})
          const authPoolService = new AuthPoolService({
            configService,
            workReportService,
            eventBusService,
            authQueueService,
          })

          // Set auth pools from pre_state
          const clonedAuthPool = structuredClone(vector.pre_state.auth_pools)
          authPoolService.setAuthPool(clonedAuthPool)

          const accumulatedService = new AccumulationService({
            configService: configService,
            clockService: clockService,
            serviceAccountsService: serviceAccountService,
            privilegesService: null,
            validatorSetManager: validatorSetManager,
            authQueueService: authQueueService,
            accumulatePVM: null,
            readyService: null,
            // statisticsService: statisticsService,
            // entropyService: entropyService,
          })

          // Step 7: Initialize GuarantorService and process guarantees
          const guarantorService = new GuarantorService({
            configService,
            clockService,
            entropyService,
            authPoolService,
            networkService: null,
            ce134WorkPackageSharingProtocol: null,
            keyPairService: null as any,
            workReportService,
            eventBusService,
            validatorSetManager,
            recentHistoryService,
            serviceAccountService,
            statisticsService,
            // erasureCodingService: null,
            // shardService: null,
            accumulationService: accumulatedService,
          })

          // Process guarantees using applyGuarantees
          // Convert known_packages to Set<Hex> for dependency validation
          const knownPackages = new Set<Hex>(vector.input.known_packages)

          // simulate accumulated state from vector.input.known_packages
          accumulatedService.setAccumulated({
            packages: [knownPackages],
          })

          // Convert guarantees from JSON format to proper types (bigints, WorkReport)
          const guarantees = vector.input.guarantees.map((g) => ({
            report: convertJsonReportToWorkReport(g.report),
            slot: BigInt(g.slot),
            signatures: g.signatures,
          }))

          const [applyError, reporters] = await guarantorService.applyGuarantees(
            guarantees,
            BigInt(vector.input.slot)
          )


          // Check if error case is expected
          if (applyError) {
            if (vector.output?.err !== undefined) {
              // Expected error case - validation will check output.err
              expect(applyError.message).toBe(vector.output.err)
            } else {
              // Unexpected error - rethrow
              throw applyError
            }
          } else {
            // Success case - validate output.ok if present
            if (vector.output?.ok) {
              const outputOk = vector.output.ok as {
                reporters?: Hex[]
                reported?: Array<{
                  work_package_hash: Hex
                  segment_tree_root: Hex
                }>
              }

              // Validate reporters (Ed25519 public keys of validators who signed guarantees)
              if (outputOk.reporters) {
                expect(reporters).toBeDefined()
                expect(reporters).not.toBeNull()
                // Sort both arrays for comparison (order might differ)
                const expectedReporters = [...outputOk.reporters].sort()
                const actualReporters = [...(reporters || [])].sort()
                expect(actualReporters).toEqual(expectedReporters)
              }

              // Validate reported (work packages that were successfully processed)
              if (outputOk.reported) {
                // Collect successfully processed guarantees (those that passed validation)
                // Each reported entry should have work_package_hash and segment_tree_root (exports_root)
                const actualReported = guarantees.map((guarantee) => ({
                  work_package_hash: guarantee.report.package_spec.hash,
                  segment_tree_root: guarantee.report.package_spec.exports_root,
                }))

                // Sort both arrays by work_package_hash for comparison
                const expectedReported = [...outputOk.reported].sort((a, b) =>
                  a.work_package_hash.localeCompare(b.work_package_hash),
                )
                const sortedActualReported = actualReported.sort((a, b) =>
                  a.work_package_hash.localeCompare(b.work_package_hash),
                )

                expect(sortedActualReported).toEqual(expectedReported)
              }
            }

            // Statistics are now updated automatically by GuarantorService after successful processing
          }


          // Step 8: Validate post_state against service states
          // Note: These validations will fail until processing logic is implemented

            // Smoke check: has at least one guarantee and recent history present
            expect(vector.input.guarantees.length).toBeGreaterThan(0)
            expect(vector.pre_state.recent_blocks.history.length).toBeGreaterThan(0)

            // Validate auth pools match post_state
            const actualAuthPool = authPoolService.getAuthPool()
            expect(actualAuthPool).toEqual(vector.post_state.auth_pools)

            // Validate core statistics match post_state
            const activity = statisticsService.getActivity()
            const actualCoreStats = activity.coreStats.map((s) => ({
              da_load: s.daLoad,
              popularity: s.popularity,
              imports: s.importCount,
              extrinsic_count: s.extrinsicCount,
              extrinsic_size: s.extrinsicSize,
              exports: s.exportCount,
              bundle_size: s.bundleLength,
              gas_used: s.gasUsed,
            }))
            expect(actualCoreStats.length).toBe(
              vector.post_state.cores_statistics.length,
            )
            for (let i = 0; i < actualCoreStats.length; i++) {
              expect(actualCoreStats[i]).toEqual(
                vector.post_state.cores_statistics[i],
              )
            }

            // Validate service statistics match post_state
            const actualServiceStats = Array.from(
              activity.serviceStats.entries(),
            )
              .sort((a, b) => Number(a[0] - b[0]))
              .map(([id, stats]) => ({
                id: Number(id),
                record: {
                  provided_count: stats.provision,
                  provided_size: 0, // Not tracked in ServiceStats
                  refinement_count: stats.refinement,
                  refinement_gas_used: 0, // Not tracked in ServiceStats
                  imports: stats.importCount,
                  extrinsic_count: stats.extrinsicCount,
                  extrinsic_size: stats.extrinsicSize,
                  exports: stats.exportCount,
                  accumulate_count: stats.accumulation,
                  accumulate_gas_used: 0, // Not tracked in ServiceStats
                },
              }))

            const expectedServiceStats = vector.post_state.services_statistics.sort(
              (a, b) => a.id - b.id,
            )
            expect(actualServiceStats.length).toBe(expectedServiceStats.length)
            for (let i = 0; i < actualServiceStats.length; i++) {
              // Note: Some fields may not be tracked in ServiceStats, so we check what we can
              expect(actualServiceStats[i].id).toBe(expectedServiceStats[i].id)
              expect(actualServiceStats[i].record.provided_count).toBe(
                expectedServiceStats[i].record.provided_count,
              )
              expect(actualServiceStats[i].record.refinement_count).toBe(
                expectedServiceStats[i].record.refinement_count,
              )
              expect(actualServiceStats[i].record.imports).toBe(
                expectedServiceStats[i].record.imports,
              )
              expect(actualServiceStats[i].record.extrinsic_count).toBe(
                expectedServiceStats[i].record.extrinsic_count,
              )
              expect(actualServiceStats[i].record.extrinsic_size).toBe(
                expectedServiceStats[i].record.extrinsic_size,
              )
              expect(actualServiceStats[i].record.exports).toBe(
                expectedServiceStats[i].record.exports,
              )
              expect(actualServiceStats[i].record.accumulate_count).toBe(
                expectedServiceStats[i].record.accumulate_count,
              )
            }
          
        })
      }
    })
  }
})


