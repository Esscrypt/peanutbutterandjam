/**
 * Genesis Round-Trip Encoding/Decoding Test
 *
 * This test investigates round-trip encoding/decoding issues by:
 * 1. Loading genesis.json and setting state from its keyvals
 * 2. Generating state trie from StateService
 * 3. Comparing generated keyvals with block 1's pre_state keyvals
 * 4. Identifying any mismatches that cause state root differences
 */

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync } from 'node:fs'
import { NodeGenesisManager } from '../../services/genesis-manager'
import { ConfigService } from '../../services/config-service'
import { StateService } from '../../services/state-service'
import { ValidatorSetManager } from '../../services/validator-set'
import { EntropyService } from '../../services/entropy'
import { TicketService } from '../../services/ticket-service'
import { AuthQueueService } from '../../services/auth-queue-service'
import { AuthPoolService } from '../../services/auth-pool-service'
import { DisputesService } from '../../services/disputes-service'
import { ReadyService } from '../../services/ready-service'
import { AccumulationService } from '../../services/accumulation-service'
import { WorkReportService } from '../../services/work-report-service'
import { PrivilegesService } from '../../services/privileges-service'
import { ServiceAccountService } from '../../services/service-account-service'
import { RecentHistoryService } from '../../services/recent-history-service'
import {
  bytesToHex,
  EventBusService,
  type Hex,
} from '@pbnjam/core'
import { SealKeyService } from '../../services/seal-key'
import { RingVRFProverWasm } from '@pbnjam/bandersnatch-vrf'
import { RingVRFVerifierWasm } from '@pbnjam/bandersnatch-vrf'
import { ClockService } from '../../services/clock-service'
import {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'
import { StatisticsService } from '../../services/statistics-service'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

describe('Genesis Round-Trip Encoding/Decoding', () => {
  const configService = new ConfigService('tiny')

  it('should compare genesis.json keyvals with block 1 pre_state keyvals after round-trip', async () => {
    const genesisJsonPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-test-vectors/traces/safrole/genesis.json',
    )

    const block1JsonPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-test-vectors/traces/safrole/00000001.json',
    )

    // Load genesis.json
    const genesisJson = JSON.parse(readFileSync(genesisJsonPath, 'utf-8'))
    console.log(`\n📋 Genesis JSON loaded:`)
    console.log(`  State root: ${genesisJson.state?.state_root}`)
    console.log(`  Keyvals count: ${genesisJson.state?.keyvals?.length || 0}`)

    // Load block 1 JSON
    const block1Json = JSON.parse(readFileSync(block1JsonPath, 'utf-8'))
    console.log(`\n📋 Block 1 JSON loaded:`)
    console.log(`  Pre-state root: ${block1Json.pre_state?.state_root}`)
    console.log(`  Pre-state keyvals count: ${block1Json.pre_state?.keyvals?.length || 0}`)
    console.log(`  Block header parent_state_root: ${block1Json.block?.header?.parent_state_root}`)

    // Initialize Ring VRF
    const srsFilePath = path.join(
      WORKSPACE_ROOT,
      'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
    )
    const ringProver = new RingVRFProverWasm(srsFilePath)
    const ringVerifier = new RingVRFVerifierWasm(srsFilePath)

    await ringProver.init()
    await ringVerifier.init()

    // Initialize services
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

    const initialValidators = genesisJson.header?.epoch_mark?.validators || []
    const validatorSetManager = new ValidatorSetManager({
      eventBusService,
      sealKeyService,
      ringProver,
      ticketService,
      configService,
      initialValidators: initialValidators.map((validator: any) => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
        bls: bytesToHex(new Uint8Array(144)),
        metadata: bytesToHex(new Uint8Array(128)),
      })),
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

    const hostFunctionRegistry = new HostFunctionRegistry(serviceAccountsService, configService)
    const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(configService)
    const accumulatePVM = new AccumulatePVM({
      hostFunctionRegistry,
      accumulateHostFunctionRegistry,
      configService: configService,
      entropyService: entropyService,
      pvmOptions: { gasCounter: 1_000_000n },
      traceSubfolder: 'safrole',
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

    const genesisManager = new NodeGenesisManager(configService, {
      genesisJsonPath,
    })

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
    await entropyService.start()
    await validatorSetManager.start()

    // Set state from genesis.json keyvals
    const genesisKeyvals = genesisJson.state?.keyvals || []
    console.log(`\n🔧 Setting state from genesis.json (${genesisKeyvals.length} keyvals)...`)
    const [setStateError] = stateService.setState(genesisKeyvals)
    if (setStateError) {
      throw new Error(`Failed to set state from genesis: ${setStateError.message}`)
    }

    // Generate state trie after setting genesis state
    const [trieError, generatedTrie] = stateService.generateStateTrie()
    if (trieError) {
      throw new Error(`Failed to generate state trie: ${trieError.message}`)
    }

    console.log(`\n📊 Generated State Trie:`)
    console.log(`  Keys count: ${Object.keys(generatedTrie).length}`)

    // Get state root
    const [stateRootError, computedStateRoot] = stateService.getStateRoot()
    if (stateRootError) {
      throw new Error(`Failed to get state root: ${stateRootError.message}`)
    }

    console.log(`\n🔍 State Root Comparison:`)
    console.log(`  Genesis state root: ${genesisJson.state?.state_root}`)
    console.log(`  Computed state root: ${computedStateRoot}`)
    console.log(`  Block 1 pre-state root: ${block1Json.pre_state?.state_root}`)
    console.log(`  Block 1 header parent_state_root: ${block1Json.block?.header?.parent_state_root}`)

    // Compare generated keyvals with block 1 pre_state keyvals
    const block1PreStateKeyvals = block1Json.pre_state?.keyvals || []
    console.log(`\n🔍 Keyval Comparison:`)
    console.log(`  Genesis keyvals: ${genesisKeyvals.length}`)
    console.log(`  Generated trie keys: ${Object.keys(generatedTrie).length}`)
    console.log(`  Block 1 pre_state keyvals: ${block1PreStateKeyvals.length}`)

    // Convert to maps for easier comparison
    const genesisKeyvalsMap = new Map<string, string>()
    for (const kv of genesisKeyvals) {
      genesisKeyvalsMap.set(kv.key, kv.value)
    }

    const generatedTrieMap = new Map<string, string>()
    for (const [key, value] of Object.entries(generatedTrie)) {
      generatedTrieMap.set(key, value)
    }

    const block1PreStateMap = new Map<string, string>()
    for (const kv of block1PreStateKeyvals) {
      block1PreStateMap.set(kv.key, kv.value)
    }

    // Find keys in genesis but not in generated trie
    const missingInGenerated: string[] = []
    for (const [key] of genesisKeyvalsMap.entries()) {
      if (!generatedTrieMap.has(key)) {
        missingInGenerated.push(key)
      }
    }

    // Find keys in generated trie but not in genesis
    const extraInGenerated: string[] = []
    for (const [key] of generatedTrieMap.entries()) {
      if (!genesisKeyvalsMap.has(key)) {
        extraInGenerated.push(key)
      }
    }

    // Find keys with different values between genesis and generated
    const differentValues: Array<{ key: string; genesisValue: string; generatedValue: string }> = []
    for (const [key, genesisValue] of genesisKeyvalsMap.entries()) {
      if (generatedTrieMap.has(key)) {
        const generatedValue = generatedTrieMap.get(key)!
        if (genesisValue !== generatedValue) {
          differentValues.push({ key, genesisValue, generatedValue })
        }
      }
    }

    // Compare generated trie with block 1 pre_state
    const missingInBlock1PreState: string[] = []
    for (const [key] of generatedTrieMap.entries()) {
      if (!block1PreStateMap.has(key)) {
        missingInBlock1PreState.push(key)
      }
    }

    const extraInBlock1PreState: string[] = []
    for (const [key] of block1PreStateMap.entries()) {
      if (!generatedTrieMap.has(key)) {
        extraInBlock1PreState.push(key)
      }
    }

    const differentFromBlock1PreState: Array<{ key: string; generatedValue: string; block1PreStateValue: string }> = []
    for (const [key, generatedValue] of generatedTrieMap.entries()) {
      if (block1PreStateMap.has(key)) {
        const block1PreStateValue = block1PreStateMap.get(key)!
        if (generatedValue !== block1PreStateValue) {
          differentFromBlock1PreState.push({ key, generatedValue, block1PreStateValue })
        }
      }
    }

    // Report findings
    console.log(`\n📊 Round-Trip Encoding/Decoding Analysis:`)
    console.log(`\n1. Genesis vs Generated Trie:`)
    console.log(`   Missing in generated: ${missingInGenerated.length}`)
    if (missingInGenerated.length > 0) {
      console.log(`   First 5 missing keys: ${missingInGenerated.slice(0, 5).join(', ')}`)
    }
    console.log(`   Extra in generated: ${extraInGenerated.length}`)
    if (extraInGenerated.length > 0) {
      console.log(`   First 5 extra keys: ${extraInGenerated.slice(0, 5).join(', ')}`)
    }
    console.log(`   Different values: ${differentValues.length}`)
    if (differentValues.length > 0) {
      console.log(`   First 3 different values:`)
      for (let i = 0; i < Math.min(3, differentValues.length); i++) {
        const { key, genesisValue, generatedValue } = differentValues[i]
        const genPreview = genesisValue.length > 60 ? genesisValue.substring(0, 60) + '...' : genesisValue
        const genTriePreview = generatedValue.length > 60 ? generatedValue.substring(0, 60) + '...' : generatedValue
        console.log(`     Key: ${key}`)
        console.log(`       Genesis:    ${genPreview} (${genesisValue.length} chars)`)
        console.log(`       Generated:  ${genTriePreview} (${generatedValue.length} chars)`)
      }
    }

    console.log(`\n2. Generated Trie vs Block 1 Pre-State:`)
    console.log(`   Missing in block 1 pre_state: ${missingInBlock1PreState.length}`)
    if (missingInBlock1PreState.length > 0) {
      console.log(`   First 5 missing keys: ${missingInBlock1PreState.slice(0, 5).join(', ')}`)
    }
    console.log(`   Extra in block 1 pre_state: ${extraInBlock1PreState.length}`)
    if (extraInBlock1PreState.length > 0) {
      console.log(`   First 5 extra keys: ${extraInBlock1PreState.slice(0, 5).join(', ')}`)
    }
    console.log(`   Different values: ${differentFromBlock1PreState.length}`)
    if (differentFromBlock1PreState.length > 0) {
      console.log(`   First 3 different values:`)
      for (let i = 0; i < Math.min(3, differentFromBlock1PreState.length); i++) {
        const { key, generatedValue, block1PreStateValue } = differentFromBlock1PreState[i]
        const genTriePreview = generatedValue.length > 60 ? generatedValue.substring(0, 60) + '...' : generatedValue
        const block1Preview = block1PreStateValue.length > 60 ? block1PreStateValue.substring(0, 60) + '...' : block1PreStateValue
        console.log(`     Key: ${key}`)
        console.log(`       Generated:  ${genTriePreview} (${generatedValue.length} chars)`)
        console.log(`       Block 1:    ${block1Preview} (${block1PreStateValue.length} chars)`)
      }
    }

    // Summary
    console.log(`\n✅ Round-trip analysis complete`)
    console.log(`   Genesis state root matches: ${computedStateRoot === genesisJson.state?.state_root ? '✅' : '❌'}`)
    console.log(`   Block 1 pre-state root matches: ${computedStateRoot === block1Json.pre_state?.state_root ? '✅' : '❌'}`)
    console.log(`   Block 1 header parent_state_root matches: ${computedStateRoot === block1Json.block?.header?.parent_state_root ? '✅' : '❌'}`)

    // Log all mismatches for debugging
    if (differentValues.length > 0 || differentFromBlock1PreState.length > 0) {
      console.log(`\n⚠️  Round-trip encoding/decoding issues detected!`)
      console.log(`   This indicates that decode/encode is not perfectly round-trip.`)
      console.log(`   The state root mismatch is likely caused by these value differences.`)
    }
  })
})

