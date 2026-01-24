/**
 * JAM Conformance Traces Test
 *
 * Tests processing of individual trace files from jam-conformance fuzz-reports
 * Each trace file is processed separately with its own accumulation logs directory
 *
 * Environment variables:
 *   ANCESTRY_DISABLED - Optional. Set to 'true' or '1' to disable ancestry validation.
 *                       Useful for trace files where blocks don't have full ancestry context.
 */

import { config } from 'dotenv'
config() // Load environment variables from .env file

import { describe, it, expect, afterAll } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { NodeGenesisManager } from '../../services/genesis-manager'
import { ConfigService } from '../../services/config-service'
import {
  bytesToHex,
  Hex,
  hexToBytes,
} from '@pbnjam/core'
import { decodeRecent, decodeStateWorkReports } from '@pbnjam/codec'
import {
  type BlockTraceTestVector,
} from '@pbnjam/types'
import {
  convertJsonBlockToBlock,
  initializeServices,
} from '../test-utils'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

// Get JAM conformance version from environment variable, default to 0.7.2
const JAM_CONFORMANCE_VERSION = process.env.JAM_CONFORMANCE_VERSION || '0.7.2'

// Traces directory from jam-conformance
const TRACES_DIR = path.join(WORKSPACE_ROOT, 'submodules/jam-conformance/fuzz-reports', JAM_CONFORMANCE_VERSION, 'traces')

// Mismatch logs directory
const MISMATCH_LOGS_DIR = path.join(WORKSPACE_ROOT, 'mismatch-logs/jam-conformance')


// Track test results for summary at the end
interface TraceResult {
  trace: string
  success: boolean
  error?: string
}
const traceResults: TraceResult[] = []

// Ensure mismatch logs directory exists
function ensureMismatchLogsDir(): void {
  if (!existsSync(MISMATCH_LOGS_DIR)) {
    mkdirSync(MISMATCH_LOGS_DIR, { recursive: true })
  }
}

// Helper function to log mismatches to file
function logMismatchesToFile(
  tracePath: string,
  mismatches: Array<{ key: string; expected: string; actual: string | undefined }>,
  stateRootMismatch?: { expected: string; actual: string | undefined }
): void {
  ensureMismatchLogsDir()
  const sanitizedPath = tracePath.replace(/[^a-zA-Z0-9]/g, '_')
  const logFile = path.join(MISMATCH_LOGS_DIR, `${sanitizedPath}.json`)
  
  const logData = {
    trace: tracePath,
    timestamp: new Date().toISOString(),
    keyvalMismatches: mismatches,
    stateRootMismatch: stateRootMismatch,
  }
  
  writeFileSync(logFile, JSON.stringify(logData, null, 2), 'utf-8')
  console.log(`📝 Mismatches logged to: ${logFile}`)
}

// Helper function to get trace files grouped by directory
// Returns a map of directory path -> array of trace file paths
// Traces are organized in subdirectories, each containing numbered JSON files
function getTraceFilesByDirectory(): Map<string, string[]> {
  if (!existsSync(TRACES_DIR)) {
    console.warn(`⚠️  Traces directory does not exist: ${TRACES_DIR}`)
    return new Map()
  }
  
  const traceFilesByDir = new Map<string, string[]>()
  
  // Recursively search for JSON files in subdirectories
  function searchDirectory(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true })
    const traceFilesInDir: string[] = []
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        searchDirectory(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'genesis.json') {
        // Found a JSON file - add it to the list (exclude genesis.json)
        traceFilesInDir.push(fullPath)
      }
    }
    
    // If this directory has trace files, add them to the map
    if (traceFilesInDir.length > 0) {
      traceFilesInDir.sort()
      traceFilesByDir.set(dir, traceFilesInDir)
    }
  }
  
  searchDirectory(TRACES_DIR)
  return traceFilesByDir
}


