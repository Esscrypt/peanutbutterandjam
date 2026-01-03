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
    const accumulatePVM = new AccumulatePVM({
      hostFunctionRegistry,
      accumulateHostFunctionRegistry,
      configService: configService,
      entropyService: entropyService,
      pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) },
      useWasm: false,
      traceSubfolder: `jam-conformance/${relativePathWithoutExt}`,
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


