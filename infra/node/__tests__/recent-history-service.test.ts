/**
 * Recent History Service Tests
 * 
 * Tests the Gray Paper-compliant recent history management implementation
 */

import { describe, it, expect, beforeEach} from 'bun:test'
import { 
  RecentHistoryService, 
} from '../services/recent-history-service'
import { EventBusService, Hex } from '@pbnj/core'
import type { RecentHistoryTestVector, RecentHistoryEntry } from '@pbnj/types'
import { ConfigService } from '../services/config-service'
import * as fs from 'fs'
import * as path from 'path'

describe('RecentHistoryService', () => {
  let recentHistoryService: RecentHistoryService
  let eventBusService: EventBusService
  let emittedEvents: any[] = []

  beforeEach(() => {
    eventBusService = new EventBusService()
    emittedEvents = []

    // Mock event emission to capture events
    eventBusService.emitBlockProcessed = async (event) => {
      emittedEvents.push(event)
    }

    recentHistoryService = new RecentHistoryService(eventBusService, new ConfigService('tiny'))
    recentHistoryService.start()
  })


  describe('Test Vectors', () => {
    const testVectorDir = path.join(
      process.cwd(),
      '..',
      '..',
      '..',
      'submodules',
      'jam-test-vectors',
      'stf',
      'history',
      'tiny'
    )

    it('should load and execute progress_blocks_history-1', () => {
      const testFile = path.join(testVectorDir, 'progress_blocks_history-1.json')
      const testData: RecentHistoryTestVector = JSON.parse(fs.readFileSync(testFile, 'utf-8'))
      
      // Create a fresh service
      const testService = new RecentHistoryService(eventBusService, new ConfigService('tiny'))
      testService.start()
      
      // Set pre-state (empty for test vector 1)
      testService.setRecentHistoryFromPreState(testData.pre_state)
      
      // Step 1: Update accoutBelt with accumulate_root
      // Gray Paper: accoutBelt' = mmrappend(accoutBelt, accumulate_root, keccak)
      const [beltError] = testService.updateAccoutBeltWithRoot(testData.input.accumulate_root as Hex)
      if (beltError) {
        throw new Error('Failed to update accout belt')
      }
      
      // Step 2: Add new block (computes super-peak from updated belt)
      testService.addBlockWithSuperPeak(
        {
          headerHash: testData.input.header_hash as Hex,
          stateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
          reportedPackageHashes: new Map(testData.input.work_packages.map((pkg) => [pkg.hash as Hex, pkg.exports_root as Hex])),
        },
        testData.input.parent_state_root as Hex,
      )
      
      // Get actual output
      const actualOutput = testService.getRecentHistory()
      
      // Check output matches expected post_state
      expect(actualOutput.length).toBe(testData.post_state.beta.history.length)
      
      for (let i = 0; i < actualOutput.length; i++) {
        const actual = actualOutput[i]
        const expected = testData.post_state.beta.history[i]
        
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

    it('should load and execute progress_blocks_history-2', () => {
      const testFile = path.join(testVectorDir, 'progress_blocks_history-2.json')
      const testData: RecentHistoryTestVector = JSON.parse(fs.readFileSync(testFile, 'utf-8'))
      
      // Create a fresh service
      const testService = new RecentHistoryService(eventBusService, new ConfigService('tiny'))
      testService.start()
      
      // Set pre-state
      testService.setRecentHistoryFromPreState(testData.pre_state)
      
      // Step 1: Update accoutBelt with accumulate_root
      const [beltError] = testService.updateAccoutBeltWithRoot(testData.input.accumulate_root as Hex)
      if (beltError) {
        throw new Error('Failed to update accout belt')
      }
      
      // Step 2: Add new block
      testService.addBlockWithSuperPeak(
        {
          headerHash: testData.input.header_hash as Hex,
          stateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
          reportedPackageHashes: new Map(testData.input.work_packages.map((pkg) => [pkg.hash as Hex, pkg.exports_root as Hex])),
        },
        testData.input.parent_state_root as Hex,
      )
      
      // Get actual output
      const actualOutput = testService.getRecentHistory()
      
      // Check output matches expected post_state
      expect(actualOutput.length).toBe(testData.post_state.beta.history.length)
      
      for (let i = 0; i < actualOutput.length; i++) {
        const actual = actualOutput[i]
        const expected = testData.post_state.beta.history[i]
        
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

    it('should run all test vectors in sequence', () => {
      const testFiles = [
        'progress_blocks_history-1.json',
        'progress_blocks_history-2.json',
        'progress_blocks_history-3.json',
        'progress_blocks_history-4.json',
      ]
      
      const testService = new RecentHistoryService(eventBusService, new ConfigService('tiny'))
      testService.start()
      
      for (const testFile of testFiles) {
        const testPath = path.join(testVectorDir, testFile)
        if (!fs.existsSync(testPath)) {
          console.warn(`Test vector not found: ${testFile}`)
          continue
        }
        
        const testData: RecentHistoryTestVector = JSON.parse(fs.readFileSync(testPath, 'utf-8'))
        
        // Set pre-state
        testService.setRecentHistoryFromPreState(testData.pre_state)
        
        // Step 1: Update accoutBelt with accumulate_root
        const [beltError] = testService.updateAccoutBeltWithRoot(testData.input.accumulate_root as Hex)
        if (beltError) {
          throw new Error('Failed to update accout belt')
        }
        
        // Step 2: Add new block
        testService.addBlockWithSuperPeak(
          {
            headerHash: testData.input.header_hash as Hex,
            stateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
            reportedPackageHashes: new Map(testData.input.work_packages.map((pkg) => [pkg.hash as Hex, pkg.exports_root as Hex])),
          },
          testData.input.parent_state_root as Hex,
        )
        
        // Get actual output
        const actualOutput = testService.getRecentHistory()
        const expectedOutput = testData.post_state.beta.history
        
        // Verify output
        expect(actualOutput.length).toBe(expectedOutput.length)
        
        for (let i = 0; i < actualOutput.length; i++) {
          const actual = actualOutput[i]
          const expected = expectedOutput[i]
          
          expect(actual.headerHash).toBe(expected.header_hash as Hex)
          expect(actual.accoutLogSuperPeak).toBe(expected.beefy_root as Hex)
          expect(actual.reportedPackageHashes.size).toBe((expected.reported || []).length)
        }
      }
    })
  })
})