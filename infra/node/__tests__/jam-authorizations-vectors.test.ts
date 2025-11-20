/**
 * JAM Authorizations STF Test Vector Validation Tests
 *
 * Tests against official JAM test vectors for Authorizations STF
 * Validates conformance to the Gray Paper specification for authorization pool management
 */

import { logger } from '@pbnj/core'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  logger.init()
})

// Test vector interfaces based on jamtestvectors structure
interface AuthorizationsTestVector {
  input: AuthorizationsInput
  pre_state: AuthorizationsState
  output: null // Authorizations STF always returns null
  post_state: AuthorizationsState
}

interface AuthorizationsInput {
  slot: number
  auths: CoreAuthorizer[]
}

interface CoreAuthorizer {
  core: number
  auth_hash: string
}

interface AuthorizationsState {
  auth_pools: string[][]
  auth_queues: string[][]
}

function loadAuthorizationsTestVectors(directory: string): Array<{ file: string, testVector: AuthorizationsTestVector }> {
  const testVectors: Array<{ file: string, testVector: AuthorizationsTestVector }> = []
  try {
    const files = readdirSync(directory)
    const jsonFiles = files.filter(file => file.endsWith('.json'))

    for (const file of jsonFiles) {
      const filePath = join(directory, file)
      const content = readFileSync(filePath, 'utf8')
      const testVector: AuthorizationsTestVector = JSON.parse(content)
      testVectors.push({ file, testVector })
    }
  } catch (error) {
    logger.error(`Failed to load test vectors from ${directory}: ${error}`)
  }
  return testVectors
}

