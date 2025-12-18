#!/usr/bin/env bun

/**
 * JAM Fuzzer Target Implementation
 *
 * This script implements a fuzzer target that listens on a Unix domain socket
 * and handles fuzzer protocol messages according to the JAM Conformance Testing Protocol.
 *
 * Reference: https://github.com/gavofyork/graypaper/blob/main/fuzz/fuzz-v1.asn
 *
 * Usage:
 *   bun run fuzzer-target.ts --socket /tmp/jam_target.sock --spec tiny
 */

import { unlinkSync } from 'node:fs'
import { Server as UnixServer, type Socket as UnixSocket } from 'node:net'
import * as path from 'node:path'
import {
  RingVRFProverWasm,
  RingVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import { decodeFuzzMessage, encodeFuzzMessage } from '@pbnjam/codec'
import { EventBusService, type Hex, logger } from '@pbnjam/core'
import {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'
import {
  DEFAULT_JAM_VERSION,
  type FuzzMessage,
  FuzzMessageType,
  type FuzzPeerInfo,
  type GetState,
  type ImportBlock,
  type Initialize,
  type JamVersion,
  safeResult,
} from '@pbnjam/types'
import { AccumulationService } from './services/accumulation-service'
import { AssuranceService } from './services/assurance-service'
import { AuthPoolService } from './services/auth-pool-service'
import { AuthQueueService } from './services/auth-queue-service'
import { BlockImporterService } from './services/block-importer-service'
import { ClockService } from './services/clock-service'
import { ConfigService } from './services/config-service'
import { DisputesService } from './services/disputes-service'
import { EntropyService } from './services/entropy'
import { NodeGenesisManager } from './services/genesis-manager'
import { GuarantorService } from './services/guarantor-service'
import { PrivilegesService } from './services/privileges-service'
import { ReadyService } from './services/ready-service'
import { RecentHistoryService } from './services/recent-history-service'
import { SealKeyService } from './services/seal-key'
import { ServiceAccountService } from './services/service-account-service'
import { StateService } from './services/state-service'
import { StatisticsService } from './services/statistics-service'
import { TicketService } from './services/ticket-service'
import { ValidatorSetManager } from './services/validator-set'
import { WorkReportService } from './services/work-report-service'

const WORKSPACE_ROOT = path.join(__dirname, '../../')

// Parse command line arguments
const args = process.argv.slice(2)
let socketPath = '/tmp/jam_target.sock'
let spec = 'tiny'

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--socket' && i + 1 < args.length) {
    socketPath = args[i + 1]
    i++
  } else if (args[i] === '--spec' && i + 1 < args.length) {
    spec = args[i + 1]
    i++
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
JAM Fuzzer Target

Usage:
  bun run fuzzer-target.ts [options]

Options:
  --socket <path>    Unix socket path (default: /tmp/jam_target.sock)
  --spec <spec>      Chain spec to use: tiny or full (default: tiny)
  --help, -h         Show this help message

Example:
  bun run fuzzer-target.ts --socket /tmp/jam_target.sock --spec tiny
`)
    process.exit(0)
  }
}

// Initialize logger to avoid "undefined" in console output
logger.init()

// Initialize services (similar to safrole-all-blocks.test.ts)
const configService = new ConfigService(spec as 'tiny' | 'full')

// Feature flags
const FEATURE_ANCESTRY = 0x01 // 2^0
const FEATURE_FORKS = 0x02 // 2^1
const SUPPORTED_FEATURES = FEATURE_ANCESTRY | FEATURE_FORKS

// Default JAM version (will be updated from PeerInfo message)
let JAM_VERSION: JamVersion = DEFAULT_JAM_VERSION

// App version
const APP_VERSION = { major: 0, minor: 1, patch: 0 }
const APP_NAME = 'pbnj-fuzzer-target'

// Initialize all services
let stateService: StateService
let blockImporterService: BlockImporterService
let initialized = false
let blockNumber = 0n // Track current block number for state root comparison

// Track previous state for comparison
let previousStateKeyvals: Map<string, string> = new Map()

async function initializeServices() {
  let ringProver: RingVRFProverWasm
  let ringVerifier: RingVRFVerifierWasm

  try {
    logger.info('Loading SRS file...')
    const srsFilePath = path.join(
      WORKSPACE_ROOT,
      'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
    )
    logger.info(`SRS file path: ${srsFilePath}`)

    // Check if file exists
    const fs = await import('node:fs/promises')
    try {
      await fs.access(srsFilePath)
      logger.info('SRS file exists')
    } catch {
      logger.error(`SRS file not found at ${srsFilePath}`)
      throw new Error(`SRS file not found: ${srsFilePath}`)
    }

    ringProver = new RingVRFProverWasm(srsFilePath)
    ringVerifier = new RingVRFVerifierWasm(srsFilePath)

    logger.info('Initializing ring prover...')
    try {
      // Add timeout to prevent hanging - WASM initialization can take time but shouldn't hang indefinitely
      logger.debug('Starting ring prover init promise...')
      const initStartTime = Date.now()
      const initPromise = ringProver.init()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const elapsed = Date.now() - initStartTime
          reject(
            new Error(
              `Ring prover initialization timeout after ${elapsed}ms (30 second limit)`,
            ),
          )
        }, 30000)
      })
      logger.debug('Racing init promise against timeout...')
      const initResult = await Promise.race([initPromise, timeoutPromise])
      const elapsed = Date.now() - initStartTime
      logger.info(
        `Ring prover initialized in ${elapsed}ms, result:`,
        initResult,
      )
    } catch (initError) {
      logger.error('Failed to initialize ring prover:', initError)
      if (initError instanceof Error) {
        logger.error('Init error message:', initError.message)
        logger.error('Init error stack:', initError.stack)
      }
      throw initError
    }

    logger.info('Initializing ring verifier...')
    try {
      // Add timeout to prevent hanging
      logger.debug('Starting ring verifier init promise...')
      const initStartTime = Date.now()
      const initPromise = ringVerifier.init()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const elapsed = Date.now() - initStartTime
          reject(
            new Error(
              `Ring verifier initialization timeout after ${elapsed}ms (30 second limit)`,
            ),
          )
        }, 30000)
      })
      logger.debug('Racing init promise against timeout...')
      const initResult = await Promise.race([initPromise, timeoutPromise])
      const elapsed = Date.now() - initStartTime
      logger.info(
        `Ring verifier initialized in ${elapsed}ms, result:`,
        initResult,
      )
    } catch (initError) {
      logger.error('Failed to initialize ring verifier:', initError)
      if (initError instanceof Error) {
        logger.error('Init error message:', initError.message)
        logger.error('Init error stack:', initError.stack)
      }
      throw initError
    }

    logger.info('Ring VRF initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize Ring VRF:', error)
    if (error instanceof Error) {
      logger.error('Error message:', error.message)
      logger.error('Error stack:', error.stack)
    }
    throw error
  }

  try {
    const eventBusService = new EventBusService()
    const clockService = new ClockService({
      configService: configService,
      eventBusService: eventBusService,
    })
    const entropyService = new EntropyService(eventBusService)
    const ticketService = new TicketService({
      configService: configService,
      eventBusService: eventBusService,
      keyPairService: null,
      entropyService: entropyService,
      networkingService: null,
      ce131TicketDistributionProtocol: null,
      ce132TicketDistributionProtocol: null,
      clockService: clockService,
      prover: ringProver,
      ringVerifier: ringVerifier,
      validatorSetManager: null,
    })
    const sealKeyService = new SealKeyService({
      configService,
      eventBusService,
      entropyService,
      ticketService,
    })

    const validatorSetManager = new ValidatorSetManager({
      eventBusService,
      sealKeyService,
      ringProver,
      ticketService,
      configService,
      initialValidators: [],
    })

    ticketService.setValidatorSetManager(validatorSetManager)

    const authQueueService = new AuthQueueService({
      configService,
    })

    const disputesService = new DisputesService({
      eventBusService: eventBusService,
      configService: configService,
      validatorSetManagerService: validatorSetManager,
    })
    const readyService = new ReadyService({
      configService: configService,
    })

    const workReportService = new WorkReportService({
      eventBus: eventBusService,
      networkingService: null,
      ce136WorkReportRequestProtocol: null,
      validatorSetManager: validatorSetManager,
      configService: configService,
      entropyService: entropyService,
      clockService: clockService,
    })

    const authPoolService = new AuthPoolService({
      configService,
      eventBusService: eventBusService,
      workReportService: workReportService,
      authQueueService: authQueueService,
    })

    const privilegesService = new PrivilegesService({
      configService,
    })

    const serviceAccountsService = new ServiceAccountService({
      configService,
      eventBusService,
      clockService,
      networkingService: null,
      preimageRequestProtocol: null,
    })

    const hostFunctionRegistry = new HostFunctionRegistry(
      serviceAccountsService,
      configService,
    )
    const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(
      configService,
    )
    const accumulatePVM = new AccumulatePVM({
      hostFunctionRegistry,
      accumulateHostFunctionRegistry,
      configService: configService,
      entropyService: entropyService,
      pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) },
      useWasm: true,
    })

    const statisticsService = new StatisticsService({
      eventBusService: eventBusService,
      configService: configService,
      clockService: clockService,
    })

    const accumulatedService = new AccumulationService({
      configService: configService,
      clockService: clockService,
      serviceAccountsService: serviceAccountsService,
      privilegesService: privilegesService,
      validatorSetManager: validatorSetManager,
      authQueueService: authQueueService,
      accumulatePVM: accumulatePVM,
      readyService: readyService,
      statisticsService: statisticsService,
    })

    const recentHistoryService = new RecentHistoryService({
      eventBusService: eventBusService,
      configService: configService,
      accumulationService: accumulatedService,
    })

    // Create a minimal genesis manager for fuzzer target
    // The state will be set via Initialize message, so we need a mock that returns empty state
    const genesisManager = new NodeGenesisManager(configService, {})

    // Override getState to return empty state for fuzzer
    // Safe type is [error, value] tuple - use safeResult helper
    const originalGetState = genesisManager.getState.bind(genesisManager)
    genesisManager.getState = () => {
      // Return empty state - will be set via Initialize message
      // GenesisHeaderState has keyvals: KeyValue[]
      return safeResult({ keyvals: [] })
    }

    stateService = new StateService({
      configService,
      genesisManagerService: genesisManager,
      validatorSetManager: validatorSetManager,
      entropyService: entropyService,
      ticketService: ticketService,
      authQueueService: authQueueService,
      authPoolService: authPoolService,
      statisticsService: statisticsService,
      disputesService: disputesService,
      readyService: readyService,
      accumulationService: accumulatedService,
      workReportService: workReportService,
      privilegesService: privilegesService,
      serviceAccountsService: serviceAccountsService,
      recentHistoryService: recentHistoryService,
      sealKeyService: sealKeyService,
      clockService: clockService,
    })

    const assuranceService = new AssuranceService({
      configService: configService,
      workReportService: workReportService,
      validatorSetManager: validatorSetManager,
      eventBusService: eventBusService,
      sealKeyService: sealKeyService,
      recentHistoryService: recentHistoryService,
    })

    const guarantorService = new GuarantorService({
      configService: configService,
      clockService: clockService,
      entropyService: entropyService,
      authPoolService: authPoolService,
      networkService: null,
      ce134WorkPackageSharingProtocol: null,
      keyPairService: null,
      workReportService: workReportService,
      eventBusService: eventBusService,
      validatorSetManager: validatorSetManager,
      recentHistoryService: recentHistoryService,
      serviceAccountService: serviceAccountsService,
      statisticsService: statisticsService,
      accumulationService: accumulatedService,
    })

    blockImporterService = new BlockImporterService({
      configService: configService,
      eventBusService: eventBusService,
      clockService: clockService,
      recentHistoryService: recentHistoryService,
      stateService: stateService,
      serviceAccountService: serviceAccountsService,
      disputesService: disputesService,
      validatorSetManagerService: validatorSetManager,
      entropyService: entropyService,
      sealKeyService: sealKeyService,
      assuranceService: assuranceService,
      guarantorService: guarantorService,
      ticketService: ticketService,
      statisticsService: statisticsService,
      authPoolService: authPoolService,
      accumulationService: accumulatedService,
    })

    sealKeyService.setValidatorSetManager(validatorSetManager)
    sealKeyService.registerEpochTransitionCallback()

    logger.info('Starting entropy service...')
    const [entropyStartError] = await entropyService.start()
    if (entropyStartError) {
      logger.error('Failed to start entropy service:', entropyStartError)
      throw entropyStartError
    }

    logger.info('Starting validator set manager...')
    const [validatorSetStartError] = await validatorSetManager.start()
    if (validatorSetStartError) {
      logger.error(
        'Failed to start validator set manager:',
        validatorSetStartError,
      )
      throw validatorSetStartError
    }

    logger.info('Starting block importer service...')
    const [startError] = await blockImporterService.start()
    if (startError) {
      logger.error('Failed to start block importer service:', startError)
      throw startError
    }
    logger.info('All services started successfully')
  } catch (error) {
    logger.error('Failed to start services:', error)
    throw error
  }
}

// Read message with length prefix
function readMessage(socket: UnixSocket): Promise<Uint8Array> {
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
        // Need more data for length
        return
      }

      if (expectedLength === 0) {
        // Read length (32-bit little-endian)
        expectedLength = lengthBytes.readUInt32LE(0)
        lengthBytes = lengthBytes.subarray(4)
      }

      if (lengthBytes.length >= expectedLength) {
        cleanup()
        resolve(new Uint8Array(lengthBytes.subarray(0, expectedLength)))
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

// Send message with length prefix
function sendMessage(socket: UnixSocket, message: Uint8Array): void {
  const lengthBytes = Buffer.alloc(4)
  lengthBytes.writeUInt32LE(message.length, 0)
  socket.write(Buffer.concat([lengthBytes, Buffer.from(message)]))
}

// Handle PeerInfo request
function handlePeerInfo(socket: UnixSocket, peerInfo: FuzzPeerInfo): void {
  // Send our PeerInfo response
  const response: FuzzMessage = {
    type: FuzzMessageType.PeerInfo,
    payload: {
      fuzz_version: 1,
      fuzz_features: SUPPORTED_FEATURES,
      jam_version: JAM_VERSION,
      app_version: APP_VERSION,
      app_name: APP_NAME,
    },
  }

  const encoded = encodeFuzzMessage(response, configService)
  sendMessage(socket, encoded)
}

// Handle Initialize request
async function handleInitialize(
  socket: UnixSocket,
  init: Initialize,
): Promise<void> {
  try {
    logger.debug(
      `Initialize: Setting state with ${init.keyvals.length} keyvals`,
    )
    // Set state from keyvals with JAM version from PeerInfo
    const [setStateError] = stateService.setState(init.keyvals, JAM_VERSION)
    if (setStateError) {
      logger.error(`Failed to set state: ${setStateError.message}`)
      throw new Error(`Failed to set state: ${setStateError.message}`)
    }
    logger.debug(`Initialize: State set successfully`)

    initialized = true

    // Debug: Generate state trie to see what's in it
    const [trieError, stateTrie] = stateService.generateStateTrie()
    if (!trieError && stateTrie) {
      logger.debug(
        `Initialize: State trie has ${Object.keys(stateTrie).length} keys`,
      )
      // Log first few keys for debugging
      const keys = Object.keys(stateTrie).slice(0, 5)
      logger.debug(`Initialize: First 5 state keys: ${keys.join(', ')}`)

      // Store initial state for comparison
      previousStateKeyvals.clear()
      for (const [key, value] of Object.entries(stateTrie)) {
        previousStateKeyvals.set(key, value)
      }
      logger.info(
        `Initialize: Stored ${previousStateKeyvals.size} keyvals for comparison`,
      )
    }

    // Get state root
    logger.debug(`Initialize: Getting state root`)
    const [stateRootError, stateRoot] = stateService.getStateRoot()
    if (stateRootError) {
      logger.error(`Failed to get state root: ${stateRootError.message}`)
      throw new Error(`Failed to get state root: ${stateRootError.message}`)
    }
    logger.debug(`Initialize: State root: ${stateRoot}`)

    // Send StateRoot response
    const response: FuzzMessage = {
      type: FuzzMessageType.StateRoot,
      payload: { state_root: stateRoot },
    }

    const encoded = encodeFuzzMessage(response, configService)
    logger.debug(
      `Initialize: Sending StateRoot response (${encoded.length} bytes)`,
    )
    sendMessage(socket, encoded)
    logger.debug(`Initialize: StateRoot response sent`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Initialize error: ${errorMsg}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Initialize error stack: ${error.stack}`)
    }
    const response: FuzzMessage = {
      type: FuzzMessageType.Error,
      payload: { error: errorMsg },
    }
    const encoded = encodeFuzzMessage(response, configService)
    logger.debug(
      `Initialize: Sending Error response (${encoded.length} bytes): ${errorMsg}`,
    )
    sendMessage(socket, encoded)
    logger.debug(`Initialize: Error response sent`)
  }
}

