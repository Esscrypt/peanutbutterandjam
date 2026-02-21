#!/usr/bin/env bun

/**
 * W3F Conformance Trace Stress Driver
 *
 * Loads w3f-jam-conformance traces and drives them into a running fuzzer target
 * via the JAM fuzz protocol (Unix socket), cycling through all available trace
 * directories until a configurable total-block limit is reached.
 *
 * Additional instrumentation:
 *   • Warns when a single ImportBlock round-trip takes > 6 seconds.
 *   • Periodically logs RSS memory of the driver process (and optionally the
 *     fuzzer target process when FUZZER_PID is supplied).
 *
 * Usage (two terminals):
 *   # Terminal 1 – start fuzzer target
 *   bun run infra/node/fuzzer-target.ts --socket /tmp/jam_target.sock --spec tiny
 *
 *   # Terminal 2 – run this driver
 *   NUM_BLOCKS=100000 FUZZER_SOCKET=/tmp/jam_target.sock \
 *     bun run infra/node/__tests__/block-authoring-fuzzer-driver.ts
 *
 * Environment:
 *   NUM_BLOCKS        - total blocks to process across all traces (default: 100 000)
 *   FUZZER_SOCKET     - Unix socket path (default: /tmp/jam_target.sock)
 *   JAM_VERSION / JAM_CONFORMANCE_VERSION - protocol version (default: 0.7.2)
 *   SLOW_BLOCK_MS     - warn threshold in ms for a single block response (default: 6000)
 *   REPORT_INTERVAL   - log progress every N blocks (default: 100)
 *   MEM_INTERVAL      - log memory every N blocks (default: 1000)
 *   FUZZER_PID        - OS PID of the fuzzer-target process for RSS monitoring (optional)
 *   STOP_ON_ERROR     - set to "false" to continue past failed traces (default: stop)
 */

import { config as loadEnv } from 'dotenv'
loadEnv()

import * as net from 'node:net'
import * as path from 'node:path'
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

import { logger } from '@pbnjam/core'
import type { BlockTraceTestVector, FuzzMessage, JamVersion } from '@pbnjam/types'
import { FuzzMessageType } from '@pbnjam/types'

import { ConfigService } from '../services/config-service'
import {
  buildPeerInfo,
  readFuzzMessage,
  sendFuzzMessage,
} from './traces/fuzzer-transport'
import {
  convertJsonBlockToBlock,
  convertJsonHeaderToBlockHeader,
  parseJamVersion,
} from './test-utils'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT = path.join(__dirname, '../../../')

const JAM_CONFORMANCE_VERSION =
  process.env.JAM_CONFORMANCE_VERSION ||
  process.env.JAM_VERSION ||
  '0.7.2'

const W3F_TRACES_DIR = path.join(
  WORKSPACE_ROOT,
  'submodules/jam-conformance/fuzz-reports',
  JAM_CONFORMANCE_VERSION,
  'traces',
)

const NUM_BLOCKS = process.env.NUM_BLOCKS
  ? Number.parseInt(process.env.NUM_BLOCKS, 10)
  : 100_000
const SOCKET_PATH =
  process.env.FUZZER_SOCKET || process.env.SOCKET || '/tmp/jam_target.sock'
const SLOW_BLOCK_MS = process.env.SLOW_BLOCK_MS
  ? Number.parseInt(process.env.SLOW_BLOCK_MS, 10)
  : 6_000
const REPORT_INTERVAL = process.env.REPORT_INTERVAL
  ? Number.parseInt(process.env.REPORT_INTERVAL, 10)
  : 100
const MEM_INTERVAL = process.env.MEM_INTERVAL
  ? Number.parseInt(process.env.MEM_INTERVAL, 10)
  : 1_000
const FUZZER_PID = process.env.FUZZER_PID
  ? Number.parseInt(process.env.FUZZER_PID, 10)
  : null
const STOP_ON_ERROR = process.env.STOP_ON_ERROR !== 'false'

// ---------------------------------------------------------------------------
// Memory helpers
// ---------------------------------------------------------------------------

