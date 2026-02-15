#!/usr/bin/env bun

/**
 * JAM Conformance → Fuzzer Target driver (multiple traces)
 *
 * Like jam-conformance-traces-rust.test.ts, discovers all trace directories
 * under the jam-conformance fuzz-reports traces tree and runs each as a chain
 * over the Unix-socket fuzzer protocol. Uses one socket connection for the
 * whole run (same as single-trace driver): PeerInfo once, then for each trace
 * Initialize then ImportBlock for each block. No disconnect between traces so
 * the target's handleInitialize (and resetForNewTrace) runs in the same way as
 * the single-trace driver.
 *
 * Usage (two terminals):
 *   # Terminal 1: start fuzzer target
 *   bun run infra/node/fuzzer-target.ts --socket /tmp/jam_target.sock --spec tiny
 *
 *   # Terminal 2: drive traces (pick one of the following)
 *
 *   # Default: jam-conformance + w3f-jam-conformance trace roots
 *   FUZZER_SOCKET=/tmp/jam_target.sock bun run infra/node/__tests__/traces/jam-conformance-traces-fuzzer-driver.ts
 *
 *   # Override: single custom trace root only
 *   TRACES_DIR=/path/to/traces FUZZER_SOCKET=/tmp/jam_target.sock bun run infra/node/__tests__/traces/jam-conformance-traces-fuzzer-driver.ts
 *
 *   # Run only fuzzy trace (jam-test-vectors/traces/fuzzy). When any optional var is set, only those dirs are used.
 *   TRACES_DIR_FUZZY=1 FUZZER_SOCKET=/tmp/jam_target.sock bun run infra/node/__tests__/traces/jam-conformance-traces-fuzzer-driver.ts
 *
 *   # Run only storage trace (jam-test-vectors/traces/storage_light)
 *   TRACES_DIR_STORAGE=1 FUZZER_SOCKET=/tmp/jam_target.sock bun run infra/node/__tests__/traces/jam-conformance-traces-fuzzer-driver.ts
 *
 *   # Run only preimage trace (jam-test-vectors/traces/preimages_light)
 *   TRACES_DIR_PREIMAGE=1 FUZZER_SOCKET=/tmp/jam_target.sock bun run infra/node/__tests__/traces/jam-conformance-traces-fuzzer-driver.ts
 *
 *   # Run only optional traces (fuzzy + storage + preimage)
 *   TRACES_DIR_FUZZY=1 TRACES_DIR_STORAGE=1 TRACES_DIR_PREIMAGE=1 FUZZER_SOCKET=/tmp/jam_target.sock bun run infra/node/__tests__/traces/jam-conformance-traces-fuzzer-driver.ts
 *
 *   # Run only fuzzy from custom path
 *   TRACES_DIR_FUZZY=/path/to/custom/fuzzy FUZZER_SOCKET=/tmp/jam_target.sock bun run infra/node/__tests__/traces/jam-conformance-traces-fuzzer-driver.ts
 *
 *   # Limit run: first N traces, block range
 *   MAX_TRACES=5 START_BLOCK=1 STOP_BLOCK=10 FUZZER_SOCKET=/tmp/jam_target.sock bun run infra/node/__tests__/traces/jam-conformance-traces-fuzzer-driver.ts
 *
 * Environment:
 *   START_BLOCK     - optional, min block number per trace (default: 1)
 *   STOP_BLOCK      - optional, max block number per trace
 *   MAX_TRACES      - optional, max number of trace dirs to run (default: all)
 *   JAM_CONFORMANCE_VERSION / JAM_VERSION - JAM version (default: 0.7.2)
 *   FUZZER_SOCKET   - Unix socket path (default: /tmp/jam_target.sock)
 *   TRACES_DIR      - optional, override base traces dir (default: search both jam-conformance and w3f-jam-conformance)
 *   TRACES_DIR_FUZZY   - optional; if set, use only fuzzy (and any other set optional dirs), not jam-conformance (path or "1"/"true" for jam-test-vectors/traces/fuzzy)
 *   TRACES_DIR_STORAGE - optional; if set, use only storage (and any other set optional dirs) (path or "1"/"true" for .../storage_light)
 *   TRACES_DIR_PREIMAGE - optional; if set, use only preimage (and any other set optional dirs) (path or "1"/"true" for .../preimages_light)
 */

