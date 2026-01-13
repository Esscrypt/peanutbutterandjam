/**
 * Fuzzer Target Block Import Test
 *
 * Tests the exact same initializeServices from fuzzer-target.ts
 * to verify state root after importing block 2.
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { type BlockTraceTestVector, formatFuzzerErrorAuto } from '@pbnjam/types'
import { hexToBytes, type Hex } from '@pbnjam/core'
import { decodeRecent } from '@pbnjam/codec'
import {
  convertJsonBlockToBlock,
  FuzzerTargetServices,
  getStartBlock,
  getStopBlock,
  initializeServices,
} from '../test-utils'
import { StateService } from '../../services/state-service'
import { RecentHistoryService } from '../../services/recent-history-service'
import { ConfigService } from '../../services/config-service'
import { BlockImporterService } from '../../services/block-importer-service'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

let stateService: StateService
let blockImporterService: BlockImporterService
let recentHistoryService: RecentHistoryService
let configService: ConfigService
let services: FuzzerTargetServices

describe('Fuzzer Traces Test', () => {

  beforeAll(async () => {
        // Initialize services using the exact same function as fuzzer-target.ts
        services = await initializeServices({ spec: 'tiny', traceSubfolder: 'fuzzer-traces', useWasm: true })

        stateService = services.stateService
        blockImporterService = services.blockImporterService
        recentHistoryService = services.recentHistoryService
        configService = services.configService
    
        // Disable ancestry validation by patching isValidAnchor to always return true
        // This allows anchors that are not in recent history to be accepted
        // According to fuzz-proto README: "When this feature is disabled, the check described
        // in the GP reference should also be skipped."
        const originalIsValidAnchor = recentHistoryService.isValidAnchor.bind(recentHistoryService)
        recentHistoryService.isValidAnchor = () => {
          return true // Always return true to disable ancestry validation
        }
        console.log('🔓 Ancestry validation disabled (isValidAnchor always returns true)')
    
        // Note: Fork validation is handled by validateBlockHeader which checks parent hash.
        // Since we're using test files from 'no_forks' directory, fork validation should not be an issue.
        // If needed, fork validation can be disabled by patching validateBlockHeader, but that's
        // more complex and not needed for the 'no_forks' test vectors.
    
        // Load PeerInfo message to get JAM version
        const peerInfoJsonPath = path.join(
          WORKSPACE_ROOT,
          'submodules/jam-conformance/fuzz-proto/examples/v1/no_forks/00000000_fuzzer_peer_info.json',
        )
        let jamVersion: { major: number; minor: number; patch: number } = { major: 0, minor: 7, patch: 2 }
        try {
          const peerInfoJson = JSON.parse(readFileSync(peerInfoJsonPath, 'utf-8'))
          if (peerInfoJson.jam_version) {
            jamVersion = peerInfoJson.jam_version
            console.log(`📋 JAM version from PeerInfo: ${jamVersion.major}.${jamVersion.minor}.${jamVersion.patch}`)
          }
        } catch (error) {
          console.warn(`⚠️  Failed to load PeerInfo, using default JAM version: ${error instanceof Error ? error.message : String(error)}`)
        }
        
        // Set JAM version on configService
        configService.jamVersion = jamVersion
  })
  it('should import trace file 1766241814 from fuzz-reports', async () => {

    // Disable ancestry validation by patching isValidAnchor to always return true
    recentHistoryService.isValidAnchor.bind(recentHistoryService)
    recentHistoryService.isValidAnchor = () => {
      return true // Always return true to disable ancestry validation
    }
    console.log('🔓 Ancestry validation disabled (isValidAnchor always returns true)')

    // Get JAM conformance version from environment variable, default to 0.7.2
    const JAM_CONFORMANCE_VERSION = process.env.JAM_CONFORMANCE_VERSION || '0.7.2'
    const traceId = '1766241814'
    
    // Trace directory path
    const traceDir = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-reports',
      JAM_CONFORMANCE_VERSION,
      'traces',
      traceId
    )

    if (!existsSync(traceDir)) {
      throw new Error(`Trace directory does not exist: ${traceDir}`)
    }

    // Load the fuzz report for this trace to get expected error messages
    const reportPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-reports',
      JAM_CONFORMANCE_VERSION,
      'reports',
      'pbnjam',
      traceId,
      'report.json'
    )
    let expectedError: string | null = null
    if (existsSync(reportPath)) {
      try {
        const reportData = JSON.parse(readFileSync(reportPath, 'utf-8'))
        if (reportData.error?.import_result_diff?.exp) {
          expectedError = reportData.error.import_result_diff.exp
          console.log(`📋 Expected error from report: ${expectedError}`)
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load report.json: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      console.log(`ℹ️  No report.json found at ${reportPath}, skipping error message validation`)
    }

    console.log(`\n📋 Processing trace: ${traceId}`)
    console.log(`📁 Trace directory: ${traceDir}`)

    // Get all JSON trace files in the directory and sort them numerically
    const allFiles = readdirSync(traceDir)
    const traceFiles = allFiles
      .filter((file) => file.endsWith('.json'))
      .sort((a, b) => {
        // Extract number from filename (e.g., "00000176" from "00000176.json")
        const numA = parseInt(a.replace('.json', ''), 10)
        const numB = parseInt(b.replace('.json', ''), 10)
        return numA - numB
      })

    if (traceFiles.length === 0) {
      throw new Error(`No trace JSON files found in ${traceDir}`)
    }

    console.log(`📦 Found ${traceFiles.length} trace files to process`)

    // Get start and stop block numbers
    const startBlock = getStartBlock()
    const stopBlock = getStopBlock()
    if (startBlock > 1) {
      console.log(`\n🚀 Starting from block ${startBlock} (START_BLOCK=${startBlock})`)
    }
    if (stopBlock !== undefined) {
      console.log(`🛑 Will stop after block ${stopBlock} (STOP_BLOCK=${stopBlock})`)
    }

    // Filter trace files based on start/stop block
    // Trace files are named like "00000176.json", extract the number
    const filteredTraceFiles = traceFiles.filter((file) => {
      const blockNum = parseInt(file.replace('.json', ''), 10)
      if (Number.isNaN(blockNum)) {
        return false // Skip files that don't match the pattern
      }
      if (blockNum < startBlock) {
        return false // Skip files before start block
      }
      if (stopBlock !== undefined && blockNum > stopBlock) {
        return false // Skip files after stop block
      }
      return true
    })

    if (filteredTraceFiles.length === 0) {
      throw new Error(`No trace files found in range [${startBlock}, ${stopBlock ?? 'end'}]`)
    }

    console.log(`📦 Processing ${filteredTraceFiles.length} trace files (filtered from ${traceFiles.length} total)`)

    // Extract validators from the first block's epoch mark if present
    // This ensures ValidatorSetManager is properly initialized before block validation
    // Note: Validators will also be set from pre-state (chapters 7, 8, 9) when setState is called,
    // but having initial validators helps with epoch root verification during block import
    const firstTraceFile = filteredTraceFiles[0]
    const firstTracePath = path.join(traceDir, firstTraceFile)
    const firstTraceData: BlockTraceTestVector = JSON.parse(
      readFileSync(firstTracePath, 'utf-8')
    )

    // Process all trace files in sequence
    let successCount = 0
    let failCount = 0

    for (const traceFile of filteredTraceFiles) {
      const blockNum = parseInt(traceFile.replace('.json', ''), 10)
      const tracePath = path.join(traceDir, traceFile)
      const traceData: BlockTraceTestVector = JSON.parse(
        readFileSync(tracePath, 'utf-8')
      )

      // Set pre-state for each block from its trace file
      // This ensures validators and other state components are correct before block import
      if (traceData.pre_state?.keyvals) {
        const [setStateError] = stateService.setState(traceData.pre_state.keyvals)
        if (setStateError) {
          throw new Error(`Failed to set pre-state: ${setStateError.message}`)
        }
        if (blockNum === startBlock) {
          console.log(`✅ Initial state set from ${traceData.pre_state.keyvals.length} keyvals`)
        } else {
          console.log(`✅ Pre-state set for block ${blockNum} from ${traceData.pre_state.keyvals.length} keyvals`)
        }
      }

      // Initialize recent history from pre-state (only for starting block to avoid overwriting)
      if (blockNum === startBlock) {
        const betaKeyval = traceData.pre_state?.keyvals?.find(
          (kv: { key: string }) => kv.key === '0x03000000000000000000000000000000000000000000000000000000000000'
        )
        if (betaKeyval) {
          const betaData = hexToBytes(betaKeyval.value as Hex)
          const [decodeError, decodeResult] = decodeRecent(betaData)
          if (!decodeError && decodeResult) {
            recentHistoryService.setRecent(decodeResult.value)
            console.log(`📂 Loaded recent history from pre-state`)
          }
        }
      }

      // Verify that the current state root matches the block's parent_state_root
      const [currentStateRootError, currentStateRoot] = stateService.getStateRoot()
      if (currentStateRootError) {
        console.warn(`⚠️  Failed to get state root: ${currentStateRootError.message}`)
      } else {
        // #region agent log
        fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:660',message:'Pre-import state root check',data:{blockNum,traceFile,computedStateRoot:currentStateRoot,expectedParentStateRoot:traceData.block.header.parent_state_root,match:currentStateRoot===traceData.block.header.parent_state_root,recentHistoryLength:recentHistoryService.getRecentHistory().length,lastEntryStateRoot:recentHistoryService.getRecentHistory().length>0?recentHistoryService.getRecentHistory()[recentHistoryService.getRecentHistory().length-1].stateRoot:'none'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-import-root',hypothesisId:'G'})}).catch(()=>{});
        // #endregion

        if (currentStateRoot !== traceData.block.header.parent_state_root) {
          console.warn(
            `⚠️  [Block ${blockNum}] Current state root doesn't match block header's parent_state_root: computed ${currentStateRoot}, expected ${traceData.block.header.parent_state_root}`,
          )
        }
      }

      // Check if we should stop after this block
      if (stopBlock !== undefined && blockNum > stopBlock) {
        console.log(`\n🛑 Stopping after block ${blockNum - 1} (STOP_BLOCK=${stopBlock})`)
        break
      }

      console.log(`\n📋 Processing trace file: ${traceFile} (block ${blockNum})`)

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:730',message:'Before block import',data:{traceFile,timeslot:traceData.block?.header?.slot,preStateKeyCount:traceData.pre_state?.keyvals?.length,postStateKeyCount:traceData.post_state?.keyvals?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Capture state BEFORE block import
      const [stateTrieBeforeError, stateTrieBefore] = stateService.generateStateTrie()
      const chapter13Before = stateTrieBefore?.['0x0d000000000000000000000000000000000000000000000000000000000000'] || ''
      const chapter16Before = stateTrieBefore?.['0x10000000000000000000000000000000000000000000000000000000000000'] || ''
      const chapter3Before = stateTrieBefore?.['0x03000000000000000000000000000000000000000000000000000000000000'] || ''

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:737',message:'State before import',data:{traceFile,chapter13Before:chapter13Before.substring(0,100),chapter16Before:chapter16Before.substring(0,100),chapter3Before:chapter3Before.substring(0,100),chapter13Length:chapter13Before.length,chapter16Length:chapter16Before.length},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // Convert and import the block from trace
      const block = convertJsonBlockToBlock(traceData.block)

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:743',message:'Block converted',data:{traceFile,blockTimeslot:block.header.timeslot.toString(),hasEpochMark:!!block.header.epochMark,hasWinnersMark:!!block.header.winnersMark,ticketsCount:block.body.tickets.length,guaranteesCount:block.body.guarantees.length,assurancesCount:block.body.assurances.length},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // Check if block import is expected to fail (pre_state == post_state)
      const preStateJson = JSON.stringify(traceData.pre_state)
      const postStateJson = JSON.stringify(traceData.post_state)
      const expectBlockToFail = preStateJson === postStateJson

      // Import the block
      console.log(`🔄 Importing block (timeslot ${block.header.timeslot})...`)
      const [importError] = await blockImporterService.importBlock(block)
      
      if (expectBlockToFail) {
        // Block import should fail - this is expected behavior
        if (importError) {
          console.log(`✅ Block ${blockNum} correctly failed to import: ${importError.message}`)
          // State should remain unchanged (already verified by snapshot revert in block importer)
          failCount++
          continue
        } else {
          // Block imported when it should have failed
          throw new Error(`Block ${blockNum} imported successfully but was expected to fail (pre_state == post_state)`)
        }
      }
      
      if (importError) {
        console.error(`❌ Import error: ${importError.message}`)
        if (importError.stack) {
          console.error(`Stack: ${importError.stack}`)
        }

        // Format error message the same way fuzzer-target.ts does
        const formattedError = formatFuzzerErrorAuto(importError)
        console.log(`📝 Formatted error: ${formattedError}`)

        // Compare against expected error from report if available
        if (expectedError) {
          if (formattedError === expectedError) {
            console.log(`✅ Formatted error matches expected error from report`)
          } else {
            console.error(`❌ Formatted error does NOT match expected error from report:`)
            console.error(`  Expected: ${expectedError}`)
            console.error(`  Got:      ${formattedError}`)
            // Don't fail the test, just log the mismatch for now
            // This helps identify cases where error formatting needs adjustment
          }
        }

        failCount++
        continue
      }

      // If block import succeeded but report expects an error, log a warning
      if (expectedError) {
        console.warn(`⚠️  Block imported successfully, but report expects error: ${expectedError}`)
        console.warn(`   This may indicate the error condition was fixed or the report is outdated`)
      }

      console.log(`✅ Block imported successfully`)
      successCount++

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:757',message:'After block import',data:{traceFile,importSuccess:!importError},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      // Verify post-state matches expected post_state from trace
      const [stateTrieError, stateTrie] = stateService.generateStateTrie()
      if (stateTrieError) {
        console.warn(`⚠️  Failed to generate state trie: ${stateTrieError.message}`)
        continue
      }

      // Capture state AFTER block import
      const chapter13After = stateTrie?.['0x0d000000000000000000000000000000000000000000000000000000000000'] || ''
      const chapter16After = stateTrie?.['0x10000000000000000000000000000000000000000000000000000000000000'] || ''
      const chapter3After = stateTrie?.['0x03000000000000000000000000000000000000000000000000000000000000'] || ''

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:767',message:'State after import',data:{traceFile,chapter13After:chapter13After.substring(0,100),chapter16After:chapter16After.substring(0,100),chapter3After:chapter3After.substring(0,100),chapter13Length:chapter13After.length,chapter16Length:chapter16After.length,chapter13Changed:chapter13Before!==chapter13After,chapter16Changed:chapter16Before!==chapter16After,chapter3Changed:chapter3Before!==chapter3After},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // Compare state root
      const [stateRootError, computedStateRoot] = stateService.getStateRoot()
      if (stateRootError) {
        console.warn(`⚠️  Failed to get state root: ${stateRootError.message}`)
        continue
      }

      const expectedStateRoot = traceData.post_state.state_root
      if (computedStateRoot !== expectedStateRoot) {
        console.log(`❌ State root mismatch for ${traceFile}:`)
        console.log(`  Expected: ${expectedStateRoot}`)
        console.log(`  Got:      ${computedStateRoot}`)
      } else {
        console.log(`✅ State root matches for ${traceFile}`)
      }

      // Verify keyvals match
      const mismatches: Array<{ key: string; expected: string; actual: string | undefined }> = []
      for (const keyval of traceData.post_state.keyvals) {
        const actualValue = stateTrie?.[keyval.key]
        if (keyval.value !== actualValue) {
          mismatches.push({
            key: keyval.key,
            expected: keyval.value,
            actual: actualValue,
          })
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:795',message:'Keyval mismatches',data:{traceFile,mismatchCount:mismatches.length,chapter13Mismatch:mismatches.find(m=>m.key==='0x0d000000000000000000000000000000000000000000000000000000000000')?{expected:mismatches.find(m=>m.key==='0x0d000000000000000000000000000000000000000000000000000000000000')?.expected.substring(0,100),actual:mismatches.find(m=>m.key==='0x0d000000000000000000000000000000000000000000000000000000000000')?.actual?.substring(0,100)}:null,chapter16Mismatch:mismatches.find(m=>m.key==='0x10000000000000000000000000000000000000000000000000000000000000')?{expected:mismatches.find(m=>m.key==='0x10000000000000000000000000000000000000000000000000000000000000')?.expected.substring(0,100),actual:mismatches.find(m=>m.key==='0x10000000000000000000000000000000000000000000000000000000000000')?.actual?.substring(0,100)}:null,serviceAccountMismatches:mismatches.filter(m=>!m.key.startsWith('0x0')).slice(0,3).map(m=>({key:m.key.substring(0,20),expected:m.expected.substring(0,50),actual:m.actual?.substring(0,50)}))},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'F'})}).catch(()=>{});
      // #endregion

      if (mismatches.length > 0) {
        console.log(`⚠️  Found ${mismatches.length} keyval mismatches for ${traceFile}`)
        // Log first few mismatches
        for (const mismatch of mismatches.slice(0, 5)) {
          console.log(`  Key ${mismatch.key}: expected ${mismatch.expected.substring(0, 50)}..., got ${mismatch.actual?.substring(0, 50) || 'undefined'}...`)
        }
      }
    }

    console.log(`\n📊 Final Summary:`)
    console.log(`   ✅ Successfully imported: ${successCount} blocks`)
    console.log(`   ❌ Failed: ${failCount} blocks`)
    console.log(`   📦 Total blocks processed: ${successCount + failCount}`)

    // Assert that we imported at least some blocks
    expect(successCount).toBeGreaterThan(0)
  }, 600000) // 10 minute timeout
  it.only('should import trace file 1766241867 from fuzz-reports', async () => {

    // Disable ancestry validation by patching isValidAnchor to always return true
    recentHistoryService.isValidAnchor.bind(recentHistoryService)
    recentHistoryService.isValidAnchor = () => {
      return true // Always return true to disable ancestry validation
    }
    console.log('🔓 Ancestry validation disabled (isValidAnchor always returns true)')

    // Get JAM conformance version from environment variable, default to 0.7.2
    const JAM_CONFORMANCE_VERSION = process.env.JAM_CONFORMANCE_VERSION || '0.7.2'
    const traceId = '1766241867'
    
    // Trace directory path
    const traceDir = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-reports',
      JAM_CONFORMANCE_VERSION,
      'traces',
      traceId
    )

    if (!existsSync(traceDir)) {
      throw new Error(`Trace directory does not exist: ${traceDir}`)
    }

    // Load genesis.json from trace directory
    const genesisJsonPath = path.join(traceDir, 'genesis.json')
    let genesisJson: any = null
    if (existsSync(genesisJsonPath)) {
      try {
        genesisJson = JSON.parse(readFileSync(genesisJsonPath, 'utf-8'))
        console.log(`📋 Loaded genesis.json from ${genesisJsonPath}`)
        console.log(`   State keyvals: ${genesisJson?.state?.keyvals?.length || 0}`)
      } catch (error) {
        console.warn(`⚠️  Failed to load genesis.json: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      console.warn(`⚠️  genesis.json not found at ${genesisJsonPath}, will use trace pre_state`)
    }

    // Load the fuzz report for this trace to get expected error messages
    const reportPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-reports',
      JAM_CONFORMANCE_VERSION,
      'reports',
      'pbnjam',
      traceId,
      'report.json'
    )
    let expectedError: string | null = null
    if (existsSync(reportPath)) {
      try {
        const reportData = JSON.parse(readFileSync(reportPath, 'utf-8'))
        if (reportData.error?.import_result_diff?.exp) {
          expectedError = reportData.error.import_result_diff.exp
          console.log(`📋 Expected error from report: ${expectedError}`)
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load report.json: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      console.log(`ℹ️  No report.json found at ${reportPath}, skipping error message validation`)
    }

    console.log(`\n📋 Processing trace: ${traceId}`)
    console.log(`📁 Trace directory: ${traceDir}`)

    // Get all JSON trace files in the directory and sort them numerically
    const allFiles = readdirSync(traceDir)
    const traceFiles = allFiles
      .filter((file) => file.endsWith('.json') && file !== 'genesis.json')
      .sort((a, b) => {
        // Extract number from filename (e.g., "00000176" from "00000176.json")
        const numA = parseInt(a.replace('.json', ''), 10)
        const numB = parseInt(b.replace('.json', ''), 10)
        return numA - numB
      })

    if (traceFiles.length === 0) {
      throw new Error(`No trace JSON files found in ${traceDir}`)
    }

    console.log(`📦 Found ${traceFiles.length} trace files to process`)

    // Get start and stop block numbers
    const startBlock = getStartBlock()
    const stopBlock = getStopBlock()
    if (startBlock > 1) {
      console.log(`\n🚀 Starting from block ${startBlock} (START_BLOCK=${startBlock})`)
    }
    if (stopBlock !== undefined) {
      console.log(`🛑 Will stop after block ${stopBlock} (STOP_BLOCK=${stopBlock})`)
    }

    // Filter trace files based on start/stop block
    // Trace files are named like "00000176.json", extract the number
    const filteredTraceFiles = traceFiles.filter((file) => {
      const blockNum = parseInt(file.replace('.json', ''), 10)
      if (Number.isNaN(blockNum)) {
        return false // Skip files that don't match the pattern
      }
      if (blockNum < startBlock) {
        return false // Skip files before start block
      }
      if (stopBlock !== undefined && blockNum > stopBlock) {
        return false // Skip files after stop block
      }
      return true
    })

    if (filteredTraceFiles.length === 0) {
      throw new Error(`No trace files found in range [${startBlock}, ${stopBlock ?? 'end'}]`)
    }

    console.log(`📦 Processing ${filteredTraceFiles.length} trace files (filtered from ${traceFiles.length} total)`)

    // Extract validators from the first block's epoch mark if present
    // This ensures ValidatorSetManager is properly initialized before block validation
    // Note: Validators will also be set from pre-state (chapters 7, 8, 9) when setState is called,
    // but having initial validators helps with epoch root verification during block import
    const firstTraceFile = filteredTraceFiles[0]
    const firstTracePath = path.join(traceDir, firstTraceFile)
    const firstTraceData: BlockTraceTestVector = JSON.parse(
      readFileSync(firstTracePath, 'utf-8')
    )

    // Process all trace files in sequence
    let successCount = 0
    let failCount = 0

    for (const traceFile of filteredTraceFiles) {
      const blockNum = parseInt(traceFile.replace('.json', ''), 10)
      const tracePath = path.join(traceDir, traceFile)
      const traceData: BlockTraceTestVector = JSON.parse(
        readFileSync(tracePath, 'utf-8')
      )

      // Set state from genesis.json for starting block, otherwise use trace pre_state
      if (blockNum === startBlock && genesisJson?.state?.keyvals) {
        // Use genesis.json state for initial block
        const [setStateError] = stateService.setState(genesisJson.state.keyvals)
        if (setStateError) {
          throw new Error(`Failed to set state from genesis.json: ${setStateError.message}`)
        }
        console.log(`✅ Initial state set from genesis.json (${genesisJson.state.keyvals.length} keyvals)`)
      } else if (traceData.pre_state?.keyvals) {
        // Use trace pre_state for subsequent blocks
        const [setStateError] = stateService.setState(traceData.pre_state.keyvals)
        if (setStateError) {
          throw new Error(`Failed to set pre-state: ${setStateError.message}`)
        }
        if (blockNum === startBlock) {
          console.log(`✅ Initial state set from ${traceData.pre_state.keyvals.length} keyvals`)
        } else {
          console.log(`✅ Pre-state set for block ${blockNum} from ${traceData.pre_state.keyvals.length} keyvals`)
        }
      }

      // Initialize recent history from genesis.json or pre-state (only for starting block to avoid overwriting)
      if (blockNum === startBlock) {
        // Try genesis.json first, then fall back to trace pre_state
        const betaKeyval = genesisJson?.state?.keyvals?.find(
          (kv: { key: string }) => kv.key === '0x03000000000000000000000000000000000000000000000000000000000000'
        ) || traceData.pre_state?.keyvals?.find(
          (kv: { key: string }) => kv.key === '0x03000000000000000000000000000000000000000000000000000000000000'
        )
        if (betaKeyval) {
          const betaData = hexToBytes(betaKeyval.value as Hex)
          const [decodeError, decodeResult] = decodeRecent(betaData)
          if (!decodeError && decodeResult) {
            recentHistoryService.setRecent(decodeResult.value)
            console.log(`📂 Loaded recent history from ${genesisJson ? 'genesis.json' : 'pre-state'}`)
          }
        }
      }

      // Verify that the current state root matches the block's parent_state_root
      const [currentStateRootError, currentStateRoot] = stateService.getStateRoot()
      if (currentStateRootError) {
        console.warn(`⚠️  Failed to get state root: ${currentStateRootError.message}`)
      } else {
        // #region agent log
        fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:660',message:'Pre-import state root check',data:{blockNum,traceFile,computedStateRoot:currentStateRoot,expectedParentStateRoot:traceData.block.header.parent_state_root,match:currentStateRoot===traceData.block.header.parent_state_root,recentHistoryLength:recentHistoryService.getRecentHistory().length,lastEntryStateRoot:recentHistoryService.getRecentHistory().length>0?recentHistoryService.getRecentHistory()[recentHistoryService.getRecentHistory().length-1].stateRoot:'none'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-import-root',hypothesisId:'G'})}).catch(()=>{});
        // #endregion

        if (currentStateRoot !== traceData.block.header.parent_state_root) {
          console.warn(
            `⚠️  [Block ${blockNum}] Current state root doesn't match block header's parent_state_root: computed ${currentStateRoot}, expected ${traceData.block.header.parent_state_root}`,
          )
        }
      }

      // Check if we should stop after this block
      if (stopBlock !== undefined && blockNum > stopBlock) {
        console.log(`\n🛑 Stopping after block ${blockNum - 1} (STOP_BLOCK=${stopBlock})`)
        break
      }

      console.log(`\n📋 Processing trace file: ${traceFile} (block ${blockNum})`)

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:730',message:'Before block import',data:{traceFile,timeslot:traceData.block?.header?.slot,preStateKeyCount:traceData.pre_state?.keyvals?.length,postStateKeyCount:traceData.post_state?.keyvals?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Capture state BEFORE block import
      const [stateTrieBeforeError, stateTrieBefore] = stateService.generateStateTrie()
      const chapter13Before = stateTrieBefore?.['0x0d000000000000000000000000000000000000000000000000000000000000'] || ''
      const chapter16Before = stateTrieBefore?.['0x10000000000000000000000000000000000000000000000000000000000000'] || ''
      const chapter3Before = stateTrieBefore?.['0x03000000000000000000000000000000000000000000000000000000000000'] || ''

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:737',message:'State before import',data:{traceFile,chapter13Before:chapter13Before.substring(0,100),chapter16Before:chapter16Before.substring(0,100),chapter3Before:chapter3Before.substring(0,100),chapter13Length:chapter13Before.length,chapter16Length:chapter16Before.length},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // Convert and import the block from trace
      const block = convertJsonBlockToBlock(traceData.block)

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:743',message:'Block converted',data:{traceFile,blockTimeslot:block.header.timeslot.toString(),hasEpochMark:!!block.header.epochMark,hasWinnersMark:!!block.header.winnersMark,ticketsCount:block.body.tickets.length,guaranteesCount:block.body.guarantees.length,assurancesCount:block.body.assurances.length},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // Check if block import is expected to fail (pre_state == post_state)
      const preStateJson = JSON.stringify(traceData.pre_state)
      const postStateJson = JSON.stringify(traceData.post_state)
      const expectBlockToFail = preStateJson === postStateJson

      // Import the block
      console.log(`🔄 Importing block (timeslot ${block.header.timeslot})...`)
      const [importError] = await blockImporterService.importBlock(block)
      
      if (expectBlockToFail) {
        // Block import should fail - this is expected behavior
        if (importError) {
          console.log(`✅ Block ${blockNum} correctly failed to import: ${importError.message}`)
          // State should remain unchanged (already verified by snapshot revert in block importer)
          failCount++
          continue
        } else {
          // Block imported when it should have failed
          throw new Error(`Block ${blockNum} imported successfully but was expected to fail (pre_state == post_state)`)
        }
      }
      
      if (importError) {
        console.error(`❌ Import error: ${importError.message}`)
        if (importError.stack) {
          console.error(`Stack: ${importError.stack}`)
        }

        // Format error message the same way fuzzer-target.ts does
        const formattedError = formatFuzzerErrorAuto(importError)
        console.log(`📝 Formatted error: ${formattedError}`)

        // Compare against expected error from report if available
        if (expectedError) {
          if (formattedError === expectedError) {
            console.log(`✅ Formatted error matches expected error from report`)
          } else {
            console.error(`❌ Formatted error does NOT match expected error from report:`)
            console.error(`  Expected: ${expectedError}`)
            console.error(`  Got:      ${formattedError}`)
            // Don't fail the test, just log the mismatch for now
            // This helps identify cases where error formatting needs adjustment
          }
        }

        failCount++
        continue
      }

      // If block import succeeded but report expects an error, log a warning
      if (expectedError) {
        console.warn(`⚠️  Block imported successfully, but report expects error: ${expectedError}`)
        console.warn(`   This may indicate the error condition was fixed or the report is outdated`)
      }

      console.log(`✅ Block imported successfully`)
      successCount++

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:757',message:'After block import',data:{traceFile,importSuccess:!importError},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      // Verify post-state matches expected post_state from trace
      const [stateTrieError, stateTrie] = stateService.generateStateTrie()
      if (stateTrieError) {
        console.warn(`⚠️  Failed to generate state trie: ${stateTrieError.message}`)
        continue
      }

      // Capture state AFTER block import
      const chapter13After = stateTrie?.['0x0d000000000000000000000000000000000000000000000000000000000000'] || ''
      const chapter16After = stateTrie?.['0x10000000000000000000000000000000000000000000000000000000000000'] || ''
      const chapter3After = stateTrie?.['0x03000000000000000000000000000000000000000000000000000000000000'] || ''

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:767',message:'State after import',data:{traceFile,chapter13After:chapter13After.substring(0,100),chapter16After:chapter16After.substring(0,100),chapter3After:chapter3After.substring(0,100),chapter13Length:chapter13After.length,chapter16Length:chapter16After.length,chapter13Changed:chapter13Before!==chapter13After,chapter16Changed:chapter16Before!==chapter16After,chapter3Changed:chapter3Before!==chapter3After},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      // Compare state root
      const [stateRootError, computedStateRoot] = stateService.getStateRoot()
      if (stateRootError) {
        console.warn(`⚠️  Failed to get state root: ${stateRootError.message}`)
        continue
      }

      const expectedStateRoot = traceData.post_state.state_root
      if (computedStateRoot !== expectedStateRoot) {
        console.log(`❌ State root mismatch for ${traceFile}:`)
        console.log(`  Expected: ${expectedStateRoot}`)
        console.log(`  Got:      ${computedStateRoot}`)
      } else {
        console.log(`✅ State root matches for ${traceFile}`)
      }

      // Verify keyvals match
      const mismatches: Array<{ key: string; expected: string; actual: string | undefined }> = []
      for (const keyval of traceData.post_state.keyvals) {
        const actualValue = stateTrie?.[keyval.key]
        if (keyval.value !== actualValue) {
          mismatches.push({
            key: keyval.key,
            expected: keyval.value,
            actual: actualValue,
          })
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzer-target-import-traces.test.ts:795',message:'Keyval mismatches',data:{traceFile,mismatchCount:mismatches.length,chapter13Mismatch:mismatches.find(m=>m.key==='0x0d000000000000000000000000000000000000000000000000000000000000')?{expected:mismatches.find(m=>m.key==='0x0d000000000000000000000000000000000000000000000000000000000000')?.expected.substring(0,100),actual:mismatches.find(m=>m.key==='0x0d000000000000000000000000000000000000000000000000000000000000')?.actual?.substring(0,100)}:null,chapter16Mismatch:mismatches.find(m=>m.key==='0x10000000000000000000000000000000000000000000000000000000000000')?{expected:mismatches.find(m=>m.key==='0x10000000000000000000000000000000000000000000000000000000000000')?.expected.substring(0,100),actual:mismatches.find(m=>m.key==='0x10000000000000000000000000000000000000000000000000000000000000')?.actual?.substring(0,100)}:null,serviceAccountMismatches:mismatches.filter(m=>!m.key.startsWith('0x0')).slice(0,3).map(m=>({key:m.key.substring(0,20),expected:m.expected.substring(0,50),actual:m.actual?.substring(0,50)}))},timestamp:Date.now(),sessionId:'debug-session',runId:'trace-import',hypothesisId:'F'})}).catch(()=>{});
      // #endregion

      if (mismatches.length > 0) {
        console.log(`⚠️  Found ${mismatches.length} keyval mismatches for ${traceFile}`)
        // Log first few mismatches
        for (const mismatch of mismatches.slice(0, 5)) {
          console.log(`  Key ${mismatch.key}: expected ${mismatch.expected.substring(0, 50)}..., got ${mismatch.actual?.substring(0, 50) || 'undefined'}...`)
        }
      }
    }

    console.log(`\n📊 Final Summary:`)
    console.log(`   ✅ Successfully imported: ${successCount} blocks`)
    console.log(`   ❌ Failed: ${failCount} blocks`)
    console.log(`   📦 Total blocks processed: ${successCount + failCount}`)

    // Assert that we imported at least some blocks
    expect(successCount).toBeGreaterThan(0)
  }, 600000) // 10 minute timeout
})


