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
import { decodeRecent } from '@pbnjam/codec'
import { getTicketIdFromProof } from '@pbnjam/safrole'
import { SealKeyService } from '../../services/seal-key'
import { RingVRFProverWasm } from '@pbnjam/bandersnatch-vrf'
import { RingVRFVerifierWasm } from '@pbnjam/bandersnatch-vrf'
import {
  type Block,
  type BlockBody,
  type BlockHeader,
  type BlockTraceTestVector,
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

// Helper function to convert JSON work report to WorkReport type
const convertJsonReportToWorkReport = (jsonReport: any): WorkReport => {
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
      if (error) {
        console.warn(`⚠️  Genesis JSON not found, using defaults: ${error.message}`)
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

      // Extract validators from genesis.json or trace data
      const initialValidators = genesisJson?.header?.epoch_mark?.validators || 
                                traceData.pre_state?.keyvals?.find((kv: any) => 
                                  kv.key === '0x08000000000000000000000000000000000000000000000000000000000000'
                                ) ? [] : []

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
      
      // Always dump traces to the trace-specific directory, preserving subdirectory structure
      // Include version in the path: jam-conformance/{version}/{relative_path}
      const accumulatePVM = new AccumulatePVM({
        hostFunctionRegistry,
        accumulateHostFunctionRegistry,
        configService: configService,
        entropyService: entropyService,
        pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) },
        useWasm: false,
        traceSubfolder: `jam-conformance/${JAM_CONFORMANCE_VERSION}/${relativePathWithoutExt}`,
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

      sealKeyService.setValidatorSetManager(validatorSetManager)

      // Start all services
      const [entropyStartError] = await entropyService.start()
      expect(entropyStartError).toBeUndefined()
      
      const [validatorSetStartError] = await validatorSetManager.start()
      expect(validatorSetStartError).toBeUndefined()
      
      const [startError] = await blockImporterService.start()
      expect(startError).toBeUndefined()

      // Set pre-state from trace
      if (traceData.pre_state?.keyvals) {
        const [setStateError] = stateService.setState(
          traceData.pre_state.keyvals,
          undefined,
          true, // useRawKeyvals
        )
        if (setStateError) {
          throw new Error(`Failed to set pre-state: ${setStateError.message}`)
        }
      } else if (genesisJson?.state?.keyvals) {
        const [setStateError] = stateService.setState(
          genesisJson.state.keyvals,
          undefined,
          true,
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

      // Clear raw keyvals mode after block import
      stateService.clearRawKeyvals()

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

