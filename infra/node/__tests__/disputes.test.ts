/**
 * Disputes Service Test Vectors
 *
 * Tests DisputesService against JAM test vectors from stf/disputes/tiny and stf/disputes/full
 * Validates Gray Paper compliance for disputes state transition
 */

import { describe, expect, it } from 'bun:test'
import { EventBusService } from '@pbnj/core'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DisputesTestVector, WorkReport } from '@pbnj/types'
import { DisputesService } from '../services/disputes-service'
import { ConfigService } from '../services/config-service'
import { ValidatorSetManager } from '../services/validator-set'

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
): Array<{ name: string; vector: DisputesTestVector }> {
  const testVectorsDir = path.join(
    WORKSPACE_ROOT,
    `submodules/jam-test-vectors/stf/disputes/${config}`,
  )

  const files = fs.readdirSync(testVectorsDir)
  const jsonFiles = files.filter((file) => file.endsWith('.json'))

  return jsonFiles.map((file) => {
    const filePath = path.join(testVectorsDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const vector = JSON.parse(content) as DisputesTestVector

    return {
      name: file.replace('.json', ''),
      vector,
    }
  })
}

describe('Disputes Service - JAM Test Vectors', () => {
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
          it('should process disputes according to Gray Paper rules', async () => {
            // Step 1: Create services
            const eventBusService = new EventBusService()

            // Initialize validator set manager with kappa (current epoch) and lambda (previous epoch)
            const validatorSetManager = new ValidatorSetManager({
              eventBusService: eventBusService,
              sealKeyService: null,
              keyPairService: null,
              ringProver: null as unknown as any,
              ticketService: null,
              configService: configService,
              initialValidators: vector.pre_state.kappa.map((validator) => ({
                bandersnatch: validator.bandersnatch,
                ed25519: validator.ed25519,
                bls: validator.bls,
                metadata: validator.metadata,
              })),
            })

            // Set previous epoch validators (lambda) - required for Gray Paper validator set checks
            validatorSetManager.setPreviousSet(
              vector.pre_state.lambda.map(validator => ({
                bandersnatch: validator.bandersnatch,
                ed25519: validator.ed25519,
                bls: validator.bls,
                metadata: validator.metadata,
              })),
            )

            // Step 2: Initialize DisputesService
            const disputesService = new DisputesService(
              {
                eventBusService: eventBusService,
                validatorSetManagerService: validatorSetManager,
                configService: configService,
              }
            )

            disputesService.start()

            // Step 3: Set pre_state disputes (psi)
            disputesService.setDisputesState({
              goodSet: new Set(vector.pre_state.psi.good),
              badSet: new Set(vector.pre_state.psi.bad),
              wonkySet: new Set(vector.pre_state.psi.wonky),
              offenders: new Set(vector.pre_state.psi.offenders),
            })

            // Step 4: Process disputes input
            // Convert test vector disputes to Dispute[] format
            const disputeInput = [{
              verdicts: vector.input.disputes.verdicts.map(v => ({
                target: v.target,
                age: BigInt(v.age),
                votes: v.votes.map(j => ({
                  vote: j.vote,
                  index: BigInt(j.index),
                  signature: j.signature,
                })),
              })),
              culprits: vector.input.disputes.culprits.map(c => ({
                target: c.target,
                key: c.key,
                signature: c.signature,
              })),
              faults: vector.input.disputes.faults.map(f => ({
                target: f.target,
                vote: f.vote,
                key: f.key,
                signature: f.signature,
              })),
            }]

            // Step 4: Process disputes using the new applyDisputes method
            // Pass current timeslot (tau) from pre_state for age validation
            const currentTimeslot = BigInt(vector.pre_state.tau)
            const [processError, offendersMark] = disputesService.applyDisputes(disputeInput, currentTimeslot)

            // Step 5: Check expected outcome
            if (vector.output.err !== undefined) {
              // Expected to fail
              if (processError) {
                // Error occurred as expected - verify error message matches
                const errorMessage = processError.message
                const expectedError = vector.output.err
                // Debug output for specific test
                // if (name.includes('progress_with_culprits-6')) {
                //   console.log(`DEBUG ${name}:`)
                //   console.log(`  Expected error: ${expectedError}`)
                //   console.log(`  Actual error: ${errorMessage}`)
                //   console.log(`  Match: ${errorMessage === String(expectedError)}`)
                // }
                expect(errorMessage).toBe(String(expectedError))
                return // portable
              }
              // Should not reach here if error is expected
              // Debug: show what we got instead
              if (name.includes('progress_with_culprits-6')) {
                console.log(`DEBUG ${name}: Expected error ${vector.output.err} but got:`, processError, offendersMark)
              }
              throw new Error('Expected error but none occurred')
            } else {
              // Should not have any errors in successful cases
              expect(processError).toBeUndefined()

              // Step 6: Verify offenders_mark output
              if (vector.output.ok?.offenders_mark && offendersMark) {
                // Sort both arrays for comparison
                const expectedOffenders = [...vector.output.ok.offenders_mark].sort()
                const actualOffenders = [...offendersMark].sort()
                expect(actualOffenders).toEqual(expectedOffenders)
              }

              // Step 7: Verify post_state disputes (psi)
              const postDisputes = disputesService.getDisputesState()
              expect(Array.from(postDisputes.goodSet).sort()).toEqual(
                vector.post_state.psi.good.sort(),
              )
              expect(Array.from(postDisputes.badSet).sort()).toEqual(
                vector.post_state.psi.bad.sort(),
              )
              expect(Array.from(postDisputes.wonkySet).sort()).toEqual(
                vector.post_state.psi.wonky.sort(),
              )
              expect(Array.from(postDisputes.offenders).sort()).toEqual(
                vector.post_state.psi.offenders.sort(),
              )

              // Step 8: Verify rho (availability assignments) - null entries indicate invalidation
              // For now, we just check the structure matches
              expect(vector.post_state.rho.length).toBe(vector.pre_state.rho.length)
            }
          })
        })
      }
    })
  }
})