// Handle ImportBlock request
async function handleImportBlock(
  socket: UnixSocket,
  importBlock: ImportBlock,
): Promise<void> {
  if (!initialized) {
    const response: FuzzMessage = {
      type: FuzzMessageType.Error,
      payload: { error: 'Not initialized. Send Initialize first.' },
    }
    const encoded = encodeFuzzMessage(response, configService)
    sendMessage(socket, encoded)
    return
  }

  try {
    // Import the block
    const [importError] = await blockImporterService.importBlock(
      importBlock.block,
    )
    if (importError) {
      const response: FuzzMessage = {
        type: FuzzMessageType.Error,
        payload: { error: `Block import failed: ${importError.message}` },
      }
      const encoded = encodeFuzzMessage(response, configService)
      sendMessage(socket, encoded)
      return
    }

    // Update block number from header
    if (importBlock.block?.header?.timeslot !== undefined) {
      blockNumber = importBlock.block.header.timeslot
    }

    // Get state root
    const [stateRootError, stateRoot] = stateService.getStateRoot()
    if (stateRootError) {
      throw new Error(`Failed to get state root: ${stateRootError.message}`)
    }

    // Try to load expected state root from test vectors for comparison
    // File naming: 00000001=Initialize, 00000002=Block1, 00000003=Block2, etc.
    // So file number = timeslot + 1
    let expectedStateRoot: string | null = null
    try {
      const fileNumber = Number(blockNumber) + 1
      const expectedStateRootJsonPath = path.join(
        WORKSPACE_ROOT,
        `submodules/jam-conformance/fuzz-proto/examples/v1/no_forks/${String(fileNumber).padStart(8, '0')}_target_state_root.json`,
      )
      const fs = await import('node:fs/promises')
      try {
        const expectedStateRootJson = JSON.parse(
          await fs.readFile(expectedStateRootJsonPath, 'utf-8'),
        )
        expectedStateRoot =
          expectedStateRootJson.state_root?.toLowerCase() || null
        if (expectedStateRoot) {
          const stateRootMatch = stateRoot.toLowerCase() === expectedStateRoot
          if (!stateRootMatch) {
            logger.error(
              `❌ State root mismatch after ImportBlock (block ${blockNumber}):`,
            )
            logger.error(`  Expected: ${expectedStateRoot}`)
            logger.error(`  Got:      ${stateRoot.toLowerCase()}`)
          } else {
            logger.info(
              `✅ State root matches expected after ImportBlock (block ${blockNumber})`,
            )
          }
        }
      } catch {
        // Expected state root file doesn't exist, that's okay
      }
    } catch {
      // Failed to load expected state root, that's okay
    }

    // Generate state trie to dump keyvals for debugging (especially on mismatch)
    const [trieError, stateTrie] = stateService.generateStateTrie()
    if (trieError) {
      logger.warn(
        `Failed to generate state trie for debugging: ${trieError.message}`,
      )
    } else if (stateTrie) {
      // Convert to map for comparison
      const currentStateKeyvals = new Map<string, string>()
      for (const [key, value] of Object.entries(stateTrie)) {
        currentStateKeyvals.set(key, value)
      }

      // Always log state summary
      logger.info(
        `State after ImportBlock (block ${blockNumber}): ${currentStateKeyvals.size} keyvals, state root: ${stateRoot}`,
      )

      // If state root doesn't match expected, print ONLY the differences from previous state
      if (expectedStateRoot && stateRoot.toLowerCase() !== expectedStateRoot) {
        logger.error(`❌ STATE ROOT MISMATCH at block ${blockNumber}`)
        logger.error(`   Expected: ${expectedStateRoot}`)
        logger.error(`   Got:      ${stateRoot.toLowerCase()}`)

        // Find keys that changed
        const addedKeys: string[] = []
        const removedKeys: string[] = []
        const modifiedKeys: Array<{
          key: string
          oldValue: string
          newValue: string
        }> = []

        // Find added and modified keys
        for (const [key, newValue] of currentStateKeyvals.entries()) {
          const oldValue = previousStateKeyvals.get(key)
          if (oldValue === undefined) {
            addedKeys.push(key)
          } else if (oldValue !== newValue) {
            modifiedKeys.push({ key, oldValue, newValue })
          }
        }

        // Find removed keys
        for (const key of previousStateKeyvals.keys()) {
          if (!currentStateKeyvals.has(key)) {
            removedKeys.push(key)
          }
        }

        logger.error(`\n📊 STATE DIFF (block ${blockNumber}):`)
        logger.error(`   Added keys: ${addedKeys.length}`)
        logger.error(`   Removed keys: ${removedKeys.length}`)
        logger.error(`   Modified keys: ${modifiedKeys.length}`)

        if (addedKeys.length > 0) {
          logger.error(`\n🟢 ADDED KEYS:`)
          for (const key of addedKeys) {
            const value = currentStateKeyvals.get(key)!
            const valuePreview =
              value.length > 100 ? value.substring(0, 100) + '...' : value
            logger.error(`   ${key}: ${valuePreview} (${value.length} chars)`)
          }
        }

        if (removedKeys.length > 0) {
          logger.error(`\n🔴 REMOVED KEYS:`)
          for (const key of removedKeys) {
            const value = previousStateKeyvals.get(key)!
            const valuePreview =
              value.length > 100 ? value.substring(0, 100) + '...' : value
            logger.error(`   ${key}: ${valuePreview} (${value.length} chars)`)
          }
        }

        if (modifiedKeys.length > 0) {
          logger.error(`\n🟡 MODIFIED KEYS:`)
          for (const { key, oldValue, newValue } of modifiedKeys) {
            logger.error(`   ${key}:`)
            const oldPreview =
              oldValue.length > 80
                ? oldValue.substring(0, 80) + '...'
                : oldValue
            const newPreview =
              newValue.length > 80
                ? newValue.substring(0, 80) + '...'
                : newValue
            logger.error(`     OLD: ${oldPreview} (${oldValue.length} chars)`)
            logger.error(`     NEW: ${newPreview} (${newValue.length} chars)`)

            // Find first difference position for debugging
            let diffPos = 0
            const maxLen = Math.max(oldValue.length, newValue.length)
            for (let i = 0; i < maxLen; i++) {
              if (oldValue[i] !== newValue[i]) {
                diffPos = i
                break
              }
            }
            logger.error(`     First diff at position: ${diffPos}`)
            logger.error(
              `     OLD around diff: ...${oldValue.substring(Math.max(0, diffPos - 10), diffPos + 30)}...`,
            )
            logger.error(
              `     NEW around diff: ...${newValue.substring(Math.max(0, diffPos - 10), diffPos + 30)}...`,
            )
          }
        }
      } else {
        // Log brief summary for normal operation
        logger.debug(`State diff from previous block:`)
        let addedCount = 0
        let removedCount = 0
        let modifiedCount = 0
        for (const [key, newValue] of currentStateKeyvals.entries()) {
          const oldValue = previousStateKeyvals.get(key)
          if (oldValue === undefined) addedCount++
          else if (oldValue !== newValue) modifiedCount++
        }
        for (const key of previousStateKeyvals.keys()) {
          if (!currentStateKeyvals.has(key)) removedCount++
        }
        logger.debug(
          `  Added: ${addedCount}, Removed: ${removedCount}, Modified: ${modifiedCount}`,
        )
      }

      // Update previous state for next comparison
      previousStateKeyvals = currentStateKeyvals
    }

    // Send StateRoot response
    const response: FuzzMessage = {
      type: FuzzMessageType.StateRoot,
      payload: { state_root: stateRoot },
    }

    const encoded = encodeFuzzMessage(response, configService)
    sendMessage(socket, encoded)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    // Try to dump state keyvals even on error
    try {
      const [trieError, stateTrie] = stateService.generateStateTrie()
      if (!trieError && stateTrie) {
        const keyvals = Object.entries(stateTrie).map(([key, value]) => ({
          key: key as Hex,
          value: value as Hex,
        }))
        logger.error(`State keyvals on error (${keyvals.length} total):`)
        for (let i = 0; i < Math.min(20, keyvals.length); i++) {
          const kv = keyvals[i]
          const valuePreview =
            kv.value.length > 60 ? kv.value.substring(0, 60) + '...' : kv.value
          logger.error(`  [${i}] ${kv.key}: ${valuePreview}`)
        }
        if (keyvals.length > 20) {
          logger.error(`  ... and ${keyvals.length - 20} more keyvals`)
        }
      }
    } catch (dumpError) {
      logger.warn(
        `Failed to dump state keyvals: ${dumpError instanceof Error ? dumpError.message : String(dumpError)}`,
      )
    }

    const response: FuzzMessage = {
      type: FuzzMessageType.Error,
      payload: { error: errorMsg },
    }
    const encoded = encodeFuzzMessage(response, configService)
    sendMessage(socket, encoded)
  }
}