describe('JAM Conformance Traces', () => {
  const configService = new ConfigService('tiny')

  // Log the version being used
  console.log(`\n📦 JAM Conformance Version: ${JAM_CONFORMANCE_VERSION}`)
  console.log(`📁 Traces directory: ${TRACES_DIR}`)

  // Get trace files grouped by directory
  const traceFilesByDir = getTraceFilesByDirectory()

  if (traceFilesByDir.size === 0) {
    it.skip('No trace files found - skipping tests', () => {
      console.warn(`No trace files found in ${TRACES_DIR}`)
    })
    return
  }

  // Print summary of all test results after all tests complete
  afterAll(() => {
    const passed = traceResults.filter(r => r.success)
    const failed = traceResults.filter(r => !r.success)
    
    console.log('\n' + '='.repeat(80))
    console.log('📊 JAM CONFORMANCE TRACES - FINAL SUMMARY')
    console.log('='.repeat(80))
    console.log(`✅ Passed: ${passed.length}`)
    console.log(`❌ Failed: ${failed.length}`)
    console.log(`📋 Total:  ${traceResults.length}`)
    
    if (failed.length > 0) {
      console.log('\n❌ FAILED TRACES:')
      console.log('-'.repeat(80))
      for (const result of failed) {
        console.log(`  • ${result.trace}`)
        if (result.error) {
          console.log(`    Error: ${result.error.slice(0, 200)}${result.error.length > 200 ? '...' : ''}`)
        }
      }
      console.log('-'.repeat(80))
      
      // Write failed traces to file for easy reference
      const failedTracesFile = path.join(MISMATCH_LOGS_DIR, 'failed-traces.json')
      ensureMismatchLogsDir()
      writeFileSync(failedTracesFile, JSON.stringify({
        version: JAM_CONFORMANCE_VERSION,
        timestamp: new Date().toISOString(),
        passed: passed.length,
        failed: failed.length,
        total: traceResults.length,
        failedTraces: failed,
      }, null, 2))
      console.log(`\n📝 Failed traces written to: ${failedTracesFile}`)
    }
    
    console.log('='.repeat(80) + '\n')
  })

  // Process each directory, loading genesis.json once per directory
  for (const [traceDir, traceFiles] of traceFilesByDir.entries()) {
    // Load genesis.json for this directory (if it exists)
    // Check in the trace directory first, then parent TRACES_DIR
    const traceDirGenesisJsonPath = path.join(traceDir, 'genesis.json')
    const parentGenesisJsonPath = path.join(TRACES_DIR, 'genesis.json')
    const genesisManager = new NodeGenesisManager(configService, {
      genesisJsonPath: existsSync(traceDirGenesisJsonPath)
        ? traceDirGenesisJsonPath
        : existsSync(parentGenesisJsonPath)
          ? parentGenesisJsonPath
          : undefined,
    })

    // Verify genesis JSON was loaded
    const [genesisError, genesisJson] = genesisManager.getGenesisJson()
    if (genesisError) {
      console.warn(`⚠️  Genesis JSON not found for directory ${path.relative(TRACES_DIR, traceDir)}, using defaults: ${genesisError.message}`)
    } else {
      console.log(`✅ Loaded genesis.json for directory: ${path.relative(TRACES_DIR, traceDir)}`)
    }

    // Extract validators from genesis.json (once per directory)
    const initialValidators = (genesisJson?.header?.epoch_mark?.validators || []).map((validator: any) => ({
      bandersnatch: validator.bandersnatch,
      ed25519: validator.ed25519,
      bls: bytesToHex(new Uint8Array(144)),
      metadata: bytesToHex(new Uint8Array(128)),
    }))

    // Process each trace file in this directory
    for (const traceFilePath of traceFiles) {
      // Get relative path from TRACES_DIR to preserve directory structure
      const relativePath = path.relative(TRACES_DIR, traceFilePath)
      const relativePathWithoutExt = relativePath.replace(/\.json$/, '')
      const traceFileName = path.basename(traceFilePath, '.json')
      
      it(`should process trace ${relativePathWithoutExt}`, async () => {
        console.log(`\n📋 Processing trace: ${relativePathWithoutExt}`)
        
        try {

        // Create accumulation logs directory preserving the subdirectory structure
        // Include version in the path: pvm-traces/jam-conformance/{version}/{relative_path}
        const accumulationLogsDir = path.join(
          WORKSPACE_ROOT,
          'pvm-traces',
          'jam-conformance',
          JAM_CONFORMANCE_VERSION,
          relativePathWithoutExt
        )
        if (!existsSync(accumulationLogsDir)) {
          mkdirSync(accumulationLogsDir, { recursive: true })
        }

        // Read the trace file
        const traceData: BlockTraceTestVector = JSON.parse(
          readFileSync(traceFilePath, 'utf-8')
        )

        // Validate trace file structure - must have block property
        if (!traceData.block || !traceData.block.header) {
          throw new Error(
            `Invalid trace file structure: missing 'block' or 'block.header' property. ` +
            `File: ${relativePathWithoutExt}. This might be a genesis.json file that should have been filtered out.`
          )
        }

        // Always dump traces to the trace-specific directory, preserving subdirectory structure
        // Include version in the path: jam-conformance/{version}/{relative_path}
        const traceSubfolder = `jam-conformance/${JAM_CONFORMANCE_VERSION}/${relativePathWithoutExt}`

        // Initialize services using shared utility (reuse genesisManager for this directory)
        const services = await initializeServices({ spec: 'tiny', traceSubfolder, genesisManager, initialValidators, useWasm: true })
        const { stateService, blockImporterService, recentHistoryService, chainManagerService, fullContext } = services

      // Disable ancestry validation if ANCESTRY_DISABLED env variable is set
      // This is needed for trace tests where blocks are processed independently
      // without full ancestry context (each block has its own pre_state)
        fullContext.configService.ancestryEnabled = false


      // Set pre-state from trace
      if (traceData.pre_state?.keyvals) {
        const [setStateError] = stateService.setState(
          traceData.pre_state.keyvals,
        )
        if (setStateError) {
          throw new Error(`Failed to set pre-state: ${setStateError.message}`)
        }
      } else if (genesisJson?.state?.keyvals) {
        const [setStateError] = stateService.setState(
          genesisJson.state.keyvals, )
        if (setStateError) {
          throw new Error(`Failed to set genesis state: ${setStateError.message}`)
        }
      }

      // Initialize pending work reports from pre-state
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

      // Store initial state snapshot in ChainManagerService for fork rollback
      // This allows rolling back to initial state if block import fails
      const [initTrieError, initTrie] = stateService.generateStateTrie()
      if (!initTrieError && initTrie) {
        chainManagerService.initializeGenesisHeader(convertJsonBlockToBlock(traceData.block).header, initTrie)
      }

      // Check if block import is expected to fail (pre_state == post_state)
      const preStateJson = JSON.stringify(traceData.pre_state)
      const postStateJson = JSON.stringify(traceData.post_state)
      const expectBlockToFail = preStateJson === postStateJson

      // Import the block
      const [importError] = await chainManagerService.importBlock(convertJsonBlockToBlock(traceData.block))
      
      if (expectBlockToFail) {
        // Block import should fail - this is expected behavior
        if (importError) {
          console.log(`✅ Trace ${relativePathWithoutExt} correctly failed to import: ${importError.message}`)
          // State should remain unchanged (already verified by snapshot revert in block importer)
          return
        } else {
          // Block imported when it should have failed
          throw new Error(`Trace ${relativePathWithoutExt} imported successfully but was expected to fail (pre_state == post_state)`)
        }
      }
      
      // Normal case: block should import successfully
      if (importError) {
        throw new Error(`Failed to import block: ${importError.message}, stack: ${importError.stack}`)
      }
      expect(importError).toBeUndefined()

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

      // Verify post-state matches expected post_state from trace
      const [stateTrieError, stateTrie] = stateService.generateStateTrie()
      expect(stateTrieError).toBeUndefined()
      expect(stateTrie).toBeDefined()

      const mismatches: Array<{ key: string; expected: string; actual: string | undefined }> = []
      
      // Track which keys are checked vs missing
      let checkedKeys = 0
      let missingKeys = 0

      for (const keyval of traceData.post_state.keyvals) {
        const expectedValue = stateTrie?.[keyval.key]
        
        // Check if key exists in generated state trie
        if (expectedValue === undefined) {
          // Key is missing from generated state trie - this is a failure
          missingKeys++
          mismatches.push({
            key: keyval.key,
            expected: keyval.value,
            actual: undefined,
          })
          
          const keyInfo = parseStateKeyForDebug(keyval.key as Hex)
          
          console.error(`\n❌ [Trace ${relativePathWithoutExt}] Missing State Key Detected:`)
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

        // Key exists - check if value matches
        checkedKeys++
        if (keyval.value !== expectedValue) {
          mismatches.push({
            key: keyval.key,
            expected: keyval.value,
            actual: expectedValue,
          })
          
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
          console.error(`\n❌ [Trace ${relativePathWithoutExt}] State Value Mismatch Detected:`)
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
          const traceShort = relativePathWithoutExt.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
          const filePrefix = `trace-${traceShort}-${chapterStr}-${keyShort}`
          
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

      // Compare state root
      const [stateRootError, computedStateRoot] = stateService.getStateRoot()
      expect(stateRootError).toBeUndefined()
      expect(computedStateRoot).toBeDefined()
      const expectedStateRoot = traceData.post_state.state_root
      
      let stateRootMismatch: { expected: string; actual: string | undefined } | undefined
      if (computedStateRoot !== expectedStateRoot) {
        stateRootMismatch = {
          expected: expectedStateRoot,
          actual: computedStateRoot,
        }
      }

      // Log mismatches to file if any found
      if (mismatches.length > 0 || stateRootMismatch) {
        logMismatchesToFile(relativePathWithoutExt, mismatches, stateRootMismatch)
      }

      // Log summary
      console.log(`\n✅ [Trace ${relativePathWithoutExt}] State Key Verification Summary:`)
      console.log(`  Total keys in post_state: ${traceData.post_state.keyvals.length}`)
      console.log(`  Keys checked (found in state trie): ${checkedKeys}`)
      console.log(`  Keys missing (not in state trie): ${missingKeys}`)
      if (missingKeys > 0) {
        console.error(`  ⚠️  ${missingKeys} key(s) are missing from the generated state trie`)
      }

      // Assert all keyvals match
      for (const keyval of traceData.post_state.keyvals) {
        const expectedValue = stateTrie?.[keyval.key]
        expect(expectedValue).toBeDefined()
        if (expectedValue === undefined) {
          throw new Error(`State key ${keyval.key} not found in state trie`)
        }
        expect(keyval.value).toBe(expectedValue)
      }

      // Assert state root matches
      expect(computedStateRoot).toBe(expectedStateRoot)

      console.log(`✅ Trace ${relativePathWithoutExt} processed successfully`)
      
      // Track success
      traceResults.push({
        trace: relativePathWithoutExt,
        success: true,
      })
      } catch (error) {
        // Track failure
        traceResults.push({
          trace: relativePathWithoutExt,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
        // Re-throw to fail the test
        throw error
      }
    }, { timeout: 120000 }) // 2 minute timeout
    } // Close inner for loop (trace files)
  } // Close outer for loop (directories)
})

