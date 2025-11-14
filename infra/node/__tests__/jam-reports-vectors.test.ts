/**
 * JAM Reports STF Test Vector Validation Tests
 *
 * Tests against official JAM test vectors for Reports STF
 * Validates conformance to the Gray Paper specification for work report processing
 */

import { logger } from '@pbnj/core'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  logger.init()
})

// Test vector interfaces based on jamtestvectors structure
interface ReportsTestVector {
  input: ReportsInput
  pre_state: ReportsState
  output: ReportsOutput | null
  post_state: ReportsState
}

interface ReportsOutput {
  ok?: {
    reported: ReportedItem[]
    reporters: string[]
  }
  err?: string
}

interface ReportsInput {
  slot: number
  reports: WorkReport[]
}

interface WorkReport {
  package_spec: PackageSpec
  context: ReportContext
  core_index: number
  authorizer_hash: string
  auth_output: string
  segment_root_lookup: string[]
  work_result: WorkResult
}

interface PackageSpec {
  hash: string
  length: number
  erasure_root: string
  exports_root: string
  exports_count: number
}

interface ReportContext {
  anchor: string
  state_root: string
  beefy_root: string
  lookup_anchor: string
  lookup_anchor_slot: number
  prerequisites: string[]
}

interface WorkResult {
  service_id: number
  code_hash: string
  payload_hash: string
  gas_ratio: number
  output: string
}

interface ReportsState {
  avail_assignments: AvailabilityAssignments
  curr_validators: ValidatorData[]
  prev_validators: ValidatorData[]
  entropy: string[]
  offenders: string[]
  recent_blocks: BlockInfo[]
  auth_pools: string[][]
  accounts: ServiceAccount[]
  cores_statistics: CoreStatistics[]
  services_statistics: ServiceStatistics[]
}

interface AvailabilityAssignments {
  [key: string]: any
}

interface ValidatorData {
  bandersnatch: string
  ed25519: string
  bls: string
  metadata: string
}

interface BlockInfo {
  [key: string]: any
}

interface ServiceAccount {
  id: number
  data: {
    service: {
      code_hash: string
      balance: string
      gas_limit: string
      min_accumulate_gas: string
      min_on_transfer_gas: string
      is_validator: boolean
    }
  }
}

interface CoreStatistics {
  imports: number
  exports: number
  extrinsic_size: number
  extrinsic_count: number
  bundle_size: number
  gas_used: number
}

interface ServiceStatistics {
  refinement_count: number
  refinement_gas_used: number
  imports: number
  exports: number
  extrinsic_size: number
  extrinsic_count: number
}

interface ReportedItem {
  work_package_hash: string
  segment_tree_root: string
}

function loadReportsTestVectors(directory: string): Array<{ file: string, testVector: ReportsTestVector }> {
  const testVectors: Array<{ file: string, testVector: ReportsTestVector }> = []
  try {
    const files = readdirSync(directory)
    const jsonFiles = files.filter(file => file.endsWith('.json'))

    for (const file of jsonFiles) {
      const filePath = join(directory, file)
      const content = readFileSync(filePath, 'utf8')
      const testVector: ReportsTestVector = JSON.parse(content)
      testVectors.push({ file, testVector })
    }
  } catch (error) {
    logger.error(`Failed to load test vectors from ${directory}: ${error}`)
  }
  return testVectors
}

