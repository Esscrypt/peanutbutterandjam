#!/usr/bin/env bun

/**
 * JAM Conformance → Fuzzer Target driver
 *
 * This script mirrors the trace selection logic from
 * `jam-conformance-trace-single-rust.test.ts`, but instead of importing
 * blocks directly via services, it speaks the Unix-socket fuzzer protocol
 * expected by `infra/node/fuzzer-target.ts`.
 *
 * Usage (two terminals):
 *   # Terminal 1: start fuzzer target
 *   bun run infra/node/fuzzer-target.ts --socket /tmp/jam_target.sock --spec tiny
 *
 *   # Terminal 2: drive a single trace over the socket
 *   TRACE_ID=1766243176 FUZZER_SOCKET=/tmp/jam_target.sock \
 *     bun run infra/node/__tests__/traces/jam-conformance-trace-fuzzer-driver.ts
 *
 * Environment:
 *   TRACE_ID        - required, trace ID directory under fuzz-reports
 *   START_BLOCK     - optional, like existing trace tests (default: 1)
 *   STOP_BLOCK      - optional, stop after this block number
 *   JAM_CONFORMANCE_VERSION / JAM_VERSION / GP_VERSION - JAM version (default 0.7.2)
 *   FUZZER_SOCKET   - Unix socket path (default: /tmp/jam_target.sock)
 *
 * Difference from jam-conformance-trace-single-rust.test.ts:
 *   The direct test runs in-process: for each block it sets state to pre_state then
 *   calls chainManagerService.importBlock(block), so the block transition runs and
 *   state becomes post_state. The fuzzer target instead expects one Initialize (state +
 *   genesis header) then a sequence of ImportBlocks. We send Initialize once with the
 *   *parent* of the first block as genesis and the first block's pre_state, so the
 *   first ImportBlock actually executes. Sending Initialize per block with that block's
 *   header would register the block as genesis and make ImportBlock(block) a no-op
 *   ("Block already imported"), so the state would never advance.
 */

import { config as loadEnv } from 'dotenv'
loadEnv()

import * as net from 'node:net'
import * as path from 'node:path'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'

import { decodeFuzzMessage, encodeFuzzMessage } from '@pbnjam/codec'
import { type Hex, logger } from '@pbnjam/core'
import {
  type BlockTraceTestVector,
  type FuzzMessage,
  FuzzMessageType,
  type FuzzPeerInfo,
  type Initialize,
  type JamVersion,
} from '@pbnjam/types'

import { ConfigService } from '../../services/config-service'
import {
  convertJsonBlockToBlock,
  convertJsonHeaderToBlockHeader,
  getStartBlock,
  getStopBlock,
  parseJamVersion,
} from '../test-utils'

// Workspace root (relative to this file)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

// Same traces directories as jam-conformance-trace-single-rust.test.ts
const JAM_CONFORMANCE_VERSION =
  process.env.JAM_CONFORMANCE_VERSION || process.env.JAM_VERSION || '0.7.2'

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

function getTraceId(): string | null {
  const envTraceId = process.env.TRACE_ID
  if (envTraceId) {
    return envTraceId
  }

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

// Minimal length-prefixed transport helpers (mirror fuzzer-target)
function sendRawMessage(socket: net.Socket, message: Uint8Array): void {
  if (socket.destroyed || !socket.writable) {
    console.warn('Cannot send message: socket is destroyed or not writable')
    return
  }
  const lengthBytes = Buffer.alloc(4)
  lengthBytes.writeUInt32LE(message.length, 0)
  socket.write(Buffer.concat([lengthBytes, Buffer.from(message)]))
}

function readRawMessage(socket: net.Socket): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let lengthBytes = Buffer.alloc(0)
    let expectedLength = 0

    const cleanup = () => {
      socket.removeListener('data', onData)
      socket.removeListener('error', onError)
      socket.removeListener('close', onClose)
      socket.removeListener('end', onClose)
    }

    const onData = (data: Buffer) => {
      lengthBytes = Buffer.concat([lengthBytes, data])

      if (lengthBytes.length < 4) {
        return
      }

      if (expectedLength === 0) {
        expectedLength = lengthBytes.readUInt32LE(0)
        lengthBytes = lengthBytes.subarray(4)
      }

      if (lengthBytes.length >= expectedLength) {
        const payload = new Uint8Array(lengthBytes.subarray(0, expectedLength))
        cleanup()
        resolve(payload)
      }
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const onClose = () => {
      cleanup()
      reject(new Error('Socket closed before message was fully received'))
    }

    socket.on('data', onData)
    socket.on('error', onError)
    socket.on('close', onClose)
    socket.on('end', onClose)
  })
}

