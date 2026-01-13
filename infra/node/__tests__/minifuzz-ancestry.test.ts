/**
 * Minifuzz Ancestry Test
 *
 * Tests block import with fork handling support as per jam-conformance.
 * Supports both 'no_forks' and 'forks' test vectors.
 *
 * Fork handling (per jam-conformance fuzz-proto README):
 * - Mutations are siblings of original block (same parent)
 * - Mutations should fail import with an error
 * - Original blocks should succeed and update state
 * - Mutations are never used as parents for subsequent blocks
 */

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { decodeFuzzMessage } from '@pbnjam/codec'
import { FuzzMessageType } from '@pbnjam/types'
import { initializeServices } from './test-utils'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../')

// Test configuration via environment variables
const TEST_MODE = process.env.TEST_MODE || 'forks' // 'forks' or 'no_forks'
const JAM_VERSION = process.env.JAM_VERSION || '0.7.2'
const ANCESTRY_ENABLED = process.env.ANCESTRY_ENABLED !== 'false' // Default: enabled
const MAX_BLOCKS = parseInt(process.env.MAX_BLOCKS || '0', 10) // 0 = all blocks
const FAIL_FAST = process.env.FAIL_FAST !== 'false' // Default: true - fail on first mismatch

/**
 * Represents the expected outcome for a block import
 */
interface ExpectedOutcome {
  type: 'state_root' | 'error'
  stateRoot?: string
  errorMessage?: string
}

/**
 * Load expected outcome for a given file number
 */
function loadExpectedOutcome(examplesDir: string, fileNumber: number): ExpectedOutcome | null {
  const paddedNumber = String(fileNumber).padStart(8, '0')

  // Check for state root response
  const stateRootPath = path.join(examplesDir, `${paddedNumber}_target_state_root.json`)
  if (existsSync(stateRootPath)) {
    try {
      const stateRootJson = JSON.parse(readFileSync(stateRootPath, 'utf-8'))
      return {
        type: 'state_root',
        stateRoot: stateRootJson.state_root?.toLowerCase(),
      }
    } catch {
      return null
    }
  }

  // Check for error response
  const errorPath = path.join(examplesDir, `${paddedNumber}_target_error.json`)
  if (existsSync(errorPath)) {
    try {
      const errorJson = JSON.parse(readFileSync(errorPath, 'utf-8'))
      return {
        type: 'error',
        errorMessage: errorJson.error,
      }
    } catch {
      return null
    }
  }

  return null
}

/**
 * Decode a fuzzer message from binary file with length prefix handling
 */
function decodeMessageFromFile(
  filePath: string,
  configService: any,
): { type: FuzzMessageType; payload: any } {
  const bin = new Uint8Array(readFileSync(filePath))

  // Handle 4-byte length prefix if present
  let messageData: Uint8Array
  if (bin.length >= 4) {
    const lengthPrefix = new DataView(bin.buffer, bin.byteOffset, 4).getUint32(0, true)
    if (lengthPrefix === bin.length - 4) {
      messageData = bin.subarray(4)
    } else {
      messageData = bin
    }
  } else {
    messageData = bin
  }

  return decodeFuzzMessage(messageData, configService)
}

