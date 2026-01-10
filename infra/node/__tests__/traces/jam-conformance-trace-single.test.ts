/**
 * JAM Conformance Single Trace Test
 *
 * Tests processing of a single trace file from jam-conformance fuzz-reports
 * Usage:
 *   TRACE_PATH=submodules/jam-conformance/fuzz-reports/0.7.2/traces/1766241814/00000035.json bun test ...
 *   bun test ... -- --trace-path submodules/jam-conformance/fuzz-reports/0.7.2/traces/1766241814/00000035.json
 */

import { config } from 'dotenv'
config() // Load environment variables from .env file

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
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
  initializeServices,
} from '../test-utils'
// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

// Traces directory from jam-conformance
const TRACES_DIR = path.join(WORKSPACE_ROOT, 'submodules/jam-conformance/fuzz-reports/0.7.2/traces')

// Helper function to get trace path from environment variable or CLI argument
function getTracePath(): string | null {
  // Check environment variable first
  const envTracePath = process.env.TRACE_PATH
  if (envTracePath) {
    // If it's a relative path, make it relative to workspace root
    if (path.isAbsolute(envTracePath)) {
      return envTracePath
    }
    return path.join(WORKSPACE_ROOT, envTracePath)
  }
  
  // Fallback to CLI argument
  const args = process.argv.slice(2)
  const tracePathIndex = args.indexOf('--trace-path')
  if (tracePathIndex !== -1 && tracePathIndex + 1 < args.length) {
    const tracePath = args[tracePathIndex + 1]
    if (!tracePath) {
      throw new Error('--trace-path requires a path argument')
    }
    if (path.isAbsolute(tracePath)) {
      return tracePath
    }
    return path.join(WORKSPACE_ROOT, tracePath)
  }
  
  return null
}


describe('JAM Conformance Single Trace', () => {
  const configService = new ConfigService('tiny')

  // Get trace path from environment or CLI
  const traceFilePath = getTracePath()

  if (!traceFilePath) {
    it.skip('No trace path specified - skipping test', () => {
      console.warn('Usage: TRACE_PATH=path/to/trace.json bun test ...')
      console.warn('   OR: bun test ... -- --trace-path path/to/trace.json')
    })
    return
  }

  if (!existsSync(traceFilePath)) {
    it.skip('Trace file not found - skipping test', () => {
      console.warn(`Trace file not found: ${traceFilePath}`)
    })
    return
  }

  // Get relative path from TRACES_DIR to preserve directory structure
  const relativePath = path.relative(TRACES_DIR, traceFilePath)
  const relativePathWithoutExt = relativePath.replace(/\.json$/, '')
  const traceFileName = path.basename(traceFilePath, '.json')

  it(`should process trace ${relativePathWithoutExt}`, async () => {
    console.log(`\n📋 Processing trace: ${relativePathWithoutExt}`)
    console.log(`📁 Trace file: ${traceFilePath}`)

    // Create accumulation logs directory preserving the subdirectory structure
    const accumulationLogsDir = path.join(
      WORKSPACE_ROOT,
      'pvm-traces',
      'jam-conformance',
      relativePathWithoutExt
    )
    if (!existsSync(accumulationLogsDir)) {
      mkdirSync(accumulationLogsDir, { recursive: true })
    }
    console.log(`📁 Accumulation logs: ${accumulationLogsDir}`)

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
    const initialValidators = genesisJson?.header?.epoch_mark?.validators || 
                              traceData.pre_state?.keyvals?.find((kv: any) => 
                                kv.key === '0x08000000000000000000000000000000000000000000000000000000000000'
                              ) ? [] : []

    // Initialize services using shared utility
    const services = await initializeServices(
      'tiny',
      `jam-conformance/${relativePathWithoutExt}`,
      genesisManager,
      initialValidators.map((validator: any) => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
        bls: bytesToHex(new Uint8Array(144)) as Hex,
        metadata: bytesToHex(new Uint8Array(128)) as Hex,
      })),
    )

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
        genesisJson.state.keyvals,
      )
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

    for (const keyval of traceData.post_state.keyvals) {
      const expectedValue = stateTrie?.[keyval.key]
      expect(expectedValue).toBeDefined()
      if (expectedValue === undefined) {
        throw new Error(`State key ${keyval.key} not found in state trie`)
      }
      expect(keyval.value).toBe(expectedValue)
    }

    // Compare state root
    const [stateRootError, computedStateRoot] = stateService.getStateRoot()
    expect(stateRootError).toBeUndefined()
    expect(computedStateRoot).toBeDefined()
    const expectedStateRoot = traceData.post_state.state_root
    expect(computedStateRoot).toBe(expectedStateRoot)

    console.log(`✅ Trace ${relativePathWithoutExt} processed successfully`)
  })
})