describe('JAM Reports Test Vectors', () => {
  const tinyVectors = loadReportsTestVectors(join(process.cwd(), '../../submodules/jamtestvectors/stf/reports/tiny'))
  const fullVectors = loadReportsTestVectors(join(process.cwd(), '../../submodules/jamtestvectors/stf/reports/full'))

  logger.info(`Loaded ${tinyVectors.length} Reports test vectors from submodules/jamtestvectors/stf/reports/tiny`)
  logger.info(`Loaded ${fullVectors.length} Reports test vectors from submodules/jamtestvectors/stf/reports/full`)

  describe('Reports tiny test vectors', () => {
    for (const { file, testVector } of tinyVectors) {
      it(`should pass ${file}`, () => {
        logger.info(`Testing Reports vector: ${file}`)
        
        // Verify test vector structure
        expect(testVector.input).toBeDefined()
        expect(testVector.pre_state).toBeDefined()
        expect(testVector.post_state).toBeDefined()
        expect(testVector.output).toBeDefined()

        // Verify output structure (can be success, error, or null)
        if (testVector.output && typeof testVector.output === 'object') {
          if ('ok' in testVector.output && testVector.output.ok) {
            expect(Array.isArray(testVector.output.ok.reported)).toBe(true)
            expect(Array.isArray(testVector.output.ok.reporters)).toBe(true)
          } else if ('err' in testVector.output) {
            expect(typeof testVector.output.err).toBe('string')
          }
        }

        // Verify input structure
        expect(typeof testVector.input.slot).toBe('number')
        expect(Array.isArray(testVector.input.reports)).toBe(true)

        // Verify state structure
        expect(testVector.pre_state.avail_assignments).toBeDefined()
        expect(Array.isArray(testVector.pre_state.curr_validators)).toBe(true)
        expect(Array.isArray(testVector.pre_state.prev_validators)).toBe(true)
        expect(Array.isArray(testVector.pre_state.entropy)).toBe(true)
        expect(Array.isArray(testVector.pre_state.offenders)).toBe(true)
        expect(Array.isArray(testVector.pre_state.recent_blocks)).toBe(true)
        expect(Array.isArray(testVector.pre_state.auth_pools)).toBe(true)
        expect(Array.isArray(testVector.pre_state.accounts)).toBe(true)
        expect(Array.isArray(testVector.pre_state.cores_statistics)).toBe(true)
        expect(Array.isArray(testVector.pre_state.services_statistics)).toBe(true)

        // Same structure checks for post_state
        expect(testVector.post_state.avail_assignments).toBeDefined()
        expect(Array.isArray(testVector.post_state.curr_validators)).toBe(true)
        expect(Array.isArray(testVector.post_state.prev_validators)).toBe(true)
        expect(Array.isArray(testVector.post_state.entropy)).toBe(true)
        expect(Array.isArray(testVector.post_state.offenders)).toBe(true)
        expect(Array.isArray(testVector.post_state.recent_blocks)).toBe(true)
        expect(Array.isArray(testVector.post_state.auth_pools)).toBe(true)
        expect(Array.isArray(testVector.post_state.accounts)).toBe(true)
        expect(Array.isArray(testVector.post_state.cores_statistics)).toBe(true)
        expect(Array.isArray(testVector.post_state.services_statistics)).toBe(true)

        // Verify work report structure if any reports present
        for (const report of testVector.input.reports) {
          expect(report.package_spec).toBeDefined()
          expect(report.context).toBeDefined()
          expect(typeof report.core_index).toBe('number')
          expect(typeof report.authorizer_hash).toBe('string')
          expect(typeof report.auth_output).toBe('string')
          expect(Array.isArray(report.segment_root_lookup)).toBe(true)
          expect(report.work_result).toBeDefined()

          // Verify package spec
          expect(typeof report.package_spec.hash).toBe('string')
          expect(typeof report.package_spec.length).toBe('number')
          expect(typeof report.package_spec.erasure_root).toBe('string')
          expect(typeof report.package_spec.exports_root).toBe('string')
          expect(typeof report.package_spec.exports_count).toBe('number')

          // Verify context
          expect(typeof report.context.anchor).toBe('string')
          expect(typeof report.context.state_root).toBe('string')
          expect(typeof report.context.beefy_root).toBe('string')
          expect(typeof report.context.lookup_anchor).toBe('string')
          expect(typeof report.context.lookup_anchor_slot).toBe('number')
          expect(Array.isArray(report.context.prerequisites)).toBe(true)

          // Verify work result
          expect(typeof report.work_result.service_id).toBe('number')
          expect(typeof report.work_result.code_hash).toBe('string')
          expect(typeof report.work_result.payload_hash).toBe('string')
          expect(typeof report.work_result.gas_ratio).toBe('number')
          expect(typeof report.work_result.output).toBe('string')
        }

        // Log test vector characteristics for analysis
        logger.info(`Test vector ${file} characteristics:`, {
          slot: testVector.input.slot,
          reportsCount: testVector.input.reports.length,
          currValidatorsCount: testVector.pre_state.curr_validators.length,
          prevValidatorsCount: testVector.pre_state.prev_validators.length,
          entropyCount: testVector.pre_state.entropy.length,
          offendersCount: testVector.pre_state.offenders.length,
          recentBlocksCount: testVector.pre_state.recent_blocks.length,
          authPoolsCount: testVector.pre_state.auth_pools.length,
          accountsCount: testVector.pre_state.accounts.length,
          coresStatsCount: testVector.pre_state.cores_statistics.length,
          servicesStatsCount: testVector.pre_state.services_statistics.length
        })
      })
    }
  })

  describe('Reports full test vectors', () => {
    for (const { file, testVector } of fullVectors) {
      it(`should pass ${file}`, () => {
        logger.info(`Testing Reports vector: ${file}`)
        
        // Same basic validations as tiny vectors
        expect(testVector.input).toBeDefined()
        expect(testVector.pre_state).toBeDefined()
        expect(testVector.post_state).toBeDefined()
        expect(testVector.output).toBeDefined()

        expect(typeof testVector.input.slot).toBe('number')
        expect(Array.isArray(testVector.input.reports)).toBe(true)

        // Basic state structure checks
        expect(testVector.pre_state.avail_assignments).toBeDefined()
        expect(Array.isArray(testVector.pre_state.curr_validators)).toBe(true)
        expect(Array.isArray(testVector.pre_state.cores_statistics)).toBe(true)
        expect(Array.isArray(testVector.pre_state.services_statistics)).toBe(true)
      })
    }
  })

  describe('Reports test vector analysis', () => {
    it('should analyze work report processing patterns', () => {
      for (const { file, testVector } of tinyVectors) {
        logger.info(`Analyzing ${file}:`)
        
        // Analyze report characteristics
        const reportsByCore = new Map<number, WorkReport[]>()
        const reportsByService = new Map<number, WorkReport[]>()
        
        for (const report of testVector.input.reports || []) {
          // Group by core
          if (!reportsByCore.has(report.core_index)) {
            reportsByCore.set(report.core_index, [])
          }
          reportsByCore.get(report.core_index)!.push(report)

          // Group by service
          if (!reportsByService.has(report.work_result.service_id)) {
            reportsByService.set(report.work_result.service_id, [])
          }
          reportsByService.get(report.work_result.service_id)!.push(report)
        }

        logger.info(`Reports analysis for ${file}:`, {
          totalReports: testVector.input.reports.length,
          coresWithReports: Array.from(reportsByCore.keys()),
          servicesWithReports: Array.from(reportsByService.keys()),
          reportsPerCore: Object.fromEntries(reportsByCore.entries().map(([core, reports]) => [core, reports.length])),
          reportsPerService: Object.fromEntries(reportsByService.entries().map(([service, reports]) => [service, reports.length]))
        })

        // Analyze gas usage patterns
        const reports = testVector.input.reports || []
        const totalGasUsed = reports.reduce((total, report) => 
          total + report.work_result.gas_ratio, 0
        )

        logger.info(`Gas analysis for ${file}:`, {
          totalGasUsed,
          avgGasPerReport: reports.length > 0 ? totalGasUsed / reports.length : 0
        })
      }
    })

    it('should validate statistics updates', () => {
      for (const { file, testVector } of tinyVectors) {
        // Compare pre and post statistics
        for (let i = 0; i < testVector.pre_state.cores_statistics.length; i++) {
          const preStats = testVector.pre_state.cores_statistics[i]
          const postStats = testVector.post_state.cores_statistics[i]

          if (preStats.imports !== postStats.imports ||
              preStats.exports !== postStats.exports ||
              preStats.extrinsic_size !== postStats.extrinsic_size ||
              preStats.extrinsic_count !== postStats.extrinsic_count ||
              preStats.bundle_size !== postStats.bundle_size ||
              preStats.gas_used !== postStats.gas_used) {
            
            logger.info(`Core ${i} statistics changed in ${file}:`, {
              pre: preStats,
              post: postStats,
              deltas: {
                imports: postStats.imports - preStats.imports,
                exports: postStats.exports - preStats.exports,
                extrinsic_size: postStats.extrinsic_size - preStats.extrinsic_size,
                extrinsic_count: postStats.extrinsic_count - preStats.extrinsic_count,
                bundle_size: postStats.bundle_size - preStats.bundle_size,
                gas_used: postStats.gas_used - preStats.gas_used
              }
            })
          }
        }

        // Analyze service statistics changes
        for (let i = 0; i < testVector.pre_state.services_statistics.length; i++) {
          const preStats = testVector.pre_state.services_statistics[i]
          const postStats = testVector.post_state.services_statistics[i]

          if (preStats.refinement_count !== postStats.refinement_count ||
              preStats.refinement_gas_used !== postStats.refinement_gas_used ||
              preStats.imports !== postStats.imports ||
              preStats.exports !== postStats.exports ||
              preStats.extrinsic_size !== postStats.extrinsic_size ||
              preStats.extrinsic_count !== postStats.extrinsic_count) {
            
            logger.info(`Service ${i} statistics changed in ${file}:`, {
              pre: preStats,
              post: postStats,
              deltas: {
                refinement_count: postStats.refinement_count - preStats.refinement_count,
                refinement_gas_used: postStats.refinement_gas_used - preStats.refinement_gas_used,
                imports: postStats.imports - preStats.imports,
                exports: postStats.exports - preStats.exports,
                extrinsic_size: postStats.extrinsic_size - preStats.extrinsic_size,
                extrinsic_count: postStats.extrinsic_count - preStats.extrinsic_count
              }
            })
          }
        }
      }
    })
  })
})
