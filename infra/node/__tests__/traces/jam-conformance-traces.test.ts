/**
 * JAM Conformance Traces Test
 *
 * Tests processing of individual trace files from jam-conformance fuzz-reports
 * Each trace file is processed separately with its own accumulation logs directory
 */

import { config } from 'dotenv'
config() // Load environment variables from .env file

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { NodeGenesisManager } from '../../services/genesis-manager'
import { ConfigService } from '../../services/config-service'
import {
  bytesToHex,
  Hex,
  hexToBytes,
} from '@pbnjam/core'
import { decodeRecent } from '@pbnjam/codec'
import {
  type BlockTraceTestVector,
} from '@pbnjam/types'
import {
  convertJsonBlockToBlock,
  convertJsonReportToWorkReport,
  initializeServices,
} from '../test-utils'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

// Get JAM conformance version from environment variable, default to 0.7.2
const JAM_CONFORMANCE_VERSION = process.env.JAM_CONFORMANCE_VERSION || '0.7.2'

// Traces directory from jam-conformance
const TRACES_DIR = path.join(WORKSPACE_ROOT, 'submodules/jam-conformance/fuzz-reports', JAM_CONFORMANCE_VERSION, 'traces')

// Cache directory for storing unhashed state after each block
const STATE_CACHE_DIR = path.join(WORKSPACE_ROOT, '.state-cache/jam-conformance')

// Mismatch logs directory
const MISMATCH_LOGS_DIR = path.join(WORKSPACE_ROOT, 'mismatch-logs/jam-conformance')

// Ensure cache directory exists
function ensureCacheDir(): void {
  if (!existsSync(STATE_CACHE_DIR)) {
    mkdirSync(STATE_CACHE_DIR, { recursive: true })
  }
}

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

// Helper function to get all trace files from the traces directory
// Traces are organized in subdirectories, each containing numbered JSON files
function getTraceFiles(): string[] {
  if (!existsSync(TRACES_DIR)) {
    console.warn(`⚠️  Traces directory does not exist: ${TRACES_DIR}`)
    return []
  }
  
  const traceFiles: string[] = []
  
  // Recursively search for JSON files in subdirectories
  function searchDirectory(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        searchDirectory(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        // Found a JSON file - add it to the list
        traceFiles.push(fullPath)
      }
    }
  }
  
  searchDirectory(TRACES_DIR)
  return traceFiles.sort()
}


describe('JAM Conformance Traces', () => {
  const configService = new ConfigService('tiny')

  // Log the version being used
  console.log(`\n📦 JAM Conformance Version: ${JAM_CONFORMANCE_VERSION}`)
  console.log(`📁 Traces directory: ${TRACES_DIR}`)

  // Get all trace files
  const traceFiles = getTraceFiles()

  if (traceFiles.length === 0) {
    it.skip('No trace files found - skipping tests', () => {
      console.warn(`No trace files found in ${TRACES_DIR}`)
    })
    return
  }

  // Process each trace file individually
  for (const traceFilePath of traceFiles) {
    // Get relative path from TRACES_DIR to preserve directory structure
    const relativePath = path.relative(TRACES_DIR, traceFilePath)
    const relativePathWithoutExt = relativePath.replace(/\.json$/, '')
    const traceFileName = path.basename(traceFilePath, '.json')
    
    it(`should process trace ${relativePathWithoutExt}`, async () => {
      console.log(`\n📋 Processing trace: ${relativePathWithoutExt}`)

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

      // Find genesis.json - it should be in the same directory or parent
      const genesisJsonPath = path.join(TRACES_DIR, 'genesis.json')
      const genesisManager = new NodeGenesisManager(configService, {
        genesisJsonPath: existsSync(genesisJsonPath) ? genesisJsonPath : undefined,
      })

      // Verify genesis JSON was loaded
      const [error, genesisJson] = genesisManager.getGenesisJson()
      if (error) {
        console.warn(`⚠️  Genesis JSON not found, using defaults: ${error.message}`)
      }

      // Extract validators from genesis.json or trace data
      const initialValidators = (genesisJson?.header?.epoch_mark?.validators || []).map((validator: any) => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
        bls: bytesToHex(new Uint8Array(144)),
        metadata: bytesToHex(new Uint8Array(128)),
      }))

      // Always dump traces to the trace-specific directory, preserving subdirectory structure
      // Include version in the path: jam-conformance/{version}/{relative_path}
      const traceSubfolder = `jam-conformance/${JAM_CONFORMANCE_VERSION}/${relativePathWithoutExt}`

      // Initialize services using shared utility
      const services = await initializeServices('tiny', traceSubfolder, genesisManager, initialValidators)
      const { stateService, blockImporterService, recentHistoryService } = services

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

      // Initialize recent history from pre-state
      const betaKeyval = traceData.pre_state?.keyvals?.find(
        (kv: { key: string }) => kv.key === '0x03000000000000000000000000000000000000000000000000000000000000'
      )
      if (betaKeyval) {
        const betaData = hexToBytes(betaKeyval.value as Hex)
        const [decodeError, decodeResult] = decodeRecent(betaData)
        if (!decodeError && decodeResult) {
          recentHistoryService.setRecent(decodeResult.value)
        }
      }

      // Convert and import the block from trace
      const block = convertJsonBlockToBlock(traceData.block)

      // Import the block
      const [importError] = await blockImporterService.importBlock(block)
      if (importError) {
        throw new Error(`Failed to import block: ${importError.message}, stack: ${importError.stack}`)
      }
      expect(importError).toBeUndefined()

      // Verify post-state matches expected post_state from trace
      const [stateTrieError, stateTrie] = stateService.generateStateTrie()
      expect(stateTrieError).toBeUndefined()
      expect(stateTrie).toBeDefined()

      const mismatches: Array<{ key: string; expected: string; actual: string | undefined }> = []
      
      for (const keyval of traceData.post_state.keyvals) {
        const expectedValue = stateTrie?.[keyval.key]
        if (expectedValue === undefined) {
          mismatches.push({
            key: keyval.key,
            expected: keyval.value,
            actual: undefined,
          })
        } else if (keyval.value !== expectedValue) {
          mismatches.push({
            key: keyval.key,
            expected: keyval.value,
            actual: expectedValue,
          })
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
    }, { timeout: 120000 }) // 2 minute timeout
  }
})

