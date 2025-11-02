/**
 * Recent History Service Tests
 * 
 * Tests the Gray Paper-compliant recent history management implementation
 */

import { describe, it, expect} from 'bun:test'
import { 
  RecentHistoryService, 
} from '../services/recent-history-service'
import { BlockProcessedEvent, EventBusService, Hex } from '@pbnj/core'
import type { RecentHistoryTestVector } from '@pbnj/types'
import { ConfigService } from '../services/config-service'
import * as fs from 'fs'
import * as path from 'path'


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
): Array<{ name: string; vector: RecentHistoryTestVector }> {
  const testVectorsDir = path.join(
    WORKSPACE_ROOT,
    `submodules/jam-test-vectors/stf/history/${config}`,
  )

  const files = fs.readdirSync(testVectorsDir)
  const jsonFiles = files.filter((file) => file.endsWith('.json'))

  return jsonFiles.map((file) => {
    const filePath = path.join(testVectorsDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const vector = JSON.parse(content)

    return {
      name: file.replace('.json', ''),
      vector,
    }
  })
}



describe('RecentHistoryService - JAM Test Vectors', () => {
  // Test both tiny and full configurations
  for (const configType of ['tiny', 'full'] as const) {
    describe(`Configuration: ${configType}`, () => {


      const configService =
        configType === 'tiny' ? tinyConfigService : fullConfigService
      const testVectors = loadTestVectors(configType)

      const eventBusService = new EventBusService()
      const emittedEvents: BlockProcessedEvent[] = []
  
      // Mock event emission to capture events
      eventBusService.emitBlockProcessed = async (event) => {
        emittedEvents.push(event)
      }
  
      const recentHistoryService = new RecentHistoryService(eventBusService, configService)
      recentHistoryService.start()

      // Ensure we loaded test vectors
      it('should load test vectors', () => {
        expect(testVectors.length).toBeGreaterThan(0)
      })

      // Test each vector
      for (const { name, vector } of testVectors) {
        describe(`Test Vector: ${name}`, () => {
          it('should process recent history according to Gray Paper rules', async () => {

      
      // Set pre-state (empty for test vector 1)
      recentHistoryService.setRecentHistoryFromPreState(vector.pre_state)
      
      // Step 1: Update accoutBelt with accumulate_root
      // Gray Paper: accoutBelt' = mmrappend(accoutBelt, accumulate_root, keccak)
      const [beltError] = recentHistoryService.updateAccoutBeltWithRoot(vector.input.accumulate_root as Hex)
      if (beltError) {
        throw new Error('Failed to update accout belt')
      }
      
      // Step 2: Add new block (computes super-peak from updated belt)
      recentHistoryService.addBlockWithSuperPeak(
        {
          headerHash: vector.input.header_hash as Hex,
          stateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
          reportedPackageHashes: new Map(vector.input.work_packages.map((pkg) => [pkg.hash as Hex, pkg.exports_root as Hex])),
        },
        vector.input.parent_state_root as Hex,
      )
      
      // Get actual output
      const actualOutput = recentHistoryService.getRecentHistory()
      
      // Check output matches expected post_state
      expect(actualOutput.length).toBe(vector.post_state.beta.history.length)
      
      for (let i = 0; i < actualOutput.length; i++) {
        const actual = actualOutput[i]
        const expected = vector.post_state.beta.history[i]
        
        expect(actual.headerHash).toBe(expected.header_hash as Hex)
        expect(actual.stateRoot).toBe(expected.state_root as Hex || '0x0000000000000000000000000000000000000000000000000000000000000000')
        expect(actual.accoutLogSuperPeak).toBe(expected.beefy_root as Hex)
        
        // Check reported packages
        const expectedReported = expected.reported || []
        expect(actual.reportedPackageHashes.size).toBe(expectedReported.length)

        for (const expectedPkg of expectedReported) {
          expect(actual.reportedPackageHashes.get(expectedPkg.hash as Hex)).toBe(expectedPkg.exports_root as Hex)
        }
      }
          })
        })
      }
    })
  }
})