async function sendFuzzMessage(
  socket: net.Socket,
  msg: FuzzMessage,
  codecConfig: ConfigService,
): Promise<void> {
  const encoded = encodeFuzzMessage(msg, codecConfig)
  sendRawMessage(socket, encoded)
}

async function readFuzzMessage(
  socket: net.Socket,
  codecConfig: ConfigService,
): Promise<FuzzMessage> {
  const data = await readRawMessage(socket)
  return decodeFuzzMessage(data, codecConfig)
}

function buildPeerInfo(jamVersion: JamVersion): FuzzPeerInfo {
  return {
    fuzz_version: 1,
    fuzz_features: 0,
    jam_version: jamVersion,
    app_version: { major: 0, minor: 0, patch: 1 },
    app_name: 'pbnj-trace-fuzzer-driver',
  }
}

function logStateRootResponse(
  blockNum: number,
  response: FuzzMessage,
  expectedStateRoot?: Hex,
): void {
  if (response.type === FuzzMessageType.StateRoot) {
    const actual = response.payload.state_root.toLowerCase()
    if (expectedStateRoot) {
      const expected = expectedStateRoot.toLowerCase()
      if (actual === expected) {
        console.log(
          `✅ Block ${blockNum}: state root matches expected (${actual})`,
        )
      } else {
        console.error(
          `❌ Block ${blockNum}: state root mismatch\n  Expected: ${expected}\n  Got:      ${actual}`,
        )
      }
    } else {
      console.log(`ℹ️  Block ${blockNum}: state root = ${actual}`)
    }
  } else if (response.type === FuzzMessageType.Error) {
    console.error(`❌ Block ${blockNum}: Error from fuzzer target:`)
    console.error(`   ${response.payload.error}`)
  } else {
    console.warn(
      `⚠️  Block ${blockNum}: Unexpected response type ${response.type}`,
    )
  }
}