// Handle GetState request
async function handleGetState(
  socket: UnixSocket,
  getState: GetState,
): Promise<void> {
  if (!initialized) {
    const response: FuzzMessage = {
      type: FuzzMessageType.Error,
      payload: { error: 'Not initialized. Send Initialize first.' },
    }
    const encoded = encodeFuzzMessage(response, configService)
    sendMessage(socket, encoded)
    return
  }

  try {
    // Generate state trie
    const [stateTrieError, stateTrie] = stateService.generateStateTrie()
    if (stateTrieError) {
      throw new Error(
        `Failed to generate state trie: ${stateTrieError.message}`,
      )
    }

    // Convert state trie to KeyValue array
    const keyvals = Object.entries(stateTrie || {}).map(([key, value]) => ({
      key: key as Hex,
      value: value as Hex,
    }))

    // Send State response
    const response: FuzzMessage = {
      type: FuzzMessageType.State,
      payload: { keyvals },
    }

    const encoded = encodeFuzzMessage(response, configService)
    sendMessage(socket, encoded)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const response: FuzzMessage = {
      type: FuzzMessageType.Error,
      payload: { error: errorMsg },
    }
    const encoded = encodeFuzzMessage(response, configService)
    sendMessage(socket, encoded)
  }
}

// Handle incoming connection
async function handleConnection(socket: UnixSocket) {
  const clientId = `${socket.remoteAddress || 'unknown'}-${Date.now()}`
  logger.info(`Fuzzer connected [${clientId}]`)

  try {
    // Wait for PeerInfo from fuzzer
    const peerInfoData = await readMessage(socket)
    const peerInfoMessage = decodeFuzzMessage(peerInfoData, configService)

    if (peerInfoMessage.type !== FuzzMessageType.PeerInfo) {
      throw new Error(`Expected PeerInfo, got ${peerInfoMessage.type}`)
    }

    // Update JAM version from fuzzer's PeerInfo
    const fuzzerJamVersion = peerInfoMessage.payload.jam_version
    JAM_VERSION = fuzzerJamVersion
    logger.info(
      `JAM version from fuzzer: ${fuzzerJamVersion.major}.${fuzzerJamVersion.minor}.${fuzzerJamVersion.patch}`,
    )

    handlePeerInfo(socket, peerInfoMessage.payload)

    // Process messages in a loop
    while (!socket.destroyed && socket.readable) {
      try {
        const messageData = await readMessage(socket)
        const discriminant = messageData.length > 0 ? messageData[0] : undefined
        const discriminantHex =
          discriminant !== undefined
            ? `0x${discriminant.toString(16).padStart(2, '0')}`
            : 'undefined'
        logger.info(
          `Received message: ${messageData.length} bytes, discriminant: ${discriminantHex}`,
        )

        // Valid discriminants: 0x00=PeerInfo, 0x01=Initialize, 0x02=StateRoot, 0x03=ImportBlock, 0x04=GetState, 0x05=State, 0xFF=Error
        const validDiscriminants = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0xff]
        if (
          discriminant !== undefined &&
          !validDiscriminants.includes(discriminant)
        ) {
          logger.warn(
            `Unexpected message discriminant: ${discriminantHex}, expected one of: ${validDiscriminants.map((d) => `0x${d.toString(16).padStart(2, '0')}`).join(', ')}`,
          )
        }

        // For Initialize messages, verify we received the expected amount of data
        // The test file is 177945 bytes and decodes 21 keyvals
        if (messageData.length > 0 && messageData[0] === 0x01) {
          if (messageData.length !== 177945) {
            logger.warn(
              `⚠️  Initialize message size mismatch: received ${messageData.length} bytes, expected 177945 bytes (from test file)`,
            )
          }
        }

        let message: FuzzMessage
        try {
          message = decodeFuzzMessage(messageData, configService)
          logger.debug(`Decoded message type: ${message.type}`)
          if (message.type === FuzzMessageType.Initialize) {
            logger.info(
              `Initialize message decoded: ${message.payload.keyvals.length} keyvals, ${message.payload.ancestry.length} ancestry items`,
            )
            if (message.payload.keyvals.length > 0) {
              const firstKv = message.payload.keyvals[0]
              const valueBytes = firstKv.value.startsWith('0x')
                ? (firstKv.value.length - 2) / 2
                : firstKv.value.length / 2
              logger.debug(
                `First keyval - key: ${firstKv.key.substring(0, 50)}..., value: ${firstKv.value.substring(0, 50)}... (${valueBytes} bytes)`,
              )
            }
            if (message.payload.keyvals.length !== 21) {
              logger.error(
                `❌ Expected 21 keyvals but decoded ${message.payload.keyvals.length} keyvals - this indicates a decoding issue!`,
              )
              logger.error(
                `   Message data length: ${messageData.length} bytes`,
              )
              logger.error(
                `   First 20 bytes: ${Array.from(messageData.slice(0, 20))
                  .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
                  .join(' ')}`,
              )
            } else {
              logger.info(`✅ Successfully decoded 21 keyvals as expected`)
            }
          }
        } catch (decodeError) {
          logger.error(
            `Failed to decode message: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`,
          )
          if (decodeError instanceof Error && decodeError.stack) {
            logger.error(`Decode error stack: ${decodeError.stack}`)
          }
          // Send error response
          const errorResponse: FuzzMessage = {
            type: FuzzMessageType.Error,
            payload: {
              error: `Failed to decode message: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`,
            },
          }
          const encoded = encodeFuzzMessage(errorResponse, configService)
          sendMessage(socket, encoded)
          throw decodeError
        }

        switch (message.type) {
          case FuzzMessageType.Initialize:
            logger.debug(`Handling Initialize message`)
            await handleInitialize(socket, message.payload)
            logger.debug(`Initialize handled successfully`)
            break
          case FuzzMessageType.ImportBlock:
            logger.debug(`Handling ImportBlock message`)
            await handleImportBlock(socket, message.payload)
            break
          case FuzzMessageType.GetState:
            logger.debug(`Handling GetState message`)
            await handleGetState(socket, message.payload)
            break
          default:
            throw new Error(`Unexpected message type: ${message.type}`)
        }
      } catch (messageError) {
        // If it's a socket closure, break the loop
        if (
          messageError instanceof Error &&
          (messageError.message.includes('closed') ||
            messageError.message.includes('ECONNRESET') ||
            messageError.message.includes('Socket closed'))
        ) {
          logger.info(`Connection closed by client [${clientId}]`)
          break
        }
        // Log the error but don't rethrow - continue processing other messages
        // This allows the server to handle multiple connections and recover from errors
        logger.error(`Error processing message [${clientId}]:`, messageError)
        if (messageError instanceof Error && messageError.stack) {
          logger.error(`Message error stack: ${messageError.stack}`)
        }
        // Send error response to client if socket is still writable
        if (!socket.destroyed && socket.writable) {
          try {
            const errorResponse: FuzzMessage = {
              type: FuzzMessageType.Error,
              payload: {
                error:
                  messageError instanceof Error
                    ? messageError.message
                    : String(messageError),
              },
            }
            const encoded = encodeFuzzMessage(errorResponse, configService)
            sendMessage(socket, encoded)
          } catch (sendError) {
            logger.warn(
              `Failed to send error response: ${sendError instanceof Error ? sendError.message : String(sendError)}`,
            )
          }
        }
        // Continue the loop to process next message instead of breaking
        // Only break if socket is destroyed or not readable
        if (socket.destroyed || !socket.readable) {
          logger.info(
            `Socket no longer readable, closing connection [${clientId}]`,
          )
          break
        }
      }
    }
  } catch (error) {
    logger.error(`Connection error [${clientId}]:`, error)
  } finally {
    // Clean up the socket
    if (!socket.destroyed) {
      socket.destroy()
    }
    logger.info(`Connection closed [${clientId}]`)
  }
}