function rssBytes(pid: number): number | null {
  try {
    // `ps -o rss=` returns RSS in KiB on Linux and macOS
    const out = execSync(`ps -o rss= -p ${pid}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    const kb = Number.parseInt(out, 10)
    return Number.isNaN(kb) ? null : kb * 1024
  } catch {
    return null
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function logMemory(label: string): void {
  const driverRss = process.memoryUsage().rss
  let msg = `  🧠 Memory [${label}] driver=${formatBytes(driverRss)}`

  if (FUZZER_PID !== null) {
    const fuzzerRss = rssBytes(FUZZER_PID)
    if (fuzzerRss !== null) {
      msg += `  fuzzer-target(pid ${FUZZER_PID})=${formatBytes(fuzzerRss)}`
    } else {
      msg += `  fuzzer-target(pid ${FUZZER_PID})=<unavailable>`
    }
  }

  console.log(msg)
}

// ---------------------------------------------------------------------------
// Trace discovery (mirrors jam-conformance-traces-fuzzer-driver.ts)
// ---------------------------------------------------------------------------

/** Returns map: absolute trace dir → sorted block file names (*.json excluding genesis.json) */
function discoverTraces(rootDir: string): Map<string, string[]> {
  const result = new Map<string, string[]>()

  function walk(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true })
    const blockFiles: string[] = []

    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.json') &&
        entry.name !== 'genesis.json'
      ) {
        blockFiles.push(entry.name)
      }
    }

    if (blockFiles.length > 0) {
      blockFiles.sort((a, b) => {
        const na = Number.parseInt(a.replace('.json', ''), 10)
        const nb = Number.parseInt(b.replace('.json', ''), 10)
        return na - nb
      })
      result.set(dir, blockFiles)
    }
  }

  if (existsSync(rootDir)) walk(rootDir)
  return result
}

// ---------------------------------------------------------------------------
// Per-trace runner (mirrors runOneTrace from the multi-trace driver)
// ---------------------------------------------------------------------------

interface TraceResult {
  traceId: string
  blocksProcessed: number
  success: boolean
  error?: string
  failedBlock?: number
}

async function runOneTrace(
  socket: net.Socket,
  traceDir: string,
  traceId: string,
  traceFileNames: string[],
  codecConfig: ConfigService,
  globalCounter: { total: number; limit: number },
  onBlock: (blockNum: number, elapsedMs: number, success: boolean) => void,
): Promise<TraceResult> {
  // Identify the first block and parent file
  const firstFile = traceFileNames[0]!
  const firstBlockNum = Number.parseInt(firstFile.replace('.json', ''), 10)
  const firstTracePath = path.join(traceDir, firstFile)
  const firstTraceData: BlockTraceTestVector = JSON.parse(
    readFileSync(firstTracePath, 'utf-8'),
  )

  const genesisPath = path.join(traceDir, 'genesis.json')
  const genesisJson: any = existsSync(genesisPath)
    ? JSON.parse(readFileSync(genesisPath, 'utf-8'))
    : null

  const parentFile = `${String(firstBlockNum - 1).padStart(8, '0')}.json`
  const parentPath = path.join(traceDir, parentFile)
  const hasParentFile = existsSync(parentPath)

  const useInitialStateOnFirstBlock = genesisJson == null && !hasParentFile

  // --- Initialize ---
  if (!useInitialStateOnFirstBlock) {
    let initHeader: ReturnType<typeof convertJsonHeaderToBlockHeader>
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
        payload: { header: initHeader, keyvals: initialKeyvals, ancestry: [] },
      },
      codecConfig,
    )
    const initResp = await readFuzzMessage(socket, codecConfig)
    if (initResp.type === FuzzMessageType.Error) {
      return {
        traceId,
        blocksProcessed: 0,
        success: false,
        error: `Initialize failed: ${initResp.payload.error}`,
      }
    }
  }

  // --- ImportBlock loop ---
  let blocksProcessed = 0

  for (let i = 0; i < traceFileNames.length; i++) {
    if (globalCounter.total >= globalCounter.limit) break

    const traceFile = traceFileNames[i]!
    const blockNum = Number.parseInt(traceFile.replace('.json', ''), 10)
    const traceData: BlockTraceTestVector = JSON.parse(
      readFileSync(path.join(traceDir, traceFile), 'utf-8'),
    )
    const block = convertJsonBlockToBlock(traceData.block)
    const isFirstBlock = i === 0
    const withInitialState =
      useInitialStateOnFirstBlock && isFirstBlock
        ? { initial_state: { keyvals: traceData.pre_state?.keyvals ?? [] } }
        : undefined

    const expectToFail =
      JSON.stringify(traceData.pre_state) === JSON.stringify(traceData.post_state)

    const t0 = Date.now()
    await sendFuzzMessage(
      socket,
      { type: FuzzMessageType.ImportBlock, payload: { block, ...withInitialState } },
      codecConfig,
    )
    const resp = await readFuzzMessage(socket, codecConfig)
    const elapsedMs = Date.now() - t0

    globalCounter.total++

    if (elapsedMs > SLOW_BLOCK_MS) {
      console.warn(
        `\n  ⚠️  Slow block: trace=${traceId} block=${blockNum} took ${(elapsedMs / 1000).toFixed(2)}s (limit ${SLOW_BLOCK_MS / 1000}s)`,
      )
    }

    if (resp.type === FuzzMessageType.Error) {
      if (expectToFail) {
        blocksProcessed++
        onBlock(blockNum, elapsedMs, true)
        continue
      }
      onBlock(blockNum, elapsedMs, false)
      return {
        traceId,
        blocksProcessed,
        success: false,
        error: resp.payload.error,
        failedBlock: blockNum,
      }
    }

    if (resp.type === FuzzMessageType.StateRoot && expectToFail) {
      onBlock(blockNum, elapsedMs, false)
      return {
        traceId,
        blocksProcessed: blocksProcessed + 1,
        success: false,
        error: `Block ${blockNum} imported but was expected to fail`,
        failedBlock: blockNum,
      }
    }

    if (resp.type === FuzzMessageType.StateRoot) {
      const expected = traceData.post_state?.state_root?.toLowerCase()
      const actual = resp.payload.state_root.toLowerCase()
      if (expected && actual !== expected) {
        onBlock(blockNum, elapsedMs, false)
        return {
          traceId,
          blocksProcessed: blocksProcessed + 1,
          success: false,
          error: `State root mismatch at block ${blockNum}: expected ${expected}, got ${actual}`,
          failedBlock: blockNum,
        }
      }
    }

    blocksProcessed++
    onBlock(blockNum, elapsedMs, true)
  }

  return { traceId, blocksProcessed, success: true }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logger.init()

  const tracesRoot = W3F_TRACES_DIR

  console.log('🔧 W3F Conformance Trace Stress Driver')
  console.log(`   Traces:        submodules/jam-conformance/fuzz-reports/${JAM_CONFORMANCE_VERSION}/traces`)
  console.log(`   Block limit:   ${NUM_BLOCKS}`)
  console.log(`   Socket:        ${SOCKET_PATH}`)
  console.log(`   Slow threshold: ${SLOW_BLOCK_MS}ms`)
  console.log(
    `   Memory log:    every ${MEM_INTERVAL} blocks${FUZZER_PID ? ` (fuzzer PID ${FUZZER_PID})` : ' (driver only)'}`,
  )

  if (!existsSync(tracesRoot)) {
    console.error(`Traces root not found: ${tracesRoot}`)
    process.exit(1)
  }

  const allTraces = discoverTraces(tracesRoot)
  if (allTraces.size === 0) {
    console.error(`No trace directories found under ${tracesRoot}`)
    process.exit(1)
  }

  const dirsArray = Array.from(allTraces.entries())
  console.log(`   Trace dirs:    ${dirsArray.length}`)

  // --- Connect ---
  console.log(`\n🔌 Connecting to ${SOCKET_PATH} …`)
  const socket = net.createConnection(SOCKET_PATH)
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve())
    socket.once('error', (err) => reject(err))
  })
  console.log('✅ Connected\n')

  const jamVersion: JamVersion = parseJamVersion(JAM_CONFORMANCE_VERSION)
  const codecConfig = new ConfigService('tiny')
  codecConfig.jamVersion = jamVersion

  // --- PeerInfo handshake ---
  await sendFuzzMessage(
    socket,
    { type: FuzzMessageType.PeerInfo, payload: buildPeerInfo(jamVersion, 'pbnj-w3f-stress-driver') },
    codecConfig,
  )
  const peerResp = await readFuzzMessage(socket, codecConfig)
  if (peerResp.type === FuzzMessageType.PeerInfo) {
    const v = peerResp.payload.jam_version
    console.log(
      `🤝 PeerInfo: ${peerResp.payload.app_name} JAM ${v.major}.${v.minor}.${v.patch}`,
    )
  }

  // --- Drive traces ---
  const globalCounter = { total: 0, limit: NUM_BLOCKS }
  const results: TraceResult[] = []
  const startTime = Date.now()
  let lastMemBlock = 0
  let slowBlocks = 0

  logMemory('start')

  let traceIndex = 0
  outer: while (globalCounter.total < NUM_BLOCKS) {
    // Cycle through traces if we need more blocks than one pass provides
    const [traceDir, traceFileNames] = dirsArray[traceIndex % dirsArray.length]!
    traceIndex++

    const traceId = path.relative(tracesRoot, traceDir) || path.basename(traceDir)

    process.stdout.write(`  trace ${traceId} … `)

    const result = await runOneTrace(
      socket,
      traceDir,
      traceId,
      traceFileNames,
      codecConfig,
      globalCounter,
      (blockNum, elapsedMs, success) => {
        const total = globalCounter.total

        if (elapsedMs > SLOW_BLOCK_MS) slowBlocks++

        // Progress line
        if (total % REPORT_INTERVAL === 0) {
          const elapsed = (Date.now() - startTime) / 1000
          const rate = elapsed > 0 ? total / elapsed : 0
          const eta = rate > 0 ? (NUM_BLOCKS - total) / rate : 0
          process.stdout.write(
            `\r  trace ${traceId} blk ${blockNum} | total ${total}/${NUM_BLOCKS} | ${rate.toFixed(0)} blk/s | ETA ${eta.toFixed(0)}s   `,
          )
        }

        // Memory log
        if (total - lastMemBlock >= MEM_INTERVAL) {
          lastMemBlock = total
          process.stdout.write('\n')
          logMemory(`block ${total}`)
        }
      },
    )

    results.push(result)

    if (result.success) {
      process.stdout.write(
        `\r  trace ${traceId} … ✅ ${result.blocksProcessed} blocks   \n`,
      )
    } else {
      process.stdout.write(
        `\r  trace ${traceId} … ❌ ${result.error ?? 'unknown'}   \n`,
      )
      if (STOP_ON_ERROR) {
        console.error(`\n🛑 Stopping on first failed trace (STOP_ON_ERROR=true).`)
        break outer
      }
    }
  }

  socket.end()

  // --- Final memory snapshot ---
  console.log()
  logMemory('end')

  // --- Summary ---
  const elapsed = (Date.now() - startTime) / 1000
  const passed = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  console.log('\n' + '='.repeat(60))
  console.log('📊 W3F STRESS DRIVER – SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Passed traces:  ${passed.length}`)
  console.log(`❌ Failed traces:  ${failed.length}`)
  console.log(`📋 Total traces:   ${results.length}`)
  console.log(`🔢 Total blocks:   ${globalCounter.total}`)
  console.log(`⚠️  Slow blocks:   ${slowBlocks} (>${SLOW_BLOCK_MS}ms)`)
  console.log(`⏱️  Time:           ${elapsed.toFixed(1)}s`)
  if (elapsed > 0) {
    console.log(`🚀 Rate:           ${(globalCounter.total / elapsed).toFixed(0)} blk/s`)
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed traces:')
    for (const r of failed) {
      const loc = r.failedBlock != null ? ` (block ${r.failedBlock})` : ''
      console.log(`   • ${r.traceId}${loc}`)
      if (r.error) {
        const snippet = r.error.length > 120 ? `${r.error.slice(0, 120)}…` : r.error
        console.log(`     ${snippet}`)
      }
    }
  }

  console.log('='.repeat(60))
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