import { config as loadEnv } from 'dotenv'
loadEnv()

import * as net from 'node:net'
import * as path from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

import { logger } from '@pbnjam/core'
import {
  type BlockTraceTestVector,
  type FuzzMessage,
  FuzzMessageType,
  type FuzzPeerInfo,
  type JamVersion,
} from '@pbnjam/types'

import { ConfigService } from '../../services/config-service'
import {
  buildPeerInfo,
  readFuzzMessage,
  sendFuzzMessage,
} from './fuzzer-transport'
import {
  convertJsonBlockToBlock,
  convertJsonHeaderToBlockHeader,
  getStartBlock,
  getStopBlock,
  parseJamVersion,
} from '../test-utils'

const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

const JAM_CONFORMANCE_VERSION =
  process.env.JAM_CONFORMANCE_VERSION || process.env.JAM_VERSION || '0.7.2'

/** Same trace roots as single-trace driver: jam-conformance and w3f-jam-conformance. */
const TRACES_DIRS = [
  path.join(
    WORKSPACE_ROOT,
    'submodules/jam-conformance/fuzz-reports',
    JAM_CONFORMANCE_VERSION,
    'traces',
  ),
  path.join(
    WORKSPACE_ROOT,
    'submodules/w3f-jam-conformance/fuzz-reports',
    JAM_CONFORMANCE_VERSION,
    'traces',
  ),
]

/** Default paths for optional fuzzy / storage / preimage traces (jam-test-vectors). */
const JAM_TEST_VECTORS_TRACES = path.join(WORKSPACE_ROOT, 'submodules/jam-test-vectors/traces')
const DEFAULT_FUZZY_TRACES_DIR = path.join(JAM_TEST_VECTORS_TRACES, 'fuzzy')
const DEFAULT_STORAGE_TRACES_DIR = path.join(JAM_TEST_VECTORS_TRACES, 'storage_light')
const DEFAULT_PREIMAGE_TRACES_DIR = path.join(JAM_TEST_VECTORS_TRACES, 'preimages_light')

function resolveOptionalTraceDir(envKey: string, defaultPath: string): string | null {
  const v = process.env[envKey]
  if (v === undefined || v === '') return null
  if (v === '1' || v.toLowerCase() === 'true') return defaultPath
  return v
}

function getTraceRoots(): string[] {
  if (process.env.TRACES_DIR) {
    return [process.env.TRACES_DIR]
  }
  const fuzzy = resolveOptionalTraceDir('TRACES_DIR_FUZZY', DEFAULT_FUZZY_TRACES_DIR)
  const storage = resolveOptionalTraceDir('TRACES_DIR_STORAGE', DEFAULT_STORAGE_TRACES_DIR)
  const preimage = resolveOptionalTraceDir('TRACES_DIR_PREIMAGE', DEFAULT_PREIMAGE_TRACES_DIR)
  const hasOptional = fuzzy !== null || storage !== null || preimage !== null
  if (hasOptional) {
    const roots: string[] = []
    if (fuzzy && existsSync(fuzzy)) roots.push(fuzzy)
    if (storage && existsSync(storage)) roots.push(storage)
    if (preimage && existsSync(preimage)) roots.push(preimage)
    return roots
  }
  return TRACES_DIRS.filter((dir) => existsSync(dir))
}