// Main function
async function main() {
  try {
    logger.info('Starting fuzzer target...')
    logger.info(`Socket path: ${socketPath}`)
    logger.info(`Spec: ${spec}`)

    // Initialize services
    logger.info('Initializing services...')
    await initializeServices()
    logger.info('Services initialized successfully')

    // Remove existing socket if it exists
    try {
      unlinkSync(socketPath)
      logger.info(`Removed existing socket at ${socketPath}`)
    } catch {
      // Socket doesn't exist, that's fine
      logger.info(`No existing socket found at ${socketPath}`)
    }

    // Create Unix domain socket server
    logger.info('Creating Unix domain socket server...')
    const server = new UnixServer()

    server.on('connection', (socket: UnixSocket) => {
      // Handle connection in a fire-and-forget manner
      // Errors in handleConnection are caught internally and don't affect the server
      handleConnection(socket).catch((error) => {
        logger.error(`Unhandled error in handleConnection:`, error)
        if (error instanceof Error) {
          logger.error(`Error stack:`, error.stack)
        }
        // Don't exit - just log the error and continue listening for new connections
      })
    })

    server.on('error', (error) => {
      logger.error('Server error:', error)
      // Don't exit on error - try to continue listening
      // Only exit on fatal errors
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        logger.error(`Socket ${socketPath} is already in use`)
        process.exit(1)
      }
    })

    server.listen(socketPath, () => {
      logger.info(`✅ Fuzzer target listening on ${socketPath}`)
      logger.info(`Spec: ${spec}`)
      logger.info(
        `Features: ancestry=${!!(SUPPORTED_FEATURES & FEATURE_ANCESTRY)}, forks=${!!(SUPPORTED_FEATURES & FEATURE_FORKS)}`,
      )
      logger.info('Ready to accept connections (press Ctrl+C to stop)')
    })

    // Keep the process alive
    server.on('listening', () => {
      logger.info('Server is listening for connections')
    })

    // Handle shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down...')
      server.close()
      try {
        unlinkSync(socketPath)
      } catch {
        // Ignore
      }
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      logger.info('Shutting down...')
      server.close()
      try {
        unlinkSync(socketPath)
      } catch {
        // Ignore
      }
      process.exit(0)
    })

    // Keep process alive - prevent exit
    process.stdin.resume()
  } catch (error) {
    logger.error('Failed to start fuzzer target:', error)
    if (error instanceof Error) {
      logger.error('Error stack:', error.stack)
    }
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  if (reason instanceof Error) {
    logger.error('Error stack:', reason.stack)
  }
  // Don't exit - let the error be handled by the catch block
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  logger.error('Error stack:', error.stack)
  process.exit(1)
})

main().catch((error) => {
  logger.error('Fatal error in main:', error)
  if (error instanceof Error) {
    logger.error('Error message:', error.message)
    logger.error('Error stack:', error.stack)
  }
  process.exit(1)
})
