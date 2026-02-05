/**
 * JAM Conformance Single Trace Test
 *
 * Tests processing of trace files from a specific trace ID in jam-conformance fuzz-reports
 * Usage:
 *   TRACE_ID=1766243176 bun test ...
 *   bun test ... -- --trace-id 1766243176
 *   TRACE_ID=1766243176 START_BLOCK=0 STOP_BLOCK=10 bun test ... (to process specific blocks)
 *
 * Environment variables:
 *   TRACE_ID - Required. The trace ID to process (e.g., 1766243176)
 *   START_BLOCK - Optional. Start processing from this block number (default: 0)
 *   STOP_BLOCK - Optional. Stop processing after this block number
 *   ANCESTRY_DISABLED - Optional. Set to 'true' or '1' to disable ancestry validation.
 *                       Useful for sparse trace files where blocks don't have full ancestry context.
 */

import { config } from 'dotenv'
config() // Load environment variables from .env file

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { NodeGenesisManager } from '../../services/genesis-manager'
import { ConfigService } from '../../services/config-service'
import {
  bytesToHex,
  Hex,
  hexToBytes,
} from '@pbnjam/core'
import {
  decodeRecent,
  decodeStateWorkReports,
  calculateBlockHashFromHeader,
  determineSingleKeyType,
} from '@pbnjam/codec'
import {
  type BlockTraceTestVector,
} from '@pbnjam/types'
import {
  convertJsonBlockToBlock,
  initializeServices,
  getStartBlock,
  getStopBlock,
} from '../test-utils'
// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

const MISMATCH_LOGS_DIR = path.join(WORKSPACE_ROOT, 'mismatch-logs/jam-conformance')

function ensureMismatchLogsDir(): void {
  if (!existsSync(MISMATCH_LOGS_DIR)) {
    mkdirSync(MISMATCH_LOGS_DIR, { recursive: true })
  }
}

function logMismatchesToFile(
  traceOrBlockLabel: string,
  mismatches: Array<{ key: string; expected: string; actual: string | undefined }>,
  stateRootMismatch?: { expected: string; actual: string | undefined },
  extraKeysInfo?: { count: number; sampleKeys: string[] },
): void {
  ensureMismatchLogsDir()
  const sanitized = traceOrBlockLabel.replace(/[^a-zA-Z0-9]/g, '_')
  const logFile = path.join(MISMATCH_LOGS_DIR, `${sanitized}.json`)
  const logData = {
    traceOrBlock: traceOrBlockLabel,
    timestamp: new Date().toISOString(),
    keyvalMismatches: mismatches,
    stateRootMismatch: stateRootMismatch,
    extraKeysInOurState: extraKeysInfo,
  }
  writeFileSync(logFile, JSON.stringify(logData, null, 2), 'utf-8')
  console.log(`📝 Mismatches logged to: ${logFile}`)
}

// Get JAM conformance version from environment variable, default to 0.7.2
const JAM_CONFORMANCE_VERSION = process.env.JAM_CONFORMANCE_VERSION || '0.7.2'

// Traces directories from both jam-conformance repositories
const TRACES_DIRS = [
  path.join(WORKSPACE_ROOT, 'submodules/jam-conformance/fuzz-reports', JAM_CONFORMANCE_VERSION, 'traces'),
  path.join(WORKSPACE_ROOT, 'submodules/w3f-jam-conformance/fuzz-reports', JAM_CONFORMANCE_VERSION, 'traces'),
]

// Helper function to get trace ID from environment variable or CLI argument
function getTraceId(): string | null {
  // Check environment variable first
  const envTraceId = process.env.TRACE_ID
  if (envTraceId) {
    return envTraceId
  }
  
  // Fallback to CLI argument
  const args = process.argv.slice(2)
  const traceIdIndex = args.indexOf('--trace-id')
  if (traceIdIndex !== -1 && traceIdIndex + 1 < args.length) {
    const traceId = args[traceIdIndex + 1]
    if (!traceId) {
      throw new Error('--trace-id requires a trace ID argument')
    }
    return traceId
  }
  
  return null
}