/** Resolve trace ID from absolute trace dir (e.g. 1767895984_8247 or "fuzzy") using the root that contains it. */
function getTraceIdFromDir(traceDir: string, roots: string[]): string {
  const normalizedDir = path.normalize(traceDir)
  for (const root of roots) {
    const normalizedRoot = path.normalize(root)
    if (normalizedDir === normalizedRoot || normalizedDir.startsWith(normalizedRoot + path.sep)) {
      const rel = path.relative(normalizedRoot, normalizedDir)
      return rel === '' ? path.basename(traceDir) : rel
    }
  }
  return path.basename(traceDir)
}

interface TraceResult {
  traceId: string
  success: boolean
  blocksProcessed: number
  error?: string
  failedBlock?: number
}

/** Returns map: trace dir (absolute) -> sorted list of block file names (e.g. 00000023.json). */
function getTraceDirsWithBlockFiles(roots: string[]): Map<string, string[]> {
  const traceFilesByDir = new Map<string, string[]>()

  function searchDirectory(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true })
    const traceFilesInDir: string[] = []

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        searchDirectory(fullPath)
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.json') &&
        entry.name !== 'genesis.json'
      ) {
        traceFilesInDir.push(entry.name)
      }
    }

    if (traceFilesInDir.length > 0) {
      traceFilesInDir.sort((a, b) => {
        const numA = Number.parseInt(a.replace('.json', ''), 10)
        const numB = Number.parseInt(b.replace('.json', ''), 10)
        return numA - numB
      })
      traceFilesByDir.set(dir, traceFilesInDir)
    }
  }

  for (const root of roots) {
    if (existsSync(root)) {
      searchDirectory(root)
    }
  }
  return traceFilesByDir
}

/** Called after each block response; blockNum is 1-based, totalBlocks is total for this trace. */
type OnBlockResponse = (blockNum: number, totalBlocks: number, success: boolean) => void

