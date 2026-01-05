/**
 * Assurance Service Test Vectors
 *
 * Tests AssuranceService against JAM test vectors from stf/assurances/tiny and stf/assurances/full
 * Validates Gray Paper compliance for assurance validation
 */

import { describe, expect, it } from 'bun:test'
import { EventBusService} from '@pbnjam/core'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  AssuranceTestVector,
  WorkReport,
} from '@pbnjam/types'
import { AssuranceService } from '../services/assurance-service'
import { ConfigService } from '../services/config-service'
import { ValidatorSetManager } from '../services/validator-set'
import { WorkReportService } from '../services/work-report-service'

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

// Config services for tiny and full
const tinyConfigService = new ConfigService('tiny')
const fullConfigService = new ConfigService('full')

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../')

/**
 * Load all test vector JSON files from the directory for a given configuration
 */
function loadTestVectors(
  config: 'tiny' | 'full',
): Array<{ name: string; vector: AssuranceTestVector }> {
  const testVectorsDir = path.join(
    WORKSPACE_ROOT,
    `submodules/jam-test-vectors/stf/assurances/${config}`,
  )

  const files = fs.readdirSync(testVectorsDir)
  const jsonFiles = files.filter((file) => file.endsWith('.json'))

  return jsonFiles.map((file) => {
    const filePath = path.join(testVectorsDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const vector = JSON.parse(content) as AssuranceTestVector

    return {
      name: file.replace('.json', ''),
      vector,
    }
  })
}

describe('Assurance Service - JAM Test Vectors', () => {
  // Test both tiny and full configurations
  for (const configType of ['tiny', 'full'] as const) {
    describe(`Configuration: ${configType}`, () => {
      const configService =
        configType === 'tiny' ? tinyConfigService : fullConfigService
      const testVectors = loadTestVectors(configType)

      // Ensure we loaded test vectors
      it('should load test vectors', () => {
        expect(testVectors.length).toBeGreaterThan(0)
      })

      // Test each vector
      for (const { name, vector } of testVectors) {
        describe(`Test Vector: ${name}`, () => {
          it('should validate assurances according to Gray Paper rules', () => {
            // Step 1: Create mock services
            // const workReportService = createMockWorkReportService(
            //   vector.pre_state.avail_assignments,
            // )

            const eventBusService = new EventBusService()

            const validatorSetManager = new ValidatorSetManager({
              eventBusService: eventBusService,
              sealKeyService: null,
              ringProver: null as unknown as any,
              ticketService: null,
              configService: configService,
              initialValidators: vector.pre_state.curr_validators.map((validator) => ({
                bandersnatch: validator.bandersnatch,
                ed25519: validator.ed25519,
                bls: validator.bls,
                metadata: validator.metadata,
              })),
            })
            const workReportService = new WorkReportService({
              eventBus: eventBusService,
              networkingService: null,
              ce136WorkReportRequestProtocol: null,
              validatorSetManager: validatorSetManager,
              configService: configService,
              entropyService: null,
              clockService: null,
            })
            // const validatorSetManager = createMockValidatorSetManager(
            //   vector.pre_state.curr_validators,
            // )

            // Step 2: Initialize AssuranceService with mocked dependencies
            const assuranceService = new AssuranceService(
              {
                configService: configService,
                workReportService: workReportService,
                validatorSetManager: validatorSetManager,
                eventBusService: eventBusService,
                sealKeyService: null,
                recentHistoryService: null,
              },
            )

            // Reset assurance counts before each test
            assuranceService.resetAssuranceCounts()

            // add pending work reports from test vector
            for (const assignment of vector.pre_state.avail_assignments) {
              if (assignment) {
                // Convert JSON numbers to correct types
                const report = convertJsonReportToWorkReport(assignment.report)
                // Use assignment.timeout as the timeslot (when the report was created)
                workReportService.addPendingWorkReport(
                  BigInt(Number(assignment.report.core_index)),
                  report,
                  Number(assignment.timeout),
                )
              }
            }

            // Step 3: Validate assurances first
            const [validationError, assuranceCounts] =
              assuranceService.validateAssurances(
                vector.input.assurances,
                vector.input.slot,
                vector.input.parent,
                configService,
              )

            // Step 4: If validation passed, apply assurances
            let transitionError: Error | null = null
            if (!validationError && assuranceCounts) {
              const [applyError] = assuranceService.applyAssurances(
                assuranceCounts,
                vector.input.slot,
                configService,
              )
              transitionError = applyError || null
            } else {
              transitionError = validationError
            }

            // Step 5: Check expected outcome
            if (vector.output && 'err' in vector.output && vector.output.err) {
              // Expected to fail - check if error comes from validation
              if (transitionError) {
                const errorMessage = transitionError.message
                const expectedError = vector.output.err
                expect(errorMessage).toBe(expectedError)
                return // Don't proceed to state transitions if validation failed
              }
              
              
              // Should not reach here if error is expected
              throw new Error('Expected error but none occurred')
            } else {


                            // Should not have any errors in successful cases
                            expect(transitionError).toBeUndefined()

                            // Convert updated reports back to test vector format
                            const expectedPostState = Array.from({ length: vector.pre_state.avail_assignments.length }, (_, idx) => {
                              const updated = workReportService.getCoreReport(BigInt(idx))
                              if (!updated) return null
                              
                              // Convert WorkReport back to JSON format for comparison
                              const jsonReport = convertWorkReportToJson(updated.workReport)
                              return { report: jsonReport, timeout: updated.timeslot }
                            })
              
                            // Verify post-state matches
                            expect(vector.post_state.avail_assignments).toEqual(expectedPostState)
                            
                            // Validators don't change from assurances
                            expect(vector.post_state.curr_validators).toEqual(
                              vector.pre_state.curr_validators,
                            )

            }

          })

        })
      }
    })
  }
})