describe('JAM Conformance Single Trace', () => {
  const configService = new ConfigService('tiny')

  // Get trace ID from environment or CLI
  const traceId = getTraceId()

  if (!traceId) {
    it.skip('No trace ID specified - skipping test', () => {
      console.warn('Usage: TRACE_ID=1766243176 bun test ...')
      console.warn('   OR: bun test ... -- --trace-id 1766243176')
      console.warn('   Optional: START_BLOCK=0 STOP_BLOCK=10 to filter blocks')
    })
    return
  }

  // Find trace directory in either jam-conformance or w3f-jam-conformance
  let traceDir: string | null = null
  let tracesDir: string | null = null
  for (const dir of TRACES_DIRS) {
    const candidateTraceDir = path.join(dir, traceId)
    if (existsSync(candidateTraceDir)) {
      traceDir = candidateTraceDir
      tracesDir = dir
      break
    }
  }

  if (!traceDir || !tracesDir) {
    it.skip('Trace directory not found - skipping test', () => {
      console.warn(`Trace directory not found in any of: ${TRACES_DIRS.join(', ')}`)
      console.warn(`Looking for trace ID: ${traceId}`)
    })
    return
  }

  // Get all JSON trace files in the directory and sort them numerically
  const allFiles = readdirSync(traceDir)
  const traceFiles = allFiles
    .filter((file) => file.endsWith('.json') && file !== 'genesis.json')
    .sort((a, b) => {
      // Extract number from filename (e.g., "00000000" from "00000000.json")
      const numA = parseInt(a.replace('.json', ''), 10)
      const numB = parseInt(b.replace('.json', ''), 10)
      return numA - numB
    })

  if (traceFiles.length === 0) {
    it.skip('No trace files found - skipping test', () => {
      console.warn(`No trace JSON files found in ${traceDir}`)
    })
    return
  }

  // Get start and stop block numbers
  const startBlock = getStartBlock()
  const stopBlock = getStopBlock()
  if (startBlock > 0) {
    console.log(`\n🚀 Starting from block ${startBlock} (START_BLOCK=${startBlock})`)
  }
  if (stopBlock !== undefined) {
    console.log(`🛑 Will stop after block ${stopBlock} (STOP_BLOCK=${stopBlock})`)
  }

  // Filter trace files based on start/stop block
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
    it.skip('No trace files in range - skipping test', () => {
      console.warn(`No trace files found in range [${startBlock}, ${stopBlock ?? 'end'}]`)
    })
    return
  }

  console.log(`📦 Found ${filteredTraceFiles.length} trace files to process (filtered from ${traceFiles.length} total)`)

  // Process all trace files in sequence
  it(`should process trace ${traceId}`, async () => {
    // Find genesis.json - it should be in the trace directory or parent
    const genesisJsonPath = path.join(traceDir, 'genesis.json')
    const parentGenesisJsonPath = path.join(tracesDir!, 'genesis.json')
    const genesisManager = new NodeGenesisManager(configService, {
      genesisJsonPath: existsSync(genesisJsonPath) 
        ? genesisJsonPath 
        : existsSync(parentGenesisJsonPath) 
          ? parentGenesisJsonPath 
          : undefined,
    })

    // Verify genesis JSON was loaded
    const [error, genesisJson] = genesisManager.getGenesisJson()
    if (error) {
      console.warn(`⚠️  Genesis JSON not found, using defaults: ${error.message}`)
    }

    // Extract validators from genesis.json
    const initialValidators = (genesisJson?.header?.epoch_mark?.validators || []).map((validator: any) => ({
      bandersnatch: validator.bandersnatch,
      ed25519: validator.ed25519,
      bls: bytesToHex(new Uint8Array(144)),
      metadata: bytesToHex(new Uint8Array(128)),
    }))

    // Initialize services once for all blocks
    // Determine which repository was used (jam-conformance or w3f-jam-conformance)
    const repoName = tracesDir!.includes('w3f-jam-conformance') ? 'w3f-jam-conformance' : 'jam-conformance'
    const traceSubfolder = `${repoName}/${JAM_CONFORMANCE_VERSION}/${traceId}`
    // const services = await initializeServices({ spec: 'tiny', traceSubfolder, genesisManager, initialValidators, useWasm: true })
    const services = await initializeServices({ spec: 'tiny', traceSubfolder, genesisManager, initialValidators, useRust: true, useRingVrfWasm: true, useIetfVrfWasm: true })

    const { stateService, blockImporterService, recentHistoryService, chainManagerService, fullContext } = services

    fullContext.configService.ancestryEnabled = false
     

    // Helper function to parse state key using state service
    const parseStateKeyForDebug = (keyHex: Hex) => {
      const [error, parsedKey] = stateService.parseStateKey(keyHex)
      if (error) {
        return { error: error.message }
      }
      // Add type information for better debugging
      if ('chapterIndex' in parsedKey) {
        if (parsedKey.chapterIndex === 0 && 'serviceId' in parsedKey) {
          return { ...parsedKey, type: 'C(s, h)' }
        }
        if (parsedKey.chapterIndex === 255 && 'serviceId' in parsedKey) {
          return { ...parsedKey, type: 'C(255, s)' }
        }
        return { ...parsedKey, type: 'C(i)' }
      }
      return parsedKey
    }

    // Helper function to get chapter name
    const getChapterName = (chapterIndex: number): string => {
      const chapterNames: Record<number, string> = {
        0: 'C(s, h) keyvals',
        1: 'authpool (α)',
        2: 'authqueue (φ)',
        3: 'recent (β)',
        4: 'safrole (γ)',
        5: 'disputes (ψ)',
        6: 'entropy (ε)',
        7: 'stagingset (ι)',
        8: 'activeset (κ)',
        9: 'previousset (λ)',
        10: 'reports (ρ)',
        11: 'thetime (τ)',
        12: 'privileges',
        13: 'activity (π)',
        14: 'ready (ω)',
        15: 'accumulated (ξ)',
        16: 'lastaccout (θ)',
        255: 'service accounts',
      }
      return chapterNames[chapterIndex] || `unknown (${chapterIndex})`
    }

    // Helper function to truncate long hex strings for logging
    const truncateHex = (hex: string, maxLength: number = 100) => {
      if (hex.length <= maxLength) return hex
      return `${hex.slice(0, maxLength)}... (${hex.length} chars total)`
    }

    // Helper function to create a JSON stringify replacer that truncates long hex strings
    const createTruncatingReplacer = (maxHexLength: number = 200) => {
      return (key: string, value: any) => {
        if (typeof value === 'string' && value.startsWith('0x') && value.length > maxHexLength) {
          return truncateHex(value, maxHexLength)
        }
        if (typeof value === 'bigint') return value.toString()
        if (value === undefined) return null
        return value
      }
    }

    // Helper function to verify post-state (same pattern as jam-conformance-traces-wasm.test.ts:
    // collect all mismatches, log/dump everything, then assert so failures show full context)
    const verifyPostState = (blockNumber: number, blockJsonData: BlockTraceTestVector, traceLabel: string) => {
      const [stateTrieError, stateTrie] = stateService.generateStateTrie()
      expect(stateTrieError).toBeUndefined()
      expect(stateTrie).toBeDefined()

      const mismatches: Array<{ key: string; expected: string; actual: string | undefined }> = []
      let checkedKeys = 0
      let missingKeys = 0

      for (const keyval of blockJsonData.post_state.keyvals) {
        const expectedValue = stateTrie?.[keyval.key]
        
        // Check if key exists in generated state trie
        if (expectedValue === undefined) {
          missingKeys++
          mismatches.push({ key: keyval.key, expected: keyval.value, actual: undefined })
          const keyInfo = parseStateKeyForDebug(keyval.key as Hex)
          
          console.error(`\n❌ [Block ${blockNumber}] Missing State Key Detected:`)
          console.error('=====================================')
          console.error(`State Key: ${keyval.key}`)
          if ('error' in keyInfo) {
            console.error(`Key Info Error: ${keyInfo.error}`)
          } else if ('chapterIndex' in keyInfo) {
            console.error(`Chapter: ${keyInfo.chapterIndex} - ${getChapterName(keyInfo.chapterIndex)}`)
            if ('type' in keyInfo) {
              console.error(`Key Type: ${keyInfo.type}`)
            }
            if ('serviceId' in keyInfo) {
              console.error(`Service ID: ${keyInfo.serviceId}`)
            }
          } else if ('serviceId' in keyInfo && !('error' in keyInfo) && !('chapterIndex' in keyInfo)) {
            const serviceKeyInfo = keyInfo as { serviceId: bigint; type?: string; hash?: Hex }
            console.error(`Service ID: ${serviceKeyInfo.serviceId}`)
            if (serviceKeyInfo.type) {
              console.error(`Key Type: ${serviceKeyInfo.type}`)
            }
            if (serviceKeyInfo.hash) {
              console.error(`Hash: ${serviceKeyInfo.hash}`)
            }
          } else {
            console.error(`Key Info: ${JSON.stringify(keyInfo)}`)
          }
          console.error(`Expected Value: ${truncateHex(keyval.value)}`)
          console.error(`Actual Value: undefined (key not found in state trie)`)
          console.error('=====================================\n')
          
          // Fail the test - key should exist
          expect(expectedValue).toBeDefined()
          continue
        }

        checkedKeys++
        if (keyval.value !== expectedValue) {
          mismatches.push({ key: keyval.key, expected: keyval.value, actual: expectedValue })
          // Parse the state key to get chapter information
          const keyInfo = parseStateKeyForDebug(keyval.key as Hex)
          
          let decodedExpected: any = null
          let decodedActual: any = null

          // Try to decode both expected and actual values if it's a chapter key
          if ('chapterIndex' in keyInfo && !keyInfo.error) {
            const chapterIndex = keyInfo.chapterIndex
            try {
              // Handle C(s, h) keys (chapterIndex: 0) - these are raw keyvals, not decoded
              if (chapterIndex === 0 && 'serviceId' in keyInfo) {
                // For C(s, h) keys, get the keyvals object and look up the specific key
                const keyvals = stateService.getStateComponent(
                  chapterIndex,
                  keyInfo.serviceId,
                ) as Record<Hex, Hex>
                decodedActual = {
                  keyvals: keyvals,
                  specificKey: keyval.key,
                  value: keyvals?.[keyval.key] || undefined,
                }
                decodedExpected = {
                  key: keyval.key,
                  value: keyval.value,
                }
              } else {
                // For regular chapter keys, decode the value
                const expectedBytes = hexToBytes(keyval.value as Hex)
                // Access private stateTypeRegistry to get the decoder
                const decoder = (stateService as any).stateTypeRegistry?.get(chapterIndex)
                if (decoder) {
                  const [decodeError, decoded] = decoder(expectedBytes)
                  if (!decodeError && decoded) {
                    decodedExpected = decoded.value
                  } else {
                    decodedExpected = { 
                      error: decodeError?.message || 'Decode failed',
                      decodeError: decodeError ? String(decodeError) : undefined
                    }
                  }
                } else {
                  decodedExpected = { error: `No decoder found for chapter ${chapterIndex}` }
                }

                // Get decoded actual state component
                decodedActual = stateService.getStateComponent(
                  chapterIndex,
                  'serviceId' in keyInfo ? keyInfo.serviceId : undefined,
                )
              }
            } catch (error) {
              decodedExpected = decodedExpected || { 
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
              }
              decodedActual = decodedActual || { 
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
              }
            }
          }

          // Log detailed mismatch information
          console.error(`\n❌ [Block ${blockNumber}] State Value Mismatch Detected:`)
          console.error('=====================================')
          console.error(`State Key: ${keyval.key}`)
          if ('error' in keyInfo) {
            console.error(`Key Info Error: ${keyInfo.error}`)
          } else if ('chapterIndex' in keyInfo) {
            console.error(`Chapter: ${keyInfo.chapterIndex} - ${getChapterName(keyInfo.chapterIndex)}`)
            if ('type' in keyInfo) {
              console.error(`Key Type: ${keyInfo.type}`)
            }
            if ('serviceId' in keyInfo) {
              console.error(`Service ID: ${keyInfo.serviceId}`)
            }
          } else if ('serviceId' in keyInfo && !('error' in keyInfo) && !('chapterIndex' in keyInfo)) {
            const serviceKeyInfo = keyInfo as { serviceId: bigint; type?: string; hash?: Hex }
            console.error(`Service ID: ${serviceKeyInfo.serviceId}`)
            if (serviceKeyInfo.type) {
              console.error(`Key Type: ${serviceKeyInfo.type}`)
            }
            if (serviceKeyInfo.hash) {
              console.error(`Hash: ${serviceKeyInfo.hash}`)
            }
          } else {
            console.error(`Key Info: ${JSON.stringify(keyInfo)}`)
          }
          console.error(`Expected Value (hex): ${truncateHex(keyval.value)}`)
          console.error(`Actual Value (hex): ${truncateHex(expectedValue || '')}`)
          if (decodedExpected) {
            // For chapter 0 (C(s, h) keys), don't show the entire keyvals object
            if ('chapterIndex' in keyInfo && keyInfo.chapterIndex === 0 && 'keyvals' in decodedExpected) {
              console.error(`\nDecoded Expected Value:`, {
                key: decodedExpected.key || keyval.key,
                value: decodedExpected.value || keyval.value,
                keyvalsCount: Object.keys(decodedExpected.keyvals || {}).length,
              })
            } else {
              console.error(`\nDecoded Expected Value:`, JSON.stringify(decodedExpected, createTruncatingReplacer(), 2))
            }
          }
          if (decodedActual) {
            // For chapter 0 (C(s, h) keys), don't show the entire keyvals object
            if ('chapterIndex' in keyInfo && keyInfo.chapterIndex === 0 && 'keyvals' in decodedActual) {
              console.error(`\nDecoded Actual Value:`, {
                specificKey: decodedActual.specificKey || keyval.key,
                value: decodedActual.value || expectedValue,
                keyvalsCount: Object.keys(decodedActual.keyvals || {}).length,
                hasExpectedKey: decodedActual.keyvals ? keyval.key in decodedActual.keyvals : false,
              })
            } else {
              console.error(`\nDecoded Actual Value:`, JSON.stringify(decodedActual, createTruncatingReplacer(), 2))
            }
          }
          console.error('=====================================\n')
          
          // Dump expected and actual values to files for easier comparison
          const mismatchDir = path.join(WORKSPACE_ROOT, '.state-mismatches')
          if (!existsSync(mismatchDir)) {
            mkdirSync(mismatchDir, { recursive: true })
          }
          const keyShort = keyval.key.slice(0, 20)
          const chapterStr = 'chapterIndex' in keyInfo && !keyInfo.error ? `chapter${keyInfo.chapterIndex}` : 'unknown'
          const filePrefix = `block${blockNumber.toString().padStart(8, '0')}-${chapterStr}-${keyShort}`
          
          // Write hex values
          writeFileSync(path.join(mismatchDir, `${filePrefix}-expected.hex`), keyval.value)
          writeFileSync(path.join(mismatchDir, `${filePrefix}-actual.hex`), expectedValue || '')
          
          // Write binary values
          writeFileSync(path.join(mismatchDir, `${filePrefix}-expected.bin`), hexToBytes(keyval.value as Hex))
          if (expectedValue) {
            writeFileSync(path.join(mismatchDir, `${filePrefix}-actual.bin`), hexToBytes(expectedValue as Hex))
          }
          
          // Write decoded JSON values
          if (decodedExpected) {
            writeFileSync(
              path.join(mismatchDir, `${filePrefix}-expected.json`),
              JSON.stringify(decodedExpected, (_, v) =>
                typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
                2)
            )
          }
          if (decodedActual) {
            writeFileSync(
              path.join(mismatchDir, `${filePrefix}-actual.json`),
              JSON.stringify(decodedActual, (_, v) =>
                typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
                2)
            )
          }
          console.log(`📁 Mismatch files dumped to: ${mismatchDir}/${filePrefix}-*`)
        }
      }

      // Check for extra keys: keys in our state trie that are not in expected post_state.
      // We only loop over expected keyvals above, so we never assert on our key set.
      // Extra keys would pass keyval checks but cause state root mismatch.
      const expectedKeySet = new Set(blockJsonData.post_state.keyvals.map((kv) => kv.key))
      const ourKeys = Object.keys(stateTrie ?? {}) as Hex[]
      const extraKeys = ourKeys.filter((k) => !expectedKeySet.has(k))
      const extraKeysCount = extraKeys.length

      // Compare state root with expected post_state
      const [stateRootError, computedStateRoot] = stateService.getStateRoot()
      expect(stateRootError).toBeUndefined()
      expect(computedStateRoot).toBeDefined()
      const expectedStateRoot = blockJsonData.post_state.state_root
      let stateRootMismatch: { expected: string; actual: string | undefined } | undefined
      if (computedStateRoot !== expectedStateRoot) {
        stateRootMismatch = { expected: expectedStateRoot, actual: computedStateRoot }
      }

      if (mismatches.length > 0 || stateRootMismatch) {
        const extraKeysInfo =
          extraKeysCount > 0
            ? { count: extraKeysCount, sampleKeys: extraKeys.slice(0, 10) }
            : undefined
        logMismatchesToFile(
          `${traceLabel}-block-${blockNumber}`,
          mismatches,
          stateRootMismatch,
          extraKeysInfo,
        )
      }

      // Log summary (include extra keys so state root mismatch can be diagnosed)
      console.log(`\n✅ [Block ${blockNumber}] State Key Verification Summary:`)
      console.log(`  Total keys in post_state (expected): ${blockJsonData.post_state.keyvals.length}`)
      console.log(`  Total keys in our state trie: ${ourKeys.length}`)
      console.log(`  Keys checked (found in state trie): ${checkedKeys}`)
      console.log(`  Keys missing (not in state trie): ${missingKeys}`)
      console.log(`  Extra keys (in our trie, not in expected): ${extraKeysCount}`)
      if (missingKeys > 0) {
        console.error(`  ⚠️  ${missingKeys} key(s) are missing from the generated state trie`)
      }
      if (extraKeysCount > 0) {
        console.error(`  ⚠️  ${extraKeysCount} key(s) in our state trie are not in expected post_state (can cause state root mismatch)`)
        console.error(`  Sample extra keys (first 5): ${extraKeys.slice(0, 5).join(', ')}`)
        for (let i = 0; i < extraKeys.length; i++) {
          const keyHex = extraKeys[i] as Hex
          const keyInfo = parseStateKeyForDebug(keyHex)
          const chapterName = 'chapterIndex' in keyInfo ? getChapterName(keyInfo.chapterIndex) : 'unknown'
          const serviceId = 'serviceId' in keyInfo ? keyInfo.serviceId : undefined
          let keyvalType = ''
          if ('chapterIndex' in keyInfo && keyInfo.chapterIndex === 0 && stateTrie?.[keyHex]) {
            try {
              const valueBytes = hexToBytes(stateTrie[keyHex] as Hex)
              const decoded = determineSingleKeyType(
                keyHex,
                valueBytes,
                BigInt(blockNumber),
              )
              keyvalType = `, keyvalType: ${decoded.keyType}`
            } catch {
              keyvalType = ', keyvalType: (decode failed)'
            }
          }
          console.error(`  Extra key [${i}]: ${keyHex} -> chapter: ${chapterName}, serviceId: ${serviceId ?? 'n/a'}${keyvalType}`)
        }
      }

      // Assert all keyvals match (same as jam-conformance-traces-wasm.test.ts)
      for (const keyval of blockJsonData.post_state.keyvals) {
        const expectedValue = stateTrie?.[keyval.key]
        expect(expectedValue).toBeDefined()
        if (expectedValue === undefined) {
          throw new Error(`State key ${keyval.key} not found in state trie`)
        }
        expect(keyval.value).toBe(expectedValue)
      }

      expect(computedStateRoot).toBe(expectedStateRoot)
    }

    let isFirstBlock = true
    for (const traceFile of filteredTraceFiles) {
      const blockNum = parseInt(traceFile.replace('.json', ''), 10)
      const traceFilePath = path.join(traceDir!, traceFile)
      // Read the trace file
      const traceData: BlockTraceTestVector = JSON.parse(
        readFileSync(traceFilePath, 'utf-8')
      )

      // Clear state before loading pre_state - this is critical for fork switching
      // Gray Paper: when switching between forks, the entire state must be reset
      stateService.clearState()

      // Set pre-state from trace (for each block)
      if (traceData.pre_state?.keyvals) {
        const [setStateError1] = stateService.setState(
          traceData.pre_state.keyvals,
        )
        if (setStateError1) {
          throw new Error(`Failed to set pre-state for block ${blockNum}: ${setStateError1.message}`)
        }
      } else if (genesisJson?.state?.keyvals && isFirstBlock) {
        // Only use genesis state for the first block being processed
        const [setStateError2] = stateService.setState(
          genesisJson.state.keyvals,
        )
        if (setStateError2) {
          throw new Error(`Failed to set genesis state: ${setStateError2.message}`)
        }
      }

      // Initialize pending work reports from pre-state for EACH block
      // Gray Paper Eq. 296-298: Core must not be engaged (no pending report)
      // This is critical for CORE_ENGAGED validation to work correctly
      const reportsKeyval = traceData.pre_state?.keyvals?.find(
        (kv: { key: string }) => kv.key === '0x0a000000000000000000000000000000000000000000000000000000000000'
      )
      if (reportsKeyval) {
        const reportsData = hexToBytes(reportsKeyval.value as Hex)
        const [decodeError, decodeResult] = decodeStateWorkReports(reportsData, fullContext.configService)
        if (!decodeError && decodeResult) {
          fullContext.workReportService.setPendingReports(decodeResult.value)
        }
      }

      // Set accumulationService.lastProcessedSlot from pre_state's thetime (Chapter 11)
      // This is critical because lastProcessedSlot is NOT part of the state trie -
      // it's an internal variable used to calculate slot delta for ready queue shifting.
      // Without this, shiftStateForBlockTransition() uses stale lastProcessedSlot from
      // previous block processing, causing incorrect ready queue state.
      // Chapter 11 key: 0x0b followed by 29 zero bytes
      const thetimeKeyval = traceData.pre_state?.keyvals?.find(
        (kv: { key: string }) => kv.key === '0x0b000000000000000000000000000000000000000000000000000000000000'
      )
      if (thetimeKeyval) {
        // thetime is encoded as a little-endian u32 (4 bytes)
        const thetimeBytes = hexToBytes(thetimeKeyval.value as Hex)
        // Read as little-endian u32
        const thetime = BigInt(
          thetimeBytes[0] |
          (thetimeBytes[1] << 8) |
          (thetimeBytes[2] << 16) |
          (thetimeBytes[3] << 24)
        )
        fullContext.accumulationService.setLastProcessedSlot(thetime)
      } else {
        // No thetime in pre_state - reset to null for fresh start
        fullContext.accumulationService.setLastProcessedSlot(null)
      }
      
      // Store initial state snapshot for the first block being processed
      // This registers the parent block hash in blockNodes so importBlock can find it
      // Note: Check isFirstBlock (first iteration) not blockNum === startBlock, since
      // trace files may start at a higher block number (e.g., 207.json with START_BLOCK=1)
      if (isFirstBlock) {
        // Store initial state snapshot in ChainManagerService for fork rollback
        // This allows rolling back to initial state if first block fails
        const [initTrieError, initTrie] = stateService.generateStateTrie()
        if (!initTrieError && initTrie) {
          chainManagerService.saveStateSnapshot(traceData.block.header.parent, initTrie)
        }
        isFirstBlock = false
      }

    // Convert and import the block from trace
    const block = convertJsonBlockToBlock(traceData.block)

    // Check if block import is expected to fail (pre_state == post_state)
      const preStateJson = JSON.stringify(traceData.pre_state)
      const postStateJson = JSON.stringify(traceData.post_state)
      const expectBlockToFail = preStateJson === postStateJson

    // Import the block
    // const [importError] = await blockImporterService.importBlock(block)
    const [importError] = await chainManagerService.importBlock(block)
      if (expectBlockToFail) {
        // Block import should fail - this is expected behavior
        if (importError) {
          console.log(`✅ Trace ${traceId} block ${blockNum} correctly failed to import: ${importError.message}`)
          // State should remain unchanged (already verified by snapshot revert in block importer)
          // Continue to next block
          continue
        } else {
          // Block imported when it should have failed
          throw new Error(`Trace ${traceId} block ${blockNum} imported successfully but was expected to fail (pre_state == post_state)`)
        }
      }
      
      // Normal case: block should import successfully
      if (importError) {
        throw new Error(`Failed to import block ${blockNum}: ${importError.message}, stack: ${importError.stack}`)
      }
      expect(importError).toBeUndefined()
      
      // Verify post-state matches expected post_state from trace
      verifyPostState(blockNum, traceData, traceId)

      console.log(`✅ Trace ${traceId} block ${blockNum} processed successfully`)

      // Check if we should stop after this block
      if (stopBlock !== undefined && blockNum >= stopBlock) {
        console.log(`\n🛑 Stopping after block ${blockNum} (STOP_BLOCK=${stopBlock})`)
        break
      }
    }
  }, { timeout: 600000 }) // 10 minute timeout for processing multiple blocks
})