async function runOneTrace(
  socket: net.Socket,
  traceDir: string,
  traceId: string,
  traceFileNames: string[],
  codecConfig: ConfigService,
  genesisJson: any,
  startBlock: number,
  stopBlock: number | undefined,
  onBlockResponse?: OnBlockResponse,
): Promise<TraceResult> {
  const filtered = traceFileNames.filter((file) => {
    const blockNum = Number.parseInt(file.replace('.json', ''), 10)
    if (Number.isNaN(blockNum)) return false
    if (blockNum < startBlock) return false
    if (stopBlock !== undefined && blockNum > stopBlock) return false
    return true
  })

  if (filtered.length === 0) {
    return {
      traceId,
      success: true,
      blocksProcessed: 0,
    }
  }

  const firstFile = filtered[0]!
  const firstBlockNum = Number.parseInt(firstFile.replace('.json', ''), 10)
  const firstTracePath = path.join(traceDir, firstFile)
  const firstTraceData: BlockTraceTestVector = JSON.parse(
    readFileSync(firstTracePath, 'utf-8'),
  )
  const parentBlockNum = firstBlockNum - 1
  const parentFile = `${String(parentBlockNum).padStart(8, '0')}.json`
  const parentPath = path.join(traceDir, parentFile)
  const hasParentFile = existsSync(parentPath)
  const useInitialStateOnFirstBlock = genesisJson == null && !hasParentFile

  if (!useInitialStateOnFirstBlock) {
    let initHeader: ReturnType<typeof convertJsonHeaderToBlockHeader>
    // Match single-trace driver exactly: genesis path uses genesis.state, parent path uses first block pre_state.
    let initialKeyvals: typeof firstTraceData.pre_state.keyvals
    if (genesisJson != null) {
      initHeader = convertJsonHeaderToBlockHeader(genesisJson.header)
      initialKeyvals = genesisJson.state?.keyvals ?? []
    } else {
      const parentTraceData: BlockTraceTestVector = JSON.parse(
        readFileSync(parentPath, 'utf-8'),
      )
      initHeader = convertJsonBlockToBlock(parentTraceData.block).header
      initialKeyvals = firstTraceData.pre_state?.keyvals ?? []
    }
    await sendFuzzMessage(
      socket,
      {
        type: FuzzMessageType.Initialize,
        payload: {
          header: initHeader,
          keyvals: initialKeyvals,
          ancestry: [],
        },
      },
      codecConfig,
    )
    const initResp = await readFuzzMessage(socket, codecConfig)
    if (initResp.type === FuzzMessageType.Error) {
      return {
        traceId,
        success: false,
        blocksProcessed: 0,
        error: initResp.payload.error,
      }
    }
  }

  let blocksProcessed = 0
  for (let i = 0; i < filtered.length; i++) {
    const traceFile = filtered[i]!
    const blockNum = Number.parseInt(traceFile.replace('.json', ''), 10)
    const traceFilePath = path.join(traceDir, traceFile)
    const traceData: BlockTraceTestVector = JSON.parse(
      readFileSync(traceFilePath, 'utf-8'),
    )
    const block = convertJsonBlockToBlock(traceData.block)
    const isFirstBlock = i === 0
    const withInitialState =
      useInitialStateOnFirstBlock && isFirstBlock
        ? { initial_state: { keyvals: traceData.pre_state?.keyvals ?? [] } }
        : undefined

    // Same as jam-conformance-trace-single-rust.test.ts: when pre_state === post_state the block is expected to fail.
    const expectBlockToFail =
      JSON.stringify(traceData.pre_state) === JSON.stringify(traceData.post_state)

    await sendFuzzMessage(
      socket,
      { type: FuzzMessageType.ImportBlock, payload: { block, ...withInitialState } },
      codecConfig,
    )
    const importResp = await readFuzzMessage(socket, codecConfig)
    const totalBlocks = filtered.length

    if (importResp.type === FuzzMessageType.Error) {
      if (expectBlockToFail) {
        // Block correctly failed to import (expected when pre_state === post_state)
        blocksProcessed++
        onBlockResponse?.(blockNum, totalBlocks, true)
        if (stopBlock !== undefined && blockNum >= stopBlock) break
        continue
      }
      onBlockResponse?.(blockNum, totalBlocks, false)
      return {
        traceId,
        success: false,
        blocksProcessed,
        error: importResp.payload.error,
        failedBlock: blockNum,
      }
    }
    if (importResp.type === FuzzMessageType.StateRoot) {
      if (expectBlockToFail) {
        onBlockResponse?.(blockNum, totalBlocks, false)
        return {
          traceId,
          success: false,
          blocksProcessed: blocksProcessed + 1,
          error: `Block ${blockNum} imported but was expected to fail (pre_state === post_state)`,
          failedBlock: blockNum,
        }
      }
      const expected = traceData.post_state?.state_root?.toLowerCase()
      const actual = importResp.payload.state_root.toLowerCase()
      if (expected && actual !== expected) {
        onBlockResponse?.(blockNum, totalBlocks, false)
        return {
          traceId,
          success: false,
          blocksProcessed: blocksProcessed + 1,
          error: `State root mismatch at block ${blockNum}: expected ${expected}, got ${actual}`,
          failedBlock: blockNum,
        }
      }
    }

    blocksProcessed++
    onBlockResponse?.(blockNum, totalBlocks, true)
    if (stopBlock !== undefined && blockNum >= stopBlock) break
  }

  return { traceId, success: true, blocksProcessed }
}

