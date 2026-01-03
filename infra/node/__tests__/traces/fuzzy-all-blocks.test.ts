/**
 * Genesis Parse Test
 *
 * Tests parsing of genesis.json files from test vectors using NodeGenesisManager
 */

import { config } from 'dotenv'
config() // Load environment variables from .env file

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
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
  Hex,
  hexToBytes,
} from '@pbnjam/core'
import {
  decodeRecent,
  setServiceStorageValue,
  setServicePreimageValue,
  setServiceRequestValue,
} from '@pbnjam/codec'
import { getTicketIdFromProof } from '@pbnjam/safrole'
import { SealKeyService } from '../../services/seal-key'
import { RingVRFProverWasm } from '@pbnjam/bandersnatch-vrf'
import { RingVRFVerifierWasm } from '@pbnjam/bandersnatch-vrf'
import {
  DEFAULT_JAM_VERSION,
  type Block,
  type BlockBody,
  type BlockHeader,
  type BlockTraceTestVector,
  type JamVersion,
  type ServiceAccount,
  type WorkReport,
} from '@pbnjam/types'
import { ClockService } from '../../services/clock-service'
import {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { BlockImporterService } from '../../services/block-importer-service'
import { AssuranceService } from '../../services/assurance-service'
import { GuarantorService } from '../../services/guarantor-service'
import { StatisticsService } from '../../services/statistics-service'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = path.join(__dirname, '../../../../')

// Helper function to parse CLI arguments or environment variable for starting block
// Usage: START_BLOCK=50 bun test ... OR bun test ... -- --start-block 50
function getStartBlock(): number {
  // Check environment variable first (most reliable with bun test)
  const envStartBlock = process.env.START_BLOCK
  if (envStartBlock) {
    const startBlock = Number.parseInt(envStartBlock, 10)
    if (!Number.isNaN(startBlock) && startBlock >= 1) {
      return startBlock
    }
  }
  
  // Fallback to CLI argument (requires -- separator with bun test)
  const args = process.argv.slice(2)
  const startBlockIndex = args.indexOf('--start-block')
  if (startBlockIndex !== -1 && startBlockIndex + 1 < args.length) {
    const startBlock = Number.parseInt(args[startBlockIndex + 1]!, 10)
    if (Number.isNaN(startBlock) || startBlock < 1) {
      throw new Error(`Invalid --start-block argument: ${args[startBlockIndex + 1]}. Must be a number >= 1`)
    }
    return startBlock
  }
  return 1 // Default to block 1 (genesis)
}

// Helper function to parse CLI arguments or environment variable for stopping block
// Usage: STOP_BLOCK=50 bun test ... to stop after processing block 50
function getStopBlock(): number | undefined {
  // Check environment variable
  const envStopBlock = process.env.STOP_BLOCK
  if (envStopBlock) {
    const stopBlock = Number.parseInt(envStopBlock, 10)
    if (!Number.isNaN(stopBlock) && stopBlock >= 1) {
      return stopBlock
    }
  }
  return undefined // No stop block by default
}

// Helper function to convert JSON work report to WorkReport type
function convertJsonReportToWorkReport(jsonReport: any): WorkReport {
  return {
    ...jsonReport,
    core_index: BigInt(jsonReport.core_index || 0),
    auth_gas_used: BigInt(jsonReport.auth_gas_used || 0),
    context: {
      ...jsonReport.context,
      lookup_anchor_slot: BigInt(jsonReport.context.lookup_anchor_slot || 0),
    },
    results: jsonReport.results.map((r: any) => ({
      ...r,
      service_id: BigInt(r.service_id || 0),
      accumulate_gas: BigInt(r.accumulate_gas || 0),
      refine_load: {
        ...r.refine_load,
        gas_used: BigInt(r.refine_load.gas_used || 0),
        imports: BigInt(r.refine_load.imports || 0),
        extrinsic_count: BigInt(r.refine_load.extrinsic_count || 0),
        extrinsic_size: BigInt(r.refine_load.extrinsic_size || 0),
        exports: BigInt(r.refine_load.exports || 0),
      },
    })),
  }
}

// Helper function to convert JSON block to Block type
export function convertJsonBlockToBlock(jsonBlock: any): Block {
  const jsonHeader = jsonBlock.header
  const jsonExtrinsic = jsonBlock.extrinsic

  const blockHeader: BlockHeader = {
    parent: jsonHeader.parent,
    priorStateRoot: jsonHeader.parent_state_root,
    extrinsicHash: jsonHeader.extrinsic_hash,
    timeslot: BigInt(jsonHeader.slot),
    epochMark: jsonHeader.epoch_mark
      ? {
          entropyAccumulator: jsonHeader.epoch_mark.entropy,
          entropy1: jsonHeader.epoch_mark.tickets_entropy,
          validators: jsonHeader.epoch_mark.validators.map((validator: any) => ({
            bandersnatch: validator.bandersnatch,
            ed25519: validator.ed25519,
          })),
        }
      : null,
    winnersMark: jsonHeader.tickets_mark
      ? jsonHeader.tickets_mark.map((ticket: any) => ({
          id: ticket.id,
          entryIndex: BigInt(ticket.attempt),
        }))
      : null,
    offendersMark: jsonHeader.offenders_mark || [],
    authorIndex: BigInt(jsonHeader.author_index),
    vrfSig: jsonHeader.entropy_source,
    sealSig: jsonHeader.seal,
  }

  const blockBody: BlockBody = {
    tickets: jsonExtrinsic.tickets.map((ticket: any) => ({
      entryIndex: BigInt(ticket.attempt),
      proof: ticket.signature as Hex,
      id: getTicketIdFromProof(hexToBytes(ticket.signature as Hex)),
    })),
    preimages: (jsonExtrinsic.preimages || []).map((preimage: any) => ({
      requester: BigInt(preimage.requester),
      blob: preimage.blob,
    })),
    guarantees: (jsonExtrinsic.guarantees || []).map((guarantee: any) => ({
      report: convertJsonReportToWorkReport(guarantee.report),
      slot: BigInt(guarantee.slot),
      signatures: guarantee.signatures,
    })),
    assurances: jsonExtrinsic.assurances || [],
    disputes: jsonExtrinsic.disputes
      ? [
          {
            verdicts: jsonExtrinsic.disputes.verdicts.map((verdict: any) => ({
              target: verdict.target,
              age: BigInt(verdict.age),
              votes: verdict.votes.map((vote: any) => ({
                vote: vote.vote,
                index: BigInt(vote.index),
                signature: vote.signature,
              })),
            })),
            culprits: jsonExtrinsic.disputes.culprits,
            faults: jsonExtrinsic.disputes.faults,
          },
        ]
      : [
          {
            verdicts: [],
            culprits: [],
            faults: [],
          },
        ],
  }

  return {
    header: blockHeader,
    body: blockBody,
  }
}

// Helper function to parse JAM version from environment variable or string
// Format: "0.7.0", "0.7.2", etc.
function parseJamVersion(versionStr?: string): JamVersion {
  if (!versionStr) {
    return DEFAULT_JAM_VERSION
  }
  
  const parts = versionStr.split('.').map(s => Number.parseInt(s, 10))
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.warn(`⚠️  Invalid JAM version format: "${versionStr}", using default ${DEFAULT_JAM_VERSION.major}.${DEFAULT_JAM_VERSION.minor}.${DEFAULT_JAM_VERSION.patch}`)
    return DEFAULT_JAM_VERSION
  }
  
  return {
    major: parts[0]!,
    minor: parts[1]!,
    patch: parts[2]!,
  }
}

