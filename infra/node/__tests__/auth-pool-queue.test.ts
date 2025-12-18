/**
 * AuthPool and AuthQueue Service Test Vectors
 *
 * Tests both services against JAM test vectors from stf/authorizations/tiny
 * Validates Gray Paper compliance for authorization state transitions
 */

import { describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AuthPool, AuthQueue } from '@pbnjam/types'
import type { Hex } from 'viem'
import { AuthPoolService } from '../services/auth-pool-service'
import { AuthQueueService } from '../services/auth-queue-service'
import { ConfigService } from '../services/config-service'
import { WorkReportService } from '../services/work-report-service'
import { EventBusService } from '@pbnjam/core'

// Test vector interface
interface AuthorizationTestVector {
  input: {
    slot: number
    auths: Array<{ core: number; auth_hash: Hex }> // Authorizer hashes used in guaranteed work reports
  }
  pre_state: {
    auth_pools: Hex[][]
    auth_queues: Hex[][]
  }
  output: null
  post_state: {
    auth_pools: Hex[][]
    auth_queues: Hex[][]
  }
}

// Mock config service for tiny test vectors (2 cores)
const tinyConfigService = new ConfigService('tiny')
const fullConfigService = new ConfigService('full')

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../')

/**
 * Load all test vector JSON files from the directory for a given configuration
 */
function loadTestVectors(
  config: 'tiny' | 'full',
): Array<{ name: string; vector: AuthorizationTestVector }> {
  const testVectorsDir = path.join(
    WORKSPACE_ROOT,
    `submodules/jam-test-vectors/stf/authorizations/${config}`,
  )

  const files = fs.readdirSync(testVectorsDir)
  const jsonFiles = files.filter((file) => file.endsWith('.json'))

  return jsonFiles.map((file) => {
    const filePath = path.join(testVectorsDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const vector = JSON.parse(content) as AuthorizationTestVector

    return {
      name: file.replace('.json', ''),
      vector,
    }
  })
}

describe('AuthPool and AuthQueue Services - JAM Test Vectors', () => {
  // Test both tiny and full configurations
  for (const configType of ['tiny', 'full'] as const) {
    describe(`Configuration: ${configType}`, () => {
      const configService = configType === 'tiny' ? tinyConfigService : fullConfigService
      const testVectors = loadTestVectors(configType)

      // Ensure we loaded test vectors
      it('should load test vectors', () => {
        expect(testVectors.length).toBeGreaterThan(0)
      })

      // Test each vector
      for (const { name, vector } of testVectors) {
        describe(`Test Vector: ${name}`, () => {
          it('should correctly transition auth pool and queue states', () => {
            // Step 1: Initialize services with pre-state
            const authQueueService = new AuthQueueService({configService: configService})
            const workReportService = new WorkReportService({
              eventBus: new EventBusService(),
              networkingService: null,
              ce136WorkReportRequestProtocol: null,
              validatorSetManager: null,
              configService: configService,
              entropyService: null,
              clockService: null,
            })

            const authPoolService = new AuthPoolService({
              configService: configService,
              workReportService: workReportService,
              eventBusService: new EventBusService(),
              authQueueService: authQueueService,
            })

            // Set pre-state (deep clone to avoid test interference)
            const clonedAuthPool = JSON.parse(
              JSON.stringify(vector.pre_state.auth_pools),
            ) as AuthPool
            const clonedAuthQueue = JSON.parse(
              JSON.stringify(vector.pre_state.auth_queues),
            ) as AuthQueue

            authPoolService.setAuthPool(clonedAuthPool)
            authQueueService.setAuthQueue(clonedAuthQueue)

            // Verify pre-state was set correctly
            expect(authPoolService.getAuthPool()).toEqual(vector.pre_state.auth_pools)
            expect(authQueueService.getAuthQueue()).toEqual(vector.pre_state.auth_queues)

        // Parse auths from test vector format: { core, auth_hash }
        for (const auth of vector.input.auths) {
          workReportService.setAuthorizerHashByCore(auth.core, auth.auth_hash)
        }

        // Step 3: Set auth queue cache for the pool service
        authQueueService.setAuthQueue(vector.pre_state.auth_queues as AuthQueue)

        // Step 4: Trigger block transition on auth pool
        const [poolError] = authPoolService.onBlockTransition(
          BigInt(vector.input.slot)
        )

        expect(poolError).toBeUndefined()

        // Step 5: Get post-transition states
        const actualAuthPool = authPoolService.getAuthPool()
        const actualAuthQueue = authQueueService.getAuthQueue()

        // Step 6: Verify auth pool matches expected post-state
        expect(actualAuthPool).toEqual(vector.post_state.auth_pools)

        // Step 7: Verify auth queue matches expected post-state
        // Note: Auth queue doesn't change during block processing in these test vectors
        // It only changes during accumulation (which is tested separately)
        expect(actualAuthQueue).toEqual(vector.post_state.auth_queues)

            // Additional validation: Check pool sizes
            for (let coreIndex = 0; coreIndex < configService.numCores; coreIndex++) {
              const corePool = actualAuthPool[coreIndex]
              expect(corePool.length).toBeLessThanOrEqual(8) // C_authpoolsize = 8

              // Verify all hashes are valid (32-byte hex strings)
              for (const hash of corePool) {
                expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/)
              }
            }
          })
        })
      }
    })
  }
})