async function main() {
  logger.init()

  const startBlock = getStartBlock()
  const stopBlock = getStopBlock()
  const maxTraces = process.env.MAX_TRACES
    ? Number.parseInt(process.env.MAX_TRACES, 10)
    : undefined

  const traceRoots = getTraceRoots()
  if (traceRoots.length === 0) {
    console.error(
      `No trace roots found. Set TRACES_DIR or ensure one of exists: ${TRACES_DIRS.join(', ')}`,
    )
    process.exit(1)
  }

  const traceDirs = getTraceDirsWithBlockFiles(traceRoots)
  if (traceDirs.size === 0) {
    console.error(`No trace directories found under: ${traceRoots.join(', ')}`)
    process.exit(1)
  }

  const dirsArray = Array.from(traceDirs.entries())
  const toRun = maxTraces ? dirsArray.slice(0, maxTraces) : dirsArray

  console.log(
    `📦 Running ${toRun.length} trace(s) (from ${traceDirs.size} total), START_BLOCK=${startBlock}, STOP_BLOCK=${stopBlock ?? 'none'}`,
  )
  console.log(`📁 Trace roots: ${traceRoots.join(', ')}`)

  const jamVersion = parseJamVersion(JAM_CONFORMANCE_VERSION)
  const codecConfig = new ConfigService('tiny')
  codecConfig.jamVersion = jamVersion

  const socketPath =
    process.env.FUZZER_SOCKET ||
    process.env.SOCKET ||
    '/tmp/jam_target.sock'
  console.log(`🔌 Fuzzer target: ${socketPath}`)

  const results: TraceResult[] = []
  const peerInfo = buildPeerInfo(jamVersion, 'pbnj-traces-fuzzer-driver')

  // One connection for all traces (same as single-trace driver): connect once,
  // PeerInfo once, then for each trace Initialize + ImportBlocks. No disconnect
  // between traces so the target sees the same request flow as the single-trace driver.
  const socket = net.createConnection(socketPath)
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve())
    socket.once('error', (err) => reject(err))
  })

  try {
    await sendFuzzMessage(
      socket,
      { type: FuzzMessageType.PeerInfo, payload: peerInfo },
      codecConfig,
    )
    const peerResp = await readFuzzMessage(socket, codecConfig)
    if (peerResp.type === FuzzMessageType.PeerInfo) {
      console.log(
        `🤝 PeerInfo: ${peerResp.payload.app_name} JAM ${peerResp.payload.jam_version.major}.${peerResp.payload.jam_version.minor}.${peerResp.payload.jam_version.patch}`,
      )
    }

    for (const [traceDir, traceFileNames] of toRun) {
      const traceId = getTraceIdFromDir(traceDir, traceRoots)
      const genesisPath = path.join(traceDir, 'genesis.json')
      const genesisJson: any = existsSync(genesisPath)
        ? JSON.parse(readFileSync(genesisPath, 'utf-8'))
        : null

      process.stdout.write(`  ${traceId} ... `)
      const result = await runOneTrace(
        socket,
        traceDir,
        traceId,
        traceFileNames,
        codecConfig,
        genesisJson,
        startBlock,
        stopBlock,
        (blockNum, totalBlocks, success) => {
          process.stdout.write(
            `\r  ${traceId} ... ${blockNum}/${totalBlocks} blocks${success ? ' ✓' : ' ✗'}   `,
          )
        },
      )
      results.push(result)
      if (result.success) {
        console.log(`\r  ${traceId} ... ✅ ${result.blocksProcessed} blocks   `)
      } else {
        console.log(`\r  ${traceId} ... ❌ ${result.error ?? 'unknown'}   `)
      }
    }
  } finally {
    socket.end()
  }

  const passed = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  console.log('\n' + '='.repeat(60))
  console.log('📊 TRACES FUZZER DRIVER – SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Passed: ${passed.length}`)
  console.log(`❌ Failed: ${failed.length}`)
  console.log(`📋 Total:  ${results.length}`)

  if (failed.length > 0) {
    console.log('\n❌ Failed traces:')
    for (const r of failed) {
      console.log(`   • ${r.traceId}${r.failedBlock != null ? ` (block ${r.failedBlock})` : ''}`)
      if (r.error) console.log(`     ${r.error.slice(0, 120)}${r.error.length > 120 ? '...' : ''}`)
    }
  }
  console.log('='.repeat(60))

  process.exit(failed.length > 0 ? 1 : 0)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