describe('Minifuzz Ancestry Test', () => {
  it(`should handle block imports with ${TEST_MODE} test vectors`, async () => {
    // Initialize services
    const services = await initializeServices()
    const { stateService, blockImporterService, recentHistoryService, configService } = services

    // Configure ancestry validation based on test mode
    if (!ANCESTRY_ENABLED) {
      // Disable ancestry validation by patching isValidAnchor
      // According to fuzz-proto README: "When this feature is disabled, the check
      // described in the GP reference should also be skipped."
      recentHistoryService.isValidAnchor = () => true
      console.log('🔓 Ancestry validation disabled (isValidAnchor always returns true)')
    } else {
      console.log('🔒 Ancestry validation enabled')
    }

    // Examples directory
    const examplesDir = path.join(
      WORKSPACE_ROOT,
      `submodules/jam-conformance/fuzz-proto/examples/${JAM_VERSION}/${TEST_MODE}`,
    )

    if (!existsSync(examplesDir)) {
      throw new Error(`Test vectors directory not found: ${examplesDir}`)
    }

    console.log(`\n📁 Using test vectors from: ${examplesDir}`)
    console.log(`📋 Test mode: ${TEST_MODE}`)
    console.log(`📋 JAM version: ${JAM_VERSION}`)
    console.log(`📋 Ancestry enabled: ${ANCESTRY_ENABLED}`)
    console.log(`📋 Fail fast: ${FAIL_FAST}`)

    // Load PeerInfo message to get JAM version
    const peerInfoJsonPath = path.join(examplesDir, '00000000_fuzzer_peer_info.json')
    let jamVersion = { major: 0, minor: 7, patch: 0 }
    try {
      const peerInfoJson = JSON.parse(readFileSync(peerInfoJsonPath, 'utf-8'))
      if (peerInfoJson.jam_version) {
        jamVersion = peerInfoJson.jam_version
        console.log(`📋 JAM version from PeerInfo: ${jamVersion.major}.${jamVersion.minor}.${jamVersion.patch}`)
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load PeerInfo, using default JAM version`)
    }
    configService.jamVersion = jamVersion

    // Load Initialize message
    const initializeBinPath = path.join(examplesDir, '00000001_fuzzer_initialize.bin')
    const initMessage = decodeMessageFromFile(initializeBinPath, configService)
    if (initMessage.type !== FuzzMessageType.Initialize) {
      throw new Error(`Expected Initialize message, got ${initMessage.type}`)
    }
    const init = initMessage.payload as any

    console.log(`\n📋 Initialize message loaded: ${init.keyvals?.length || 0} keyvals`)

    // Handle ancestry from Initialize message
    // jam-conformance: The Initialize message includes ancestors for lookup anchor validation
    if (init.ancestors && init.ancestors.length > 0) {
      console.log(`📋 Ancestors provided: ${init.ancestors.length} block hashes`)
      recentHistoryService.initializeAncestry(init.ancestors)
      console.log(`✅ Ancestry initialized with ${init.ancestors.length} block hashes`)
    }

    // Set initial state
    const [setStateError] = stateService.setState(init.keyvals)
    if (setStateError) {
      console.log(`⚠️  Warning during setState: ${setStateError.message}`)
    }
    console.log(`✅ Initial state set from ${init.keyvals?.length || 0} keyvals`)

    // Verify initial state root against expected
    const [initStateRootError, initStateRoot] = stateService.getStateRoot()
    expect(initStateRootError).toBeUndefined()
    
    // Load expected initial state root from target_state_root.json for Initialize message
    const initExpectedStateRootPath = path.join(examplesDir, '00000001_target_state_root.json')
    let expectedInitStateRoot: string | null = null
    if (existsSync(initExpectedStateRootPath)) {
      try {
        const expectedJson = JSON.parse(readFileSync(initExpectedStateRootPath, 'utf-8'))
        expectedInitStateRoot = expectedJson.state_root?.toLowerCase()
      } catch {
        // Ignore
      }
    }

    console.log(`\n🌳 Initial State Root:`)
    console.log(`   Our computed:  ${initStateRoot}`)
    if (expectedInitStateRoot) {
      console.log(`   Expected:      ${expectedInitStateRoot}`)
      const initMatch = initStateRoot?.toLowerCase() === expectedInitStateRoot
      console.log(`   Match: ${initMatch ? '✅' : '❌'}`)
      
      if (!initMatch && FAIL_FAST) {
        throw new Error(
          `Initial state root mismatch after Initialize!\n` +
          `   Expected: ${expectedInitStateRoot}\n` +
          `   Got:      ${initStateRoot?.toLowerCase()}\n` +
          `This indicates the Initialize message's state keyvals are not being decoded/set correctly.`
        )
      }
    }

    // Discover all ImportBlock files
    const allFiles = readdirSync(examplesDir)
    const importBlockFiles = allFiles
      .filter((file) => file.endsWith('_fuzzer_import_block.bin'))
      .sort((a, b) => {
        const numA = parseInt(a.substring(0, 8), 10)
        const numB = parseInt(b.substring(0, 8), 10)
        return numA - numB
      })

    // Apply max blocks limit if set
    const blocksToProcess = MAX_BLOCKS > 0 ? importBlockFiles.slice(0, MAX_BLOCKS) : importBlockFiles

    console.log(`\n📦 Found ${importBlockFiles.length} blocks to import`)
    if (MAX_BLOCKS > 0) {
      console.log(`📦 Processing first ${blocksToProcess.length} blocks (MAX_BLOCKS=${MAX_BLOCKS})`)
    }

    // Statistics
    let successCount = 0
    let expectedErrorCount = 0
    let unexpectedErrorCount = 0
    let stateRootMismatchCount = 0

    // Process each block
    for (const testFile of blocksToProcess) {
      const fileNumber = parseInt(testFile.substring(0, 8), 10)
      const blockBinPath = path.join(examplesDir, testFile)

      // Decode block
      let blockMessage
      try {
        blockMessage = decodeMessageFromFile(blockBinPath, configService)
        if (blockMessage.type !== FuzzMessageType.ImportBlock) {
          console.error(`❌ Expected ImportBlock, got ${blockMessage.type} in ${testFile}`)
          unexpectedErrorCount++
          if (FAIL_FAST) {
            throw new Error(`Unexpected message type in ${testFile}: expected ImportBlock, got ${blockMessage.type}`)
          }
          continue
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Unexpected message type')) {
          throw error // Re-throw fail-fast errors
        }
        console.error(`❌ Failed to decode ${testFile}: ${error instanceof Error ? error.message : String(error)}`)
        unexpectedErrorCount++
        if (FAIL_FAST) {
          throw new Error(`Failed to decode ${testFile}: ${error instanceof Error ? error.message : String(error)}`)
        }
        continue
      }

      const block = (blockMessage.payload as any).block
      const timeslot = block?.header?.timeslot
      const parentHash = block?.header?.parent?.substring(0, 18) + '...'

      // Load expected outcome
      const expected = loadExpectedOutcome(examplesDir, fileNumber)

      // Import the block
      const [importError] = await blockImporterService.importBlock(block)

      if (expected?.type === 'error') {
        // Expected to fail (mutation block)
        if (importError) {
          console.log(`✅ Block ${fileNumber} (slot ${timeslot}): Expected error, got error`)
          expectedErrorCount++
        } else {
          console.error(`❌ Block ${fileNumber} (slot ${timeslot}): Expected error but import succeeded`)
          console.error(`   Expected error: ${expected.errorMessage}`)
          unexpectedErrorCount++
          if (FAIL_FAST) {
            throw new Error(`Block ${fileNumber} (slot ${timeslot}): Expected error "${expected.errorMessage}" but import succeeded`)
          }
        }
      } else if (expected?.type === 'state_root') {
        // Expected to succeed (original block)
        if (importError) {
          console.error(`❌ Block ${fileNumber} (slot ${timeslot}): Expected success but got error`)
          console.error(`   Error: ${importError.message}`)
          unexpectedErrorCount++
          if (FAIL_FAST) {
            throw new Error(`Block ${fileNumber} (slot ${timeslot}): Expected success but got error: ${importError.message}`)
          }
        } else {
          // Verify state root
          const [stateRootError, stateRoot] = stateService.getStateRoot()
          if (stateRootError) {
            console.error(`❌ Block ${fileNumber}: Failed to get state root: ${stateRootError.message}`)
            unexpectedErrorCount++
            if (FAIL_FAST) {
              throw new Error(`Block ${fileNumber}: Failed to get state root: ${stateRootError.message}`)
            }
          } else if (stateRoot?.toLowerCase() !== expected.stateRoot) {
            console.error(`❌ Block ${fileNumber} (slot ${timeslot}): State root mismatch`)
            console.error(`   Expected: ${expected.stateRoot}`)
            console.error(`   Got:      ${stateRoot?.toLowerCase()}`)
            stateRootMismatchCount++
            if (FAIL_FAST) {
              throw new Error(`Block ${fileNumber} (slot ${timeslot}): State root mismatch\n   Expected: ${expected.stateRoot}\n   Got:      ${stateRoot?.toLowerCase()}`)
            }
          } else {
            console.log(`✅ Block ${fileNumber} (slot ${timeslot}): Imported, state root matches`)
            successCount++
          }
        }
      } else {
        // No expected outcome found - just try to import
        if (importError) {
          console.warn(`⚠️  Block ${fileNumber} (slot ${timeslot}): Import failed (no expected outcome)`)
          console.warn(`   Error: ${importError.message}`)
        } else {
          console.log(`✅ Block ${fileNumber} (slot ${timeslot}): Imported (no expected outcome to verify)`)
          successCount++
        }
      }

      // Progress logging every 20 blocks
      if ((successCount + expectedErrorCount + unexpectedErrorCount + stateRootMismatchCount) % 20 === 0) {
        const total = successCount + expectedErrorCount + unexpectedErrorCount + stateRootMismatchCount
        console.log(`\n📊 Progress: ${total}/${blocksToProcess.length} processed`)
      }
    }

    // Final summary
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📊 Final Summary for ${TEST_MODE}:`)
    console.log(`   ✅ Successful imports with verified state root: ${successCount}`)
    console.log(`   ✅ Expected errors (mutations correctly rejected): ${expectedErrorCount}`)
    console.log(`   ❌ State root mismatches: ${stateRootMismatchCount}`)
    console.log(`   ❌ Unexpected errors: ${unexpectedErrorCount}`)
    console.log(`   📦 Total blocks processed: ${blocksToProcess.length}`)
    console.log(`${'='.repeat(60)}`)

    // Assertions
    expect(unexpectedErrorCount).toBe(0)
    expect(stateRootMismatchCount).toBe(0)

    // In forks mode, we expect a mix of successes and expected errors
    // In no_forks mode, all should succeed
    if (TEST_MODE === 'no_forks') {
      expect(expectedErrorCount).toBe(0)
      expect(successCount).toBeGreaterThan(0)
    } else {
      // In forks mode, we should have both successes and expected errors
      expect(successCount + expectedErrorCount).toBeGreaterThan(0)
    }
  }, 600000) // 10 minute timeout
})
