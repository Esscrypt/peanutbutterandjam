/**
 * Fuzzer Initialize Test
 *
 * Tests that the Initialize message from the fuzzer protocol correctly sets state
 * and produces the expected state root.
 *
 * This test loads the Initialize message from the fuzzer test vectors, sets the state,
 * and verifies the computed state root matches the expected value.
 */

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { decodeFuzzMessage } from '@pbnjam/codec'
import { ConfigService } from '../services/config-service'
import { StateService } from '../services/state-service'
import { ValidatorSetManager } from '../services/validator-set'
import { EntropyService } from '../services/entropy'
import { TicketService } from '../services/ticket-service'
import { AuthQueueService } from '../services/auth-queue-service'
import { AuthPoolService } from '../services/auth-pool-service'
import { DisputesService } from '../services/disputes-service'
import { ReadyService } from '../services/ready-service'
import { AccumulationService } from '../services/accumulation-service'
import { WorkReportService } from '../services/work-report-service'
import { PrivilegesService } from '../services/privileges-service'
import { ServiceAccountService } from '../services/service-account-service'
import { RecentHistoryService } from '../services/recent-history-service'
import { EventBusService } from '@pbnjam/core'
import { SealKeyService } from '../services/seal-key'
import { RingVRFProverWasm } from '@pbnjam/bandersnatch-vrf'
import { RingVRFVerifierWasm } from '@pbnjam/bandersnatch-vrf'
import { ClockService } from '../services/clock-service'
import {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'
import { StatisticsService } from '../services/statistics-service'
import { NodeGenesisManager } from '../services/genesis-manager'
import { FuzzMessageType, safeResult } from '@pbnjam/types'

// Test vectors directory (relative to workspace root)
// __dirname is infra/node/__tests__, so we go up 3 levels to get to workspace root
const WORKSPACE_ROOT = path.join(__dirname, '../../../')

describe('Fuzzer Initialize Test', () => {
  const configService = new ConfigService('tiny')

  it('should produce expected state root from fuzzer Initialize message', async () => {
    // Examples directory
    const examplesDir = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-conformance/fuzz-proto/examples/0.7.2/no_forks',
    )

    // Load PeerInfo message to get JAM version
    const peerInfoJsonPath = path.join(examplesDir, '00000000_fuzzer_peer_info.json')
    let jamVersion: { major: number; minor: number; patch: number } = { major: 0, minor: 7, patch: 0 }
    try {
      const peerInfoJson = JSON.parse(readFileSync(peerInfoJsonPath, 'utf-8'))
      if (peerInfoJson.peer_info?.jam_version) {
        jamVersion = peerInfoJson.peer_info.jam_version
        console.log(`📋 JAM version from PeerInfo: ${jamVersion.major}.${jamVersion.minor}.${jamVersion.patch}`)
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load PeerInfo, using default JAM version: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Load expected state root from target_state_root.json
    const expectedStateRootPath = path.join(examplesDir, '00000001_target_state_root.json')
    let expectedStateRoot: string | null = null
    if (existsSync(expectedStateRootPath)) {
      try {
        const expectedJson = JSON.parse(readFileSync(expectedStateRootPath, 'utf-8'))
        expectedStateRoot = expectedJson.state_root?.toLowerCase()
        console.log(`📋 Expected state root loaded from file: ${expectedStateRoot}`)
      } catch (error) {
        throw new Error(
          `Failed to load expected state root: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    } else {
      throw new Error(`Expected state root file not found: ${expectedStateRootPath}`)
    }

    // Load Initialize message from fuzzer test vectors
    const initializeBinPath = path.join(examplesDir, '00000001_fuzzer_initialize.bin')

    let initializeBin: Uint8Array
    try {
      initializeBin = new Uint8Array(readFileSync(initializeBinPath))
    } catch (error) {
      throw new Error(
        `Failed to read Initialize message: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Initialize Ring VRF
    const srsFilePath = path.join(
      WORKSPACE_ROOT,
      'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
    )
    const ringProver = new RingVRFProverWasm(srsFilePath)
    const ringVerifier = new RingVRFVerifierWasm(srsFilePath)

    await ringProver.init()
    await ringVerifier.init()

    // Initialize services (similar to safrole-all-blocks.test.ts)
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
      configService: configService,
    })

    const serviceAccountsService = new ServiceAccountService({
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

    // Create a minimal genesis manager for fuzzer test
    // Override getState to return empty state - will be set via Initialize message
    const genesisManager = new NodeGenesisManager(configService, {})
    const originalGetState = genesisManager.getState.bind(genesisManager)
    genesisManager.getState = () => {
      // Return empty state - will be set via Initialize message
      // Safe type is [error, value] tuple - use safeResult helper
      return safeResult({ state_root: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`, keyvals: [] })
    }

    const stateService = new StateService({
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


    sealKeyService.setValidatorSetManager(validatorSetManager)

    // Start services
    const [entropyStartError] = await entropyService.start()
    expect(entropyStartError).toBeUndefined()

    const [validatorSetStartError] = await validatorSetManager.start()
    expect(validatorSetStartError).toBeUndefined()

    // Decode Initialize message
    // The binary file includes the 4-byte length prefix, so we need to skip it
    // or the message starts directly after it
    let messageData: Uint8Array
    if (initializeBin.length >= 4) {
      // Check if first 4 bytes are a length prefix (little-endian)
      const lengthPrefix = new DataView(initializeBin.buffer, initializeBin.byteOffset, 4).getUint32(0, true)
      if (lengthPrefix === initializeBin.length - 4) {
        // It's a length prefix, skip it
        messageData = initializeBin.subarray(4)
      } else {
        // No length prefix, use entire buffer
        messageData = initializeBin
      }
    } else {
      messageData = initializeBin
    }

    console.log(
      `🔍 Decoding message: ${messageData.length} bytes, first byte: 0x${messageData[0]?.toString(16) || 'undefined'}`,
    )

    let initializeMessage: ReturnType<typeof decodeFuzzMessage>
    try {
      initializeMessage = decodeFuzzMessage(messageData, configService)
    } catch (error) {
      throw new Error(
        `Failed to decode Initialize message: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    if (initializeMessage.type !== FuzzMessageType.Initialize) {
      throw new Error(
        `Expected Initialize message, got ${initializeMessage.type}`,
      )
    }

    const init = initializeMessage.payload

    console.log(`\n📋 Initialize message loaded:`)
    console.log(`  Header slot: ${init.header.timeslot}`)
    console.log(`  Keyvals count: ${init.keyvals.length}`)
    console.log(`  Ancestry count: ${init.ancestry.length}`)

    if (init.keyvals.length === 0) {
      console.warn(
        `⚠️  WARNING: Initialize message has 0 keyvals! This is unexpected.`,
      )
      console.warn(
        `   The binary file should contain state keyvals. Check decoding logic.`,
      )
    }

    // Set state from keyvals with JAM version from PeerInfo
    const [setStateError] = stateService.setState(init.keyvals)
    if (setStateError) {
      throw new Error(`Failed to set state: ${setStateError.message}`)
    }

    console.log(`✅ State set from ${init.keyvals.length} keyvals`)

    // Generate state trie for debugging
    const [trieError, stateTrie] = stateService.generateStateTrie()
    if (trieError) {
      throw new Error(`Failed to generate state trie: ${trieError.message}`)
    }

    console.log(`📊 State trie generated with ${Object.keys(stateTrie).length} keys`)

    // Get state root
    const [stateRootError, computedStateRoot] = stateService.getStateRoot()
    if (stateRootError) {
      throw new Error(
        `Failed to get state root: ${stateRootError.message}`,
      )
    }

    if (!expectedStateRoot) {
      throw new Error('Expected state root is null')
    }

    console.log(`\n🔍 State Root Comparison:`)
    console.log(`  Expected: ${expectedStateRoot}`)
    console.log(`  Computed: ${computedStateRoot}`)
    console.log(`  Match: ${computedStateRoot?.toLowerCase() === expectedStateRoot ? '✅' : '❌'}`)

    // Verify state root matches expected value
    expect(computedStateRoot?.toLowerCase()).toBe(expectedStateRoot)
  })
})