async function main() {
  logger.init()

  const traceId = getTraceId()
  if (!traceId) {
    console.error(
      'TRACE_ID not set. Example: TRACE_ID=1766243176 bun run infra/node/__tests__/traces/jam-conformance-trace-fuzzer-driver.ts',
    )
    process.exit(1)
  }

  // Locate trace directory (same as jam-conformance-trace-single-rust.test.ts)
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
    console.error(
      `Trace directory not found for TRACE_ID=${traceId} in any of:\n  ${TRACES_DIRS.join(
        '\n  ',
      )}`,
    )
    process.exit(1)
  }

  const allFiles = readdirSync(traceDir)
  const traceFiles = allFiles
    .filter((file) => file.endsWith('.json') && file !== 'genesis.json')
    .sort((a, b) => {
      const numA = Number.parseInt(a.replace('.json', ''), 10)
      const numB = Number.parseInt(b.replace('.json', ''), 10)
      return numA - numB
    })

  if (traceFiles.length === 0) {
    console.error(`No trace JSON files found in ${traceDir}`)
    process.exit(1)
  }

  const startBlock = getStartBlock()
  const stopBlock = getStopBlock()

  const filteredTraceFiles = traceFiles.filter((file) => {
    const blockNum = Number.parseInt(file.replace('.json', ''), 10)
    if (Number.isNaN(blockNum)) return false
    if (blockNum < startBlock) return false
    if (stopBlock !== undefined && blockNum > stopBlock) return false
    return true
  })

  if (filteredTraceFiles.length === 0) {
    console.error(
      `No trace files found in range [${startBlock}, ${stopBlock ?? 'end'}]`,
    )
    process.exit(1)
  }

  console.log(
    `📦 Driving ${filteredTraceFiles.length} blocks from trace ${traceId} (filtered from ${traceFiles.length} total)`,
  )

  // When genesis.json is present in the trace folder, use it for Initialize; otherwise use first block's pre_state.
  const genesisJsonPath = path.join(traceDir, 'genesis.json')
  const hasGenesisInFolder = existsSync(genesisJsonPath)
  const genesisJson: any | null = hasGenesisInFolder
    ? JSON.parse(readFileSync(genesisJsonPath, 'utf-8'))
    : null

  // Local config for codec (must match PeerInfo.jam_version)
  const jamVersion = parseJamVersion(JAM_CONFORMANCE_VERSION)
  const codecConfig = new ConfigService('tiny')
  codecConfig.jamVersion = jamVersion

  // Connect to fuzzer target Unix socket
  const socketPath =
    process.env.FUZZER_SOCKET ||
    process.env.SOCKET ||
    '/tmp/jam_target.sock'
  console.log(`🔌 Connecting to fuzzer target at ${socketPath}...`)

  const socket = net.createConnection(socketPath)

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve())
    socket.once('error', (err) => reject(err))
  })

  console.log('✅ Connected to fuzzer target')

  try {
    // 1) Send PeerInfo
    const peerInfo: FuzzPeerInfo = buildPeerInfo(jamVersion)
    const peerInfoMsg: FuzzMessage = {
      type: FuzzMessageType.PeerInfo,
      payload: peerInfo,
    }
    await sendFuzzMessage(socket, peerInfoMsg, codecConfig)

    // Read PeerInfo response from target (optional, for logging)
    const response1 = await readFuzzMessage(socket, codecConfig)
    if (response1.type === FuzzMessageType.PeerInfo) {
      console.log(
        `🤝 Received PeerInfo from target: ${response1.payload.app_name} v${response1.payload.app_version.major}.${response1.payload.app_version.minor}.${response1.payload.app_version.patch} (JAM ${response1.payload.jam_version.major}.${response1.payload.jam_version.minor}.${response1.payload.jam_version.patch})`,
      )
    } else {
      console.warn(
        `⚠️  Expected PeerInfo response from target, got ${response1.type}`,
      )
    }

    // 2) Initialize or use initial_state on first ImportBlock. If genesis.json: Initialize(genesis). If parent file: Initialize(parent, first pre_state). Else: no Initialize; first ImportBlock carries initial_state (target does implicit init).
    const firstTraceFile = filteredTraceFiles[0]!
    const firstBlockNum = Number.parseInt(firstTraceFile.replace('.json', ''), 10)
    const firstTracePath = path.join(traceDir, firstTraceFile)
    const firstTraceData: BlockTraceTestVector = JSON.parse(
      readFileSync(firstTracePath, 'utf-8'),
    )
    const parentBlockNum = firstBlockNum - 1
    const parentTraceFile = `${String(parentBlockNum).padStart(8, '0')}.json`
    const parentTracePath = path.join(traceDir, parentTraceFile)
    const hasParentFile = existsSync(parentTracePath)

    const useInitialStateOnFirstBlock = genesisJson == null && !hasParentFile

    if (!useInitialStateOnFirstBlock) {
      let initHeader: ReturnType<typeof convertJsonHeaderToBlockHeader>
      let initialKeyvals: typeof firstTraceData.pre_state.keyvals
      if (genesisJson != null) {
        initHeader = convertJsonHeaderToBlockHeader(genesisJson.header)
        initialKeyvals = genesisJson.state?.keyvals ?? []
      } else {
        const parentTraceData: BlockTraceTestVector = JSON.parse(
          readFileSync(parentTracePath, 'utf-8'),
        )
        initHeader = convertJsonBlockToBlock(parentTraceData.block).header
        initialKeyvals = firstTraceData.pre_state?.keyvals ?? []
      }
      const initPayload: Initialize = {
        header: initHeader,
        keyvals: initialKeyvals,
        ancestry: [],
      }
      await sendFuzzMessage(socket, { type: FuzzMessageType.Initialize, payload: initPayload }, codecConfig)
      const initResp = await readFuzzMessage(socket, codecConfig)
      if (initResp.type === FuzzMessageType.Error) {
        console.error(`❌ Initialize failed: ${initResp.payload.error}`)
        return
      }
      if (initResp.type === FuzzMessageType.StateRoot) {
        console.log(`✅ Initialize state root: ${initResp.payload.state_root.toLowerCase()}`)
      }
    } else {
      console.log(`📦 No genesis.json and no ${parentTraceFile}; first ImportBlock will carry initial_state (implicit init).`)
    }

    for (let i = 0; i < filteredTraceFiles.length; i++) {
      const traceFile = filteredTraceFiles[i]!
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

      console.log(`\n📡 ImportBlock ${blockNum} from ${traceFile}${withInitialState ? ' (with initial_state)' : ''}`)

      await sendFuzzMessage(
        socket,
        { type: FuzzMessageType.ImportBlock, payload: { block, ...withInitialState } },
        codecConfig,
      )
      const importResp = await readFuzzMessage(socket, codecConfig)
      logStateRootResponse(blockNum, importResp, traceData.post_state?.state_root)

      if (stopBlock !== undefined && blockNum >= stopBlock) {
        console.log(
          `\n🛑 Stopping after block ${blockNum} (STOP_BLOCK=${stopBlock})`,
        )
        break
      }
    }
  } finally {
    socket.end()
  }
}

// Run only when executed directly (not imported)
if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error in jam-conformance-trace-fuzzer-driver:', err)
    process.exit(1)
  })
}

