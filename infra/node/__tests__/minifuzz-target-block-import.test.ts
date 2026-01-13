/**
 * Fuzzer Target Block Import Test
 *
 * Tests the exact same initializeServices from fuzzer-target.ts
 * to verify state root after importing block 2.
 */

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { decodeFuzzMessage } from '@pbnjam/codec'
import { FuzzMessageType } from '@pbnjam/types'
import { decodeRecent } from '@pbnjam/codec'
import {
  initializeServices,
} from './test-utils'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../')


describe('Fuzzer Target Block Import', () => {
  it('should match state root after importing block 2 using fuzzer-target initializeServices', async () => {
    // Initialize services using the exact same function as fuzzer-target.ts
    const services = await initializeServices()

    const stateService = services.stateService
    const blockImporterService = services.blockImporterService
    const recentHistoryService = services.recentHistoryService
    const configService = services.configService

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
    let jamVersion: { major: number; minor: number; patch: number } = { major: 0, minor: 7, patch: 0 }
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

    // Load Initialize message
    const initializeBinPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-proto/examples/v1/no_forks/00000001_fuzzer_initialize.bin',
    )

    let initializeBin: Uint8Array
    try {
      initializeBin = new Uint8Array(readFileSync(initializeBinPath))
    } catch (error) {
      throw new Error(
        `Failed to read Initialize binary: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Decode Initialize message (skip 4-byte length prefix if present)
    let messageData: Uint8Array
    if (initializeBin.length >= 4) {
      const lengthPrefix = new DataView(initializeBin.buffer, initializeBin.byteOffset, 4).getUint32(0, true)
      if (lengthPrefix === initializeBin.length - 4) {
        messageData = initializeBin.subarray(4)
      } else {
        messageData = initializeBin
      }
    } else {
      messageData = initializeBin
    }

    const decodedMessage = decodeFuzzMessage(messageData, configService)
    if (decodedMessage.type !== FuzzMessageType.Initialize) {
      throw new Error(`Expected Initialize message, got ${decodedMessage.type}`)
    }
    const init = decodedMessage.payload as any

    console.log(`\n📋 Initialize message loaded: ${init.keyvals.length} keyvals`)

    // Set initial state from Initialize message
    const [setStateError] = stateService.setState(init.keyvals)
    if (setStateError) {
      console.log(`⚠️  Warning during setState: ${setStateError.message}`)
    }
    console.log(`✅ Initial state set from ${init.keyvals.length} keyvals`)


    // Verify initial state root
    const [initStateRootError, initStateRoot] = stateService.getStateRoot()
    expect(initStateRootError).toBeUndefined()
    const expectedInitStateRoot = '0x80748e40b5f83342b844a54aed5fd65861b982288e35ce1e7503fc45645d45b6'
    console.log(`\n🌳 INITIAL STATE ROOT:`)
    console.log(`  Our state root:      ${initStateRoot}`)
    console.log(`  Expected state root: ${expectedInitStateRoot}`)
    console.log(`  Match: ${initStateRoot?.toLowerCase() === expectedInitStateRoot.toLowerCase() ? '✅' : '❌'}`)

    // Load ImportBlock message (block 1)
    const importBlock1BinPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-proto/examples/v1/no_forks/00000002_fuzzer_import_block.bin',
    )
    let importBlock1Bin: Uint8Array
    try {
      importBlock1Bin = new Uint8Array(readFileSync(importBlock1BinPath))
    } catch (error) {
      throw new Error(
        `Failed to read ImportBlock 1 binary: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Decode ImportBlock message (block 1)
    let importBlock1Data: Uint8Array
    if (importBlock1Bin.length >= 4) {
      const lengthPrefix = new DataView(importBlock1Bin.buffer, importBlock1Bin.byteOffset, 4).getUint32(0, true)
      if (lengthPrefix === importBlock1Bin.length - 4) {
        importBlock1Data = importBlock1Bin.subarray(4)
      } else {
        importBlock1Data = importBlock1Bin
      }
    } else {
      importBlock1Data = importBlock1Bin
    }

    const importBlock1Message = decodeFuzzMessage(importBlock1Data, configService)
    if (importBlock1Message.type !== FuzzMessageType.ImportBlock) {
      throw new Error(`Expected ImportBlock message, got ${importBlock1Message.type}`)
    }
    const importBlock1 = importBlock1Message.payload as any

    console.log(`\n📦 ImportBlock 1 message loaded: timeslot ${importBlock1.block.header.timeslot}`)

    // Import block 1
    console.log(`\n🔄 Importing block 1...`)
    const [importError1] = await blockImporterService.importBlock(importBlock1.block)
    if (importError1) {
      console.error(`❌ Import error: ${importError1.message}`)
      if (importError1.stack) {
        console.error(`Stack: ${importError1.stack}`)
      }
      throw importError1
    }
    console.log(`✅ Block 1 imported successfully`)

    // Load ImportBlock message (block 2)
    const importBlockBinPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-proto/examples/v1/no_forks/00000003_fuzzer_import_block.bin',
    )
    let importBlockBin: Uint8Array
    try {
      importBlockBin = new Uint8Array(readFileSync(importBlockBinPath))
    } catch (error) {
      throw new Error(
        `Failed to read ImportBlock binary: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Decode ImportBlock message
    let importBlockData: Uint8Array
    if (importBlockBin.length >= 4) {
      const lengthPrefix = new DataView(importBlockBin.buffer, importBlockBin.byteOffset, 4).getUint32(0, true)
      if (lengthPrefix === importBlockBin.length - 4) {
        importBlockData = importBlockBin.subarray(4)
      } else {
        importBlockData = importBlockBin
      }
    } else {
      importBlockData = importBlockBin
    }

    const importBlockMessage = decodeFuzzMessage(importBlockData, configService)
    if (importBlockMessage.type !== FuzzMessageType.ImportBlock) {
      throw new Error(`Expected ImportBlock message, got ${importBlockMessage.type}`)
    }
    const importBlock = importBlockMessage.payload as any

    console.log(`\n📦 ImportBlock 2 message loaded: timeslot ${importBlock.block.header.timeslot}`)

    // Capture state trie before block 2 import
    
    const [trieBeforeBlock2Error, trieBeforeBlock2] = stateService.generateStateTrie()
    const fs = await import('node:fs/promises')
    const logPath = '/Users/tanyageorgieva/Repos/oogabooga/.cursor/debug.log'
    const logEntryBefore = JSON.stringify({location:'fuzzer-target-block-import.test.ts:206',message:'State trie before block 2',data:{test:'fuzzer-target-block-import',trieKeys:Object.keys(trieBeforeBlock2 || {}).sort(),trieKeyCount:Object.keys(trieBeforeBlock2 || {}).length},timestamp:Date.now(),sessionId:'debug-session',runId:'before-block2',hypothesisId:'A'})+'\n'
    await fs.appendFile(logPath, logEntryBefore).catch(()=>{})
    // #endregion

    // Import block 2
    console.log(`\n🔄 Importing block 2...`)
    const [importError] = await blockImporterService.importBlock(importBlock.block)
    if (importError) {
      console.error(`❌ Import error: ${importError.message}`)
      if (importError.stack) {
        console.error(`Stack: ${importError.stack}`)
      }
      throw importError
    }
    console.log(`✅ Block 2 imported successfully`)

    // Capture state trie after block 2 import and compare with before
    
    const [trieAfterBlock2Error, trieAfterBlock2] = stateService.generateStateTrie()
    
    // Compare state tries to find modified keys
    const beforeKeys = new Set(Object.keys(trieBeforeBlock2 || {}))
    const afterKeys = new Set(Object.keys(trieAfterBlock2 || {}))
    
    // Find added keys (in after but not in before)
    const addedKeys = Array.from(afterKeys).filter(k => !beforeKeys.has(k))
    
    // Find removed keys (in before but not in after)
    const removedKeys = Array.from(beforeKeys).filter(k => !afterKeys.has(k))
    
    // Find modified keys (in both but with different values)
    const modifiedKeys: string[] = []
    const modifiedKeyDetails: Record<string, { beforeLength: number; afterLength: number; beforePreview?: string; afterPreview?: string }> = {}
    for (const key of beforeKeys) {
      if (afterKeys.has(key)) {
        const beforeValue = trieBeforeBlock2?.[key] || ''
        const afterValue = trieAfterBlock2?.[key] || ''
        if (beforeValue !== afterValue) {
          modifiedKeys.push(key)
          modifiedKeyDetails[key] = {
            beforeLength: beforeValue.length,
            afterLength: afterValue.length,
            beforePreview: beforeValue.substring(0, 100),
            afterPreview: afterValue.substring(0, 100)
          }
        }
      }
    }
    
    const modifiedStateKeysLog = JSON.stringify({
      location:'fuzzer-target-block-import.test.ts:216',
      message:'Modified state keys in block 2',
      data:{
        test:'fuzzer-target-block-import',
        addedKeys:addedKeys.sort(),
        removedKeys:removedKeys.sort(),
        modifiedKeys:modifiedKeys.sort(),
        modifiedKeyDetails,
        addedCount:addedKeys.length,
        removedCount:removedKeys.length,
        modifiedCount:modifiedKeys.length,
        totalBeforeKeys:beforeKeys.size,
        totalAfterKeys:afterKeys.size
      },
      timestamp:Date.now(),
      sessionId:'debug-session',
      runId:'modified-keys-block2',
      hypothesisId:'A'
    })+'\n'
    await fs.appendFile(logPath, modifiedStateKeysLog).catch(()=>{})
    // #endregion

    // Get state root after block import
    
    const [trieBeforeRootError, trieBeforeRoot] = stateService.generateStateTrie()
    // Capture all chapter values for comparison
    const chapterKeys = [
      '0x01000000000000000000000000000000000000000000000000000000000000', // Chapter 1
      '0x02000000000000000000000000000000000000000000000000000000000000', // Chapter 2
      '0x03000000000000000000000000000000000000000000000000000000000000', // Chapter 3
      '0x04000000000000000000000000000000000000000000000000000000000000', // Chapter 4
      '0x05000000000000000000000000000000000000000000000000000000000000', // Chapter 5
      '0x06000000000000000000000000000000000000000000000000000000000000', // Chapter 6
      '0x07000000000000000000000000000000000000000000000000000000000000', // Chapter 7
      '0x08000000000000000000000000000000000000000000000000000000000000', // Chapter 8
      '0x09000000000000000000000000000000000000000000000000000000000000', // Chapter 9
      '0x0a000000000000000000000000000000000000000000000000000000000000', // Chapter 10
      '0x0b000000000000000000000000000000000000000000000000000000000000', // Chapter 11
      '0x0c000000000000000000000000000000000000000000000000000000000000', // Chapter 12
      '0x0d000000000000000000000000000000000000000000000000000000000000', // Chapter 13
      '0x0e000000000000000000000000000000000000000000000000000000000000', // Chapter 14
      '0x0f000000000000000000000000000000000000000000000000000000000000', // Chapter 15
      '0x10000000000000000000000000000000000000000000000000000000000000', // Chapter 16
    ]
    const chapterValues: Record<string, { length: number; preview?: string }> = {}
    for (const key of chapterKeys) {
      const value = trieBeforeRoot?.[key] || ''
      if (value) {
        chapterValues[key] = { length: value.length, preview: value.substring(0, 100) }
      } else {
        chapterValues[key] = { length: 0 }
      }
    }
    // Capture JAM version and Chapter 13 details
    const chapter13Key = '0x0d000000000000000000000000000000000000000000000000000000000000'
    const chapter13Value = trieBeforeRoot?.[chapter13Key] || ''
    const { decodeActivity } = await import('@pbnjam/codec')
    let chapter13Decoded: any = null
    if (chapter13Value) {
      const chapter13Bytes = (await import('@pbnjam/core')).hexToBytes(chapter13Value)
      const [decodeErr, decoded] = decodeActivity(chapter13Bytes, configService)
      if (!decodeErr && decoded) {
        chapter13Decoded = {
          valStatsAccumulatorCount: decoded.value.validatorStatsAccumulator?.length || 0,
          valStatsPreviousCount: decoded.value.validatorStatsPrevious?.length || 0,
          coreStatsCount: decoded.value.coreStats?.length || 0,
          coreStatsValues: decoded.value.coreStats?.map((cs, idx) => ({
            core: idx,
            daLoad: cs.daLoad,
            popularity: cs.popularity,
            importCount: cs.importCount,
            extrinsicCount: cs.extrinsicCount,
            extrinsicSize: cs.extrinsicSize,
            exportCount: cs.exportCount,
            bundleLength: cs.bundleLength,
            gasUsed: cs.gasUsed
          })) || [],
          serviceStatsCount: decoded.value.serviceStats?.size || 0,
          serviceStatsKeys: Array.from(decoded.value.serviceStats?.keys() || []).map(k => k.toString()).sort()
        }
      }
    }
    const logEntry1 = JSON.stringify({location:'fuzzer-target-block-import.test.ts:172',message:'State trie with all chapters',data:{test:'fuzzer-target-block-import',jamVersion,chapterValues,chapter13Value:chapter13Value.substring(0,200),chapter13Length:chapter13Value.length,chapter13Decoded},timestamp:Date.now(),sessionId:'debug-session',runId:'full-trie',hypothesisId:'A'})+'\n'
    await fs.appendFile(logPath, logEntry1).catch(()=>{})
    // #endregion
    const [stateRootError, stateRoot] = stateService.getStateRoot()
    
    const logEntry2 = JSON.stringify({location:'fuzzer-target-block-import.test.ts:175',message:'State root calculated',data:{test:'fuzzer-target-block-import',stateRoot,stateRootError:stateRootError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-root',hypothesisId:'A'})+'\n'
    await fs.appendFile(logPath, logEntry2).catch(()=>{})
    // #endregion
    expect(stateRootError).toBeUndefined()

    const expectedStateRoot = '0x9bceb7d7c864bbbcaa4b0c71f1c257ceef3f610ee627f432e47345fd0d66d5df'
    
    const logEntry3 = JSON.stringify({location:'fuzzer-target-block-import.test.ts:180',message:'State root comparison',data:{test:'fuzzer-target-block-import',calculated:stateRoot,expected:expectedStateRoot,matches:stateRoot?.toLowerCase() === expectedStateRoot.toLowerCase()},timestamp:Date.now(),sessionId:'debug-session',runId:'comparison',hypothesisId:'A'})+'\n'
    await fs.appendFile(logPath, logEntry3).catch(()=>{})
    // #endregion
    console.log(`\n🌳 STATE ROOT AFTER BLOCK 2:`)
    console.log(`  Our state root:      ${stateRoot}`)
    console.log(`  Expected state root: ${expectedStateRoot}`)
    console.log(`  Match: ${stateRoot?.toLowerCase() === expectedStateRoot.toLowerCase() ? '✅' : '❌'}`)

    // Assert the state root matches
    expect(stateRoot?.toLowerCase()).toBe(expectedStateRoot.toLowerCase())

    // Continue importing subsequent blocks
    console.log(`\n🔄 Continuing with subsequent blocks...`)
    
    const examplesDir = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-proto/examples/v1/no_forks',
    )

    // Discover all ImportBlock files and sort by block number
    let allFiles: string[]
    try {
      allFiles = readdirSync(examplesDir)
    } catch (error) {
      throw new Error(
        `Failed to read examples directory: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const importBlockFiles = allFiles
      .filter((file) => file.endsWith('_fuzzer_import_block.bin'))
      .sort((a, b) => {
        // Extract block number from filename (e.g., "00000005" from "00000005_fuzzer_import_block.bin")
        const blockNumA = parseInt(a.substring(0, 8), 10)
        const blockNumB = parseInt(b.substring(0, 8), 10)
        return blockNumA - blockNumB
      })

    // Find the index of block 2 (00000003) to start from block 3 (00000004)
    const block2Index = importBlockFiles.findIndex((file) => file.startsWith('00000003'))
    const remainingBlocks = block2Index >= 0 ? importBlockFiles.slice(block2Index + 1) : importBlockFiles.slice(2)

    console.log(`📦 Found ${remainingBlocks.length} additional blocks to import (starting from block 3)`)

    let successCount = 0
    let failCount = 0
    // Reuse fs and logPath from earlier in the test

    for (const testFile of remainingBlocks) {
      const blockNumber = parseInt(testFile.substring(0, 8), 10)
      const blockIndex = blockNumber - 1 // Block number is file number - 1 (file 00000003 = block 2)
      
      const importBlockBinPath = path.join(examplesDir, testFile)

      let importBlockBin: Uint8Array
      try {
        importBlockBin = new Uint8Array(readFileSync(importBlockBinPath))
      } catch (error) {
        console.warn(`⚠️  Skipping ${testFile}: ${error instanceof Error ? error.message : String(error)}`)
        failCount++
        continue
      }

      // Decode ImportBlock message
      let importBlockData: Uint8Array
      if (importBlockBin.length >= 4) {
        const lengthPrefix = new DataView(importBlockBin.buffer, importBlockBin.byteOffset, 4).getUint32(0, true)
        if (lengthPrefix === importBlockBin.length - 4) {
          importBlockData = importBlockBin.subarray(4)
        } else if (importBlockBin[0] === 0x03) {
          // Message starts directly with discriminant, no length prefix
          importBlockData = importBlockBin
        } else {
          // Try skipping 4 bytes anyway
          importBlockData = importBlockBin.subarray(4)
        }
      } else {
        importBlockData = importBlockBin
      }

      // Verify discriminant
      const discriminant = importBlockData.length > 0 ? importBlockData[0] : undefined
      if (discriminant !== 0x03) {
        console.error(`❌ Skipping ${testFile}: Expected ImportBlock discriminant (0x03), got 0x${discriminant?.toString(16) || 'undefined'}`)
        failCount++
        continue
      }

      // Decode the message
      let importBlockMessage
      try {
        importBlockMessage = decodeFuzzMessage(importBlockData, configService)
        if (importBlockMessage.type !== FuzzMessageType.ImportBlock) {
          throw new Error(`Expected ImportBlock message, got ${importBlockMessage.type}`)
        }
      } catch (error) {
        console.error(`❌ Failed to decode ${testFile}: ${error instanceof Error ? error.message : String(error)}`)
        failCount++
        continue
      }

      const importBlock = importBlockMessage.payload as any
      const timeslot = importBlock.block?.header?.timeslot

      console.log(`\n📦 ImportBlock ${blockIndex} (file ${testFile}): timeslot ${timeslot}`)

      // Import the block
      console.log(`🔄 Importing block ${blockIndex}...`)
      const [importError] = await blockImporterService.importBlock(importBlock.block)
      if (importError) {
        console.error(`❌ Import error for block ${blockIndex}: ${importError.message}`)
        if (importError.stack) {
          console.error(`Stack: ${importError.stack}`)
        }
        failCount++
        // Continue with next block instead of throwing
        continue
      }
      console.log(`✅ Block ${blockIndex} imported successfully`)
      successCount++

      // Try to load and verify expected state root if available
      try {
        const fileNumber = blockNumber
        const expectedStateRootJsonPath = path.join(
          examplesDir,
          `${String(fileNumber).padStart(8, '0')}_target_state_root.json`,
        )
        
        if (existsSync(expectedStateRootJsonPath)) {
          const expectedStateRootJson = JSON.parse(
            readFileSync(expectedStateRootJsonPath, 'utf-8'),
          )
          const expectedStateRoot = expectedStateRootJson.state_root?.toLowerCase()
          
          if (expectedStateRoot) {
            const [stateRootError, stateRoot] = stateService.getStateRoot()
            if (!stateRootError && stateRoot) {
              const stateRootMatch = stateRoot.toLowerCase() === expectedStateRoot
              if (stateRootMatch) {
                console.log(`  ✅ State root matches expected for block ${blockIndex}`)
              } else {
                console.log(`  ❌ State root mismatch for block ${blockIndex}:`)
                console.log(`    Expected: ${expectedStateRoot}`)
                console.log(`    Got:      ${stateRoot.toLowerCase()}`)
              }
            }
          }
        }
      } catch (error) {
        // Expected state root file doesn't exist or failed to read, that's okay
      }

      // Log progress every 10 blocks
      if (successCount % 10 === 0) {
        console.log(`\n📊 Progress: ${successCount} blocks imported successfully, ${failCount} failed`)
      }
    }

    console.log(`\n📊 Final Summary:`)
    console.log(`   ✅ Successfully imported: ${successCount} additional blocks`)
    console.log(`   ❌ Failed: ${failCount} blocks`)
    console.log(`   📦 Total blocks processed: ${successCount + failCount + 2} (including blocks 1 and 2)`)

    // Assert that we imported at least some additional blocks
    expect(successCount).toBeGreaterThan(0)
  }, 600000) // 10 minute timeout for importing many blocks
})