describe('Genesis Parse Tests', () => {
  const configService = new ConfigService('tiny')
  
  // Set JAM version from environment variable (GP_VERSION) or default to 0.7.2
  const gpVersion = process.env.GP_VERSION || process.env.JAM_VERSION
  const jamVersion = parseJamVersion(gpVersion)
  configService.jamVersion = jamVersion
  console.log(`📋 Using JAM version: ${jamVersion.major}.${jamVersion.minor}.${jamVersion.patch}${gpVersion ? ` (from ${process.env.GP_VERSION ? 'GP_VERSION' : 'JAM_VERSION'})` : ' (default)'}`)

  // Construct traces subfolder path with version
  // v0.7.1 has only 'fuzzy' directory and does NOT use 'traces/' subdirectory
  // v0.7.2+ has both 'fuzzy' and 'fuzzy_light' directories and uses 'traces/' subdirectory
  // This test uses 'fuzzy_light' for v0.7.2+ and 'fuzzy' for 0.7.1
  const versionString = `v${jamVersion.major}.${jamVersion.minor}.${jamVersion.patch}`

  describe('Safrole Genesis', () => {
    // Disable timeout for this long-running test (processes multiple blocks)
    // Set to 0 to disable timeout entirely (no timeout limit)
    it('should parse genesis.json from traces/fuzzy', async () => {
      const genesisJsonPath = path.join(
        WORKSPACE_ROOT,
        `submodules/jam-test-vectors/traces/fuzzy/genesis.json`,
      )

      const genesisManager = new NodeGenesisManager(configService, {
        genesisJsonPath,
      })

      const srsFilePath = path.join(
        WORKSPACE_ROOT,
        'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
      )
      const ringProver = new RingVRFProverWasm(srsFilePath)
      const ringVerifier = new RingVRFVerifierWasm(srsFilePath)

      await ringProver.init()
      await ringVerifier.init()

      // Verify genesis JSON was loaded
      const [error, genesisJson] = genesisManager.getGenesisJson()
      expect(error).toBeUndefined()
      expect(genesisJson).toBeDefined()

      if (!genesisJson) {
        throw new Error('Genesis JSON not loaded')
      }

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

      // Extract validators from genesis.json header
      const initialValidators = genesisJson.header?.epoch_mark?.validators || []

    const validatorSetManager = new ValidatorSetManager({
        eventBusService,
        sealKeyService,
        ringProver,
        ticketService,
        configService,
        initialValidators: initialValidators.map((validator) => ({
          bandersnatch: validator.bandersnatch,
          ed25519: validator.ed25519,
          bls: bytesToHex(new Uint8Array(144)), // Gray Paper: BLS key must be 144 bytes
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

      const statisticsService = new StatisticsService({
        eventBusService: eventBusService,
        configService: configService,
        clockService: clockService,
      })

      const serviceAccountsService = new ServiceAccountService({
        eventBusService,
        clockService,
        networkingService: null,
        preimageRequestProtocol: null,
      })

      const hostFunctionRegistry = new HostFunctionRegistry(serviceAccountsService, configService)
      const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(configService)
      // Only dump traces if DUMP_TRACES=true is set
      const shouldDumpTraces = process.env.DUMP_TRACES === 'true'
      const accumulatePVM = new AccumulatePVM({
        hostFunctionRegistry,
        accumulateHostFunctionRegistry,
        configService: configService,
        entropyService: entropyService,
        pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) },
        useWasm: false,
        traceSubfolder: shouldDumpTraces ? `fuzzy/${versionString}` : undefined,
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
      recentHistoryService.start()

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
        stateService: stateService,
        accumulationService: accumulatedService,
      })

      const blockImporterService = new BlockImporterService({
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

      // Set validatorSetManager on sealKeyService (needed for fallback key generation)
      sealKeyService.setValidatorSetManager(validatorSetManager)
      // SealKeyService epoch transition callback is registered in constructor
      // ValidatorSetManager should be constructed before SealKeyService to ensure
      // its handleEpochTransition runs first (updating activeSet' before seal key calculation)

      // Start all services
      // Note: EntropyService and ValidatorSetManager register their callbacks in constructors,
      // so they work without explicit start(), but we start them for consistency
      const [entropyStartError] = await entropyService.start()
      expect(entropyStartError).toBeUndefined()
      
      const [validatorSetStartError] = await validatorSetManager.start()
      expect(validatorSetStartError).toBeUndefined()
      
      const [startError] = await blockImporterService.start()
      expect(startError).toBeUndefined()

      // Helper function to convert JSON block to Block type
      const convertJsonBlockToBlock = (jsonBlock: any): Block => {
        const jsonHeader = jsonBlock.header
        const jsonExtrinsic = jsonBlock.extrinsic

        const blockHeader: BlockHeader = {
          parent: jsonHeader.parent,
          priorStateRoot: jsonHeader.parent_state_root,
          extrinsicHash: jsonHeader.extrinsic_hash,
          timeslot: BigInt(jsonHeader.slot),
          epochMark: jsonHeader.epoch_mark
            ? {
                entropyAccumulator: jsonHeader.epoch_mark.entropy,
                entropy1: jsonHeader.epoch_mark.tickets_entropy,
                validators: jsonHeader.epoch_mark.validators.map((validator: any) => ({
                  bandersnatch: validator.bandersnatch,
                  ed25519: validator.ed25519,
                })),
              }
            : null,
          winnersMark: jsonHeader.tickets_mark
            ? jsonHeader.tickets_mark.map((ticket: any) => ({
                id: ticket.id,
                entryIndex: BigInt(ticket.attempt)
              }))
            : null,
          offendersMark: jsonHeader.offenders_mark || [],
          authorIndex: BigInt(jsonHeader.author_index),
          vrfSig: jsonHeader.entropy_source,
          sealSig: jsonHeader.seal,
        }

        const blockBody: BlockBody = {
          tickets: jsonExtrinsic.tickets.map((ticket: any) => ({
            entryIndex: BigInt(ticket.attempt),
            proof: ticket.signature as Hex,
            id: getTicketIdFromProof(hexToBytes(ticket.signature as Hex)),
          })),
          preimages: (jsonExtrinsic.preimages || []).map((preimage: any) => ({
            requester: BigInt(preimage.requester),
            blob: preimage.blob,
          })),
          guarantees: (jsonExtrinsic.guarantees || []).map((guarantee: any) => ({
            report: convertJsonReportToWorkReport(guarantee.report),
            slot: BigInt(guarantee.slot),
            signatures: guarantee.signatures,
          })),
          assurances: jsonExtrinsic.assurances || [],
          disputes: jsonExtrinsic.disputes
            ? [
                {
                  verdicts: jsonExtrinsic.disputes.verdicts.map((verdict: any) => ({
                    target: verdict.target,
                    age: BigInt(verdict.age),
                    votes: verdict.votes.map((vote: any) => ({
                      vote: vote.vote,
                      index: BigInt(vote.index),
                      signature: vote.signature,
                    })),
                  })),
                  culprits: jsonExtrinsic.disputes.culprits,
                  faults: jsonExtrinsic.disputes.faults,
                },
              ]
            : [
                {
                  verdicts: [],
                  culprits: [],
                  faults: [],
                },
              ],
        }

        return {
          header: blockHeader,
          body: blockBody,
        }
      }

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

      // Helper function to verify post-state
      const verifyPostState = (blockNumber: number, blockJsonData: BlockTraceTestVector) => {
        const [stateTrieError, stateTrie] = stateService.generateStateTrie()
        expect(stateTrieError).toBeUndefined()
        expect(stateTrie).toBeDefined()

        // Extract and print safrole state (chapter 4) - pendingSet and epochRoot only
        const safroleChapterIndex = 4
        const actualSafrole = stateService.getStateComponent(safroleChapterIndex)
        let expectedSafrole: any = null
        
        // Find safrole key in post_state
        for (const keyval of blockJsonData.post_state.keyvals) {
          const keyInfo = parseStateKeyForDebug(keyval.key as Hex)
          if ('chapterIndex' in keyInfo && keyInfo.chapterIndex === safroleChapterIndex) {
            const decoder = (stateService as any).stateTypeRegistry?.get(safroleChapterIndex)
            if (decoder) {
              const expectedBytes = hexToBytes(keyval.value as Hex)
              const [decodeError, decoded] = decoder(expectedBytes)
              if (!decodeError && decoded) {
                expectedSafrole = decoded.value
              }
            }
            break
          }
        }
        
        // Track which keys are checked vs missing
        let checkedKeys = 0
        let missingKeys = 0

        for (const keyval of blockJsonData.post_state.keyvals) {
          const expectedValue = stateTrie?.[keyval.key]
          
          // Check if key exists in generated state trie
          if (expectedValue === undefined) {
            // Key is missing from generated state trie - this is a failure
            missingKeys++
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

          // Key exists - check if value matches
          checkedKeys++
          if (keyval.value !== expectedValue) {
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
          expect(keyval.value).toBe(expectedValue)
        }

        // Log summary
        console.log(`\n✅ [Block ${blockNumber}] State Key Verification Summary:`)
        console.log(`  Total keys in post_state: ${blockJsonData.post_state.keyvals.length}`)
        console.log(`  Keys checked (found in state trie): ${checkedKeys}`)
        console.log(`  Keys missing (not in state trie): ${missingKeys}`)
        if (missingKeys > 0) {
          console.error(`  ⚠️  ${missingKeys} key(s) are missing from the generated state trie`)
        }

        // Compare state root with expected post_state
        const [stateRootError, computedStateRoot] = stateService.getStateRoot()
        expect(stateRootError).toBeUndefined()
        expect(computedStateRoot).toBeDefined()
        const expectedStateRoot = blockJsonData.post_state.state_root
        expect(computedStateRoot).toBe(expectedStateRoot)
      }

      // Process blocks sequentially
      // Support --start-block CLI argument to start from a specific block
      const startBlock = getStartBlock()
      const stopBlock = getStopBlock()
      if (startBlock > 1) {
        console.log(`\n🚀 Starting from block ${startBlock} (START_BLOCK=${startBlock})`)
      }
      if (stopBlock !== undefined) {
        console.log(`🛑 Will stop after block ${stopBlock} (STOP_BLOCK=${stopBlock})`)
      }

      let blockNumber = startBlock
      let hasMoreBlocks = true

      while (hasMoreBlocks) {
        const blockFileName = blockNumber.toString().padStart(8, '0') + '.json'
        const blockJsonPath = path.join(
          WORKSPACE_ROOT,
          `submodules/jam-test-vectors/traces/fuzzy/${blockFileName}`,
        )

        // Check if block file exists
        try {
          const blockJsonData: BlockTraceTestVector = JSON.parse(
            readFileSync(blockJsonPath, 'utf-8'),
          )

          console.log(`\n📦 Processing Block ${blockNumber}...`)

          // Only set pre-state for the starting block
          if (blockNumber === startBlock) {
            // Set pre_state from test vector FIRST
            // This ensures entropy3 and other state components match what was used to create the seal signature
            // Set pre-state from test vector

            if (blockJsonData.pre_state?.keyvals) {
              const [setStateError] = stateService.setState(
                blockJsonData.pre_state.keyvals,
              )
              
              fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-all-blocks.test.ts:1029',message:'After setState',data:{blockNumber:blockNumber,setStateError:setStateError?.message||'none',preStateKeyvalsCount:blockJsonData.pre_state.keyvals.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
              if (setStateError) {
                throw new Error(`Failed to set pre-state: ${setStateError.message}`)
              }
            } else {
              // Fallback to genesis state if pre_state is not available
              const [setStateError] = stateService.setState(
                genesisJson?.state?.keyvals ?? [],
              )
              if (setStateError) {
                throw new Error(`Failed to set genesis state: ${setStateError.message}`)
              }
            }
            
            // Initialize recent history service from pre-state beta chapter (key 0x03)
            // This ensures the MMR state (accoutBelt) is properly initialized from the pre-state
            const betaKeyval = blockJsonData.pre_state?.keyvals?.find(
              (kv: { key: string }) => kv.key === '0x03000000000000000000000000000000000000000000000000000000000000'
            )
            if (betaKeyval) {
              const betaData = hexToBytes(betaKeyval.value as Hex)
              const [decodeError, decodeResult] = decodeRecent(betaData)
              if (!decodeError && decodeResult) {
                console.log(`📂 Decoded recent history:`, {
                  historyLength: decodeResult.value.history?.length ?? 0,
                  peaks: decodeResult.value.accoutBelt?.peaks ?? [],
                  totalCount: decodeResult.value.accoutBelt?.totalCount?.toString() ?? '0',
                })
                recentHistoryService.setRecent(decodeResult.value)
                console.log(`📂 Loaded recent history from pre-state (totalCount: ${decodeResult.value.accoutBelt?.totalCount ?? 0})`)
              } else {
                console.warn(`⚠️  Failed to decode beta from pre-state:`, decodeError)
              }
            }
            
            // Note: stateService.setState already processes all chapters including:
            // - Chapter 4 (safrole): sets seal keys via sealKeyService.setSealKeys()
            // - Chapter 6 (entropy): sets entropy via entropyService.setEntropy()
            // So we don't need to manually load these here.
            // Just log what was loaded for debugging:
            const entropyState = entropyService.getEntropy()
            console.log(`📂 Entropy after setState:`, {
              accumulator: entropyState.accumulator?.slice(0, 20) + '...',
              entropy1: entropyState.entropy1?.slice(0, 20) + '...',
              entropy2: entropyState.entropy2?.slice(0, 20) + '...',
              entropy3: entropyState.entropy3?.slice(0, 20) + '...',
            })
            console.log(`📂 Seal keys after setState: ${sealKeyService.getSealKeys().length} keys`)

            // Deep compare generated state trie with pre-state keyvals

            
              const preStateKeyvals = blockJsonData.pre_state?.keyvals || []
              const [trieError, stateTrie] = stateService.generateStateTrie()
            
            fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-all-blocks.test.ts:1098',message:'After generateStateTrie',data:{blockNumber:blockNumber,trieError:trieError?.message||'none',stateTrieKeysCount:stateTrie?Object.keys(stateTrie).length:0,preStateKeyvalsCount:preStateKeyvals.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            expect(trieError).toBeUndefined()
            expect(stateTrie).toBeDefined()
            
            if (!stateTrie) {
              throw new Error('Failed to generate state trie')
            }

            // Build maps for comparison
              const preStateKeyvalsMap = new Map<string, string>()
              for (const kv of preStateKeyvals) {
                preStateKeyvalsMap.set(kv.key, kv.value)
              }
              const stateTrieMap = new Map<string, string>()
                for (const [key, value] of Object.entries(stateTrie)) {
                  stateTrieMap.set(key, value)
                }

              // Find keys in pre-state but not in state trie
              const missingInTrie: string[] = []
            const differentValues: Array<{key: string, expected: string, actual: string, chapterIndex?: number}> = []
            
              for (const [key, expectedValue] of preStateKeyvalsMap.entries()) {
                const actualValue = stateTrieMap.get(key)
                if (actualValue === undefined) {
                  missingInTrie.push(key)
                const keyBytes = hexToBytes(key as Hex)
                const firstByte = keyBytes[0]
                const isChapterKey = firstByte >= 1 && firstByte <= 16 && keyBytes.slice(1).every(b => b === 0)
                const chapterIndex = isChapterKey ? firstByte : (firstByte === 0xff ? 255 : 0)
                fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-all-blocks.test.ts:1120',message:'Missing key in state trie',data:{blockNumber:blockNumber,key:key,keyShort:key.substring(0,30)+'...',chapterIndex:chapterIndex,expectedValue:expectedValue.substring(0,40)+'...',expectedValueLength:expectedValue.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                } else if (actualValue !== expectedValue) {
                    const keyBytes = hexToBytes(key as Hex)
                    const firstByte = keyBytes[0]
                    const isChapterKey = firstByte >= 1 && firstByte <= 16 && keyBytes.slice(1).every(b => b === 0)
                    const chapterIndex = isChapterKey ? firstByte : (firstByte === 0xff ? 255 : 0)
                differentValues.push({key, expected: expectedValue, actual: actualValue, chapterIndex})
                fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-all-blocks.test.ts:1130',message:'Value mismatch',data:{blockNumber:blockNumber,key:key,keyShort:key.substring(0,30)+'...',chapterIndex:chapterIndex,expectedValue:expectedValue,actualValue:actualValue,expectedLength:expectedValue.length,actualLength:actualValue.length,expectedFirstBytes:expectedValue.substring(0,40),actualFirstBytes:actualValue.substring(0,40)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                  // #endregion
                }
              }

              // Find keys in state trie but not in pre-state
              const extraInTrie: string[] = []
              for (const key of stateTrieMap.keys()) {
                if (!preStateKeyvalsMap.has(key)) {
                  extraInTrie.push(key)
                const keyBytes = hexToBytes(key as Hex)
                const firstByte = keyBytes[0]
                const isChapterKey = firstByte >= 1 && firstByte <= 16 && keyBytes.slice(1).every(b => b === 0)
                const chapterIndex = isChapterKey ? firstByte : (firstByte === 0xff ? 255 : 0)
                fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fuzzy-all-blocks.test.ts:1145',message:'Extra key in state trie',data:{blockNumber:blockNumber,key:key,keyShort:key.substring(0,30)+'...',chapterIndex:chapterIndex,actualValue:stateTrieMap.get(key)?.substring(0,40)+'...',actualValueLength:stateTrieMap.get(key)?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
              }
            }

            // Calculate state root for comparison
            const [preStateRootError, preStateRoot] = stateService.getStateRoot()
            expect(preStateRootError).toBeUndefined()
            expect(preStateRoot).toBeDefined()

            // Log detailed summary
            if (missingInTrie.length > 0 || differentValues.length > 0 || extraInTrie.length > 0 || preStateRoot !== blockJsonData.block.header.parent_state_root) {
              console.error(`\n❌ [Block ${blockNumber}] State trie mismatch detected:`)
              console.error(`  Pre-state keyvals: ${preStateKeyvals.length}`)
              console.error(`  Generated trie keys: ${stateTrieMap.size}`)
              console.error(`  Missing keys: ${missingInTrie.length}`)
              console.error(`  Different values: ${differentValues.length}`)
              console.error(`  Extra keys: ${extraInTrie.length}`)
              console.error(`  State root: computed ${preStateRoot}, expected ${blockJsonData.block.header.parent_state_root}`)
              
              if (missingInTrie.length > 0) {
                console.error(`\n  Missing keys (first 10):`)
                for (const key of missingInTrie.slice(0, 10)) {
                  const keyInfo = parseStateKeyForDebug(key as Hex)
                  console.error(`    ${key} - ${'chapterIndex' in keyInfo ? `Chapter ${keyInfo.chapterIndex}` : JSON.stringify(keyInfo)}`)
                }
              }
              
              if (differentValues.length > 0) {
                console.error(`\n  Different values (first 10):`)
                for (const diff of differentValues.slice(0, 10)) {
                  const keyInfo = parseStateKeyForDebug(diff.key as Hex)
                  console.error(`    ${diff.key} - ${'chapterIndex' in keyInfo ? `Chapter ${keyInfo.chapterIndex}` : JSON.stringify(keyInfo)}`)
                  console.error(`      Expected: ${diff.expected.substring(0, 40)}... (${diff.expected.length} bytes)`)
                  console.error(`      Actual:   ${diff.actual.substring(0, 40)}... (${diff.actual.length} bytes)`)
                }
              }
              
              if (extraInTrie.length > 0) {
                console.error(`\n  Extra keys (first 10):`)
                for (const key of extraInTrie.slice(0, 10)) {
                  const keyInfo = parseStateKeyForDebug(key as Hex)
                  console.error(`    ${key} - ${'chapterIndex' in keyInfo ? `Chapter ${keyInfo.chapterIndex}` : JSON.stringify(keyInfo)}`)
                }
              }
            }

            // Verify state root matches
            if (preStateRoot !== blockJsonData.block.header.parent_state_root) {
              console.warn(
                `⚠️  [Block ${blockNumber}] Pre-state root doesn't match block header: computed ${preStateRoot}, expected ${blockJsonData.block.header.parent_state_root}`,
              )
            }
            
            // Fail test if there are mismatches
            expect(missingInTrie.length).toBe(0)
            expect(differentValues.length).toBe(0)
            expect(preStateRoot).toBe(blockJsonData.block.header.parent_state_root)
            // Note: Don't clear raw keyvals here - the block importer also needs them for prior state root validation
          } else {
            // For subsequent blocks, verify that the current state root matches the block's parent_state_root
            const [currentStateRootError, currentStateRoot] = stateService.getStateRoot()
            expect(currentStateRootError).toBeUndefined()
            expect(currentStateRoot).toBeDefined()

            if (currentStateRoot !== blockJsonData.block.header.parent_state_root) {
              console.warn(
                `⚠️  [Block ${blockNumber}] Current state root doesn't match block header's parent_state_root: computed ${currentStateRoot}, expected ${blockJsonData.block.header.parent_state_root}`,
              )
            }
          }

          // Convert JSON block to Block type
          const block = convertJsonBlockToBlock(blockJsonData.block)

          // Import the block
          const [importError] = await blockImporterService.importBlock(block)
          if (importError) {
            throw new Error(`Failed to import block ${blockNumber}: ${importError.message}, stack: ${importError.stack}`)
          }
          expect(importError).toBeUndefined()

          // Note: State trie generation uses the actual service state,
          // not raw keyvals from pre_state, so no clearing is needed

          // Verify post-state matches expected post_state from test vector
          verifyPostState(blockNumber, blockJsonData)

          console.log(`✅ Block ${blockNumber} imported and verified successfully`)

          // Check if we should stop after this block
          if (stopBlock !== undefined && blockNumber >= stopBlock) {
            console.log(`\n🛑 Stopping after block ${blockNumber} (STOP_BLOCK=${stopBlock})`)
            hasMoreBlocks = false
          }

          blockNumber++
        } catch (error: any) {
          // If file doesn't exist, stop processing
          if (error.code === 'ENOENT') {
            hasMoreBlocks = false
            console.log(`\n📋 Processed ${blockNumber - 1} blocks total`)
          } else {
            // Re-throw other errors
            throw error
          }
        }
      }
    }, { timeout: Number.MAX_SAFE_INTEGER }) // Effectively disable timeout - test processes multiple blocks and may take a very long time
  })
})