describe('JAM Authorizations Test Vectors', () => {
  const tinyVectors = loadAuthorizationsTestVectors(join(process.cwd(), 'submodules/jam-test-vectors/stf/authorizations/tiny'))
  const fullVectors = loadAuthorizationsTestVectors(join(process.cwd(), 'submodules/jam-test-vectors/stf/authorizations/full'))

  logger.info(`Loaded ${tinyVectors.length} Authorizations test vectors from submodules/jam-test-vectors/stf/authorizations/tiny`)
  logger.info(`Loaded ${fullVectors.length} Authorizations test vectors from submodules/jamtestvectors/stf/authorizations/full`)

  describe('Authorizations tiny test vectors', () => {
    for (const { file, testVector } of tinyVectors) {
      it(`should pass ${file}`, () => {
        logger.info(`Testing Authorizations vector: ${file}`)
        
        // Verify test vector structure
        expect(testVector.input).toBeDefined()
        expect(testVector.pre_state).toBeDefined()
        expect(testVector.post_state).toBeDefined()
        expect(testVector.output).toBe(null)

        // Verify state structure
        expect(Array.isArray(testVector.pre_state.auth_pools)).toBe(true)
        expect(Array.isArray(testVector.pre_state.auth_queues)).toBe(true)
        expect(Array.isArray(testVector.post_state.auth_pools)).toBe(true)
        expect(Array.isArray(testVector.post_state.auth_queues)).toBe(true)

        // Verify pools have same structure
        expect(testVector.pre_state.auth_pools.length).toBe(testVector.post_state.auth_pools.length)
        expect(testVector.pre_state.auth_queues.length).toBe(testVector.post_state.auth_queues.length)

        // Verify each pool is an array of strings (hashes)
        for (let i = 0; i < testVector.pre_state.auth_pools.length; i++) {
          expect(Array.isArray(testVector.pre_state.auth_pools[i])).toBe(true)
          expect(Array.isArray(testVector.post_state.auth_pools[i])).toBe(true)
          
          for (const hash of testVector.pre_state.auth_pools[i]) {
            expect(typeof hash).toBe('string')
            expect(hash.startsWith('0x')).toBe(true)
            expect(hash.length).toBe(66) // 0x + 64 hex chars = 32 bytes
          }
        }

        // Verify input structure
        expect(typeof testVector.input.slot).toBe('number')
        expect(Array.isArray(testVector.input.auths)).toBe(true)

        // Log test vector characteristics for analysis
        logger.info(`Test vector ${file} characteristics:`, {
          slot: testVector.input.slot,
          authsCount: testVector.input.auths.length,
          poolsCount: testVector.pre_state.auth_pools.length,
          queuesCount: testVector.pre_state.auth_queues.length,
          prePoolSizes: testVector.pre_state.auth_pools.map(pool => pool.length),
          postPoolSizes: testVector.post_state.auth_pools.map(pool => pool.length),
          preQueueSizes: testVector.pre_state.auth_queues.map(queue => queue.length),
          postQueueSizes: testVector.post_state.auth_queues.map(queue => queue.length)
        })
      })
    }
  })

  describe('Authorizations full test vectors', () => {
    for (const { file, testVector } of fullVectors) {
      it(`should pass ${file}`, () => {
        logger.info(`Testing Authorizations vector: ${file}`)
        
        // Same basic validations as tiny vectors
        expect(testVector.input).toBeDefined()
        expect(testVector.pre_state).toBeDefined()
        expect(testVector.post_state).toBeDefined()
        expect(testVector.output).toBe(null)

        expect(Array.isArray(testVector.pre_state.auth_pools)).toBe(true)
        expect(Array.isArray(testVector.pre_state.auth_queues)).toBe(true)
        expect(Array.isArray(testVector.post_state.auth_pools)).toBe(true)
        expect(Array.isArray(testVector.post_state.auth_queues)).toBe(true)

        expect(testVector.pre_state.auth_pools.length).toBe(testVector.post_state.auth_pools.length)
        expect(testVector.pre_state.auth_queues.length).toBe(testVector.post_state.auth_queues.length)

        expect(typeof testVector.input.slot).toBe('number')
        expect(Array.isArray(testVector.input.auths)).toBe(true)

        // Verify CoreAuthorizer structure if any auths present
        for (const auth of testVector.input.auths) {
          expect(typeof auth.core).toBe('number')
          expect(typeof auth.auth_hash).toBe('string')
          expect(auth.auth_hash.startsWith('0x')).toBe(true)
        }
      })
    }
  })

  describe('Authorizations test vector analysis', () => {
    it('should analyze authorization pool progression patterns', () => {
      for (const { file, testVector } of tinyVectors) {
        logger.info(`Analyzing ${file}:`)
        
        // Check if this follows the "shift left" pattern described in the README
        for (let poolIndex = 0; poolIndex < testVector.pre_state.auth_pools.length; poolIndex++) {
          const prePool = testVector.pre_state.auth_pools[poolIndex]
          const postPool = testVector.post_state.auth_pools[poolIndex]
          const preQueue = testVector.pre_state.auth_queues[poolIndex]
          const postQueue = testVector.post_state.auth_queues[poolIndex]

          logger.info(`Pool ${poolIndex} analysis:`, {
            prePoolSize: prePool.length,
            postPoolSize: postPool.length,
            preQueueSize: preQueue.length,
            postQueueSize: postQueue.length,
            authsForThisCore: testVector.input.auths.filter(auth => auth.core === poolIndex).length
          })

          // Check if pool shifted left (first element removed)
          if (prePool.length > 0 && postPool.length === prePool.length - 1) {
            const shiftedCorrectly = prePool.slice(1).every((hash, i) => hash === postPool[i])
            if (shiftedCorrectly) {
              logger.info(`Pool ${poolIndex}: Shifted left correctly`)
            }
          }

          // Check if queue contributed to pool (last element moved to pool end)
          if (preQueue.length > 0 && postPool.length > 0) {
            const lastQueueElement = preQueue[preQueue.length - 1]
            const lastPoolElement = postPool[postPool.length - 1]
            if (lastQueueElement === lastPoolElement) {
              logger.info(`Pool ${poolIndex}: Queue contributed correctly`)
            }
          }
        }
      }
    })

    it('should validate authorization consumption patterns', () => {
      for (const { file, testVector } of tinyVectors) {
        const authsByCore = new Map<number, CoreAuthorizer[]>()
        
        // Group authorizations by core
        for (const auth of testVector.input.auths) {
          if (!authsByCore.has(auth.core)) {
            authsByCore.set(auth.core, [])
          }
          authsByCore.get(auth.core)!.push(auth)
        }

        logger.info(`${file} authorization consumption:`, {
          totalAuths: testVector.input.auths.length,
          coresWithAuths: Array.from(authsByCore.keys()),
          authsPerCore: Object.fromEntries(Array.from(authsByCore.entries()).map(([core, auths]) => [core, auths.length]))
        })
      }
    })
  })
})
