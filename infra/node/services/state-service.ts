/**
 * JAM State Service
 *
 * Implements the complete JAM global state management according to Gray Paper specifications.
 * Manages all 17 state components and their transition dependencies.
 *
 * Gray Paper Reference: Section "State Transition Dependency Graph" (equations 48-64)
 * State Definition: Equation (34) - thestate ≡ (authpool, recent, lastaccout, safrole, accounts, entropy, stagingset, activeset, previousset, reports, thetime, authqueue, privileges, disputes, activity, ready, accumulated)
 */

import {
  createStateTrie,
  decodeAccumulated,
  decodeActivity,
  decodeAuthpool,
  decodeAuthqueue,
  decodeDisputeState,
  decodeEntropy,
  decodeLastAccumulationOutputs,
  decodePrivileges,
  decodeReady,
  decodeRecent,
  decodeSafrole,
  decodeServiceAccount,
  decodeStateWorkReports,
  decodeTheTime,
  decodeValidatorSet,
} from '@pbnjam/codec'
import { bytesToHex, hexToBytes, logger, merklizeState } from '@pbnjam/core'
import type {
  Accumulated,
  Activity,
  AuthPool,
  AuthQueue,
  DecodingResult,
  Disputes,
  EntropyState,
  GlobalState,
  IGenesisManagerService,
  ParsedStateKey,
  Privileges,
  Ready,
  Recent,
  Reports,
  Safe,
  SafroleState,
  ServiceAccount,
  StateComponent,
  StateTrie,
  ValidatorPublicKeys,
} from '@pbnjam/types'
import {
  BaseService,
  type IStateService,
  safeError,
  safeResult,
} from '@pbnjam/types'
import type { Hex } from 'viem'
import type { AccumulationService } from './accumulation-service'
import type { AuthPoolService } from './auth-pool-service'
import type { AuthQueueService } from './auth-queue-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { DisputesService } from './disputes-service'
import type { EntropyService } from './entropy'
import type { NodeGenesisManager } from './genesis-manager'
import type { PrivilegesService } from './privileges-service'
import type { ReadyService } from './ready-service'
import type { RecentHistoryService } from './recent-history-service'
import type { SealKeyService } from './seal-key'
import type { ServiceAccountService } from './service-account-service'
import type { StatisticsService } from './statistics-service'
import type { TicketService } from './ticket-service'
import type { ValidatorSetManager } from './validator-set'
import type { WorkReportService } from './work-report-service'

/**
 * JAM State Service
 *
 * Manages the complete JAM global state according to Gray Paper specifications.
 * Delegates state management to specialized services for better modularity.
 */
export class StateService extends BaseService implements IStateService {
  private readonly stateTypeRegistry = new Map<
    number,
    (data: Uint8Array) => Safe<DecodingResult<unknown>>
  >()
  // Service delegates for state components

  private readonly configService: ConfigService
  private validatorSetManager: ValidatorSetManager
  private entropyService: EntropyService
  private ticketService: TicketService
  private authQueueService: AuthQueueService
  private authPoolService: AuthPoolService
  private statisticsService: StatisticsService
  private disputesService: DisputesService
  private readyService: ReadyService
  private accumulationService: AccumulationService
  private workReportService: WorkReportService
  private privilegesService: PrivilegesService
  private serviceAccountsService: ServiceAccountService
  private recentHistoryService: RecentHistoryService
  // private authService?: AuthService
  private genesisManagerService?: NodeGenesisManager
  private sealKeyService: SealKeyService
  private clockService: ClockService

  constructor(options: {
    validatorSetManager: ValidatorSetManager
    entropyService: EntropyService
    ticketService: TicketService
    authQueueService: AuthQueueService
    authPoolService: AuthPoolService
    disputesService: DisputesService
    readyService: ReadyService
    accumulationService: AccumulationService
    workReportService: WorkReportService
    privilegesService: PrivilegesService
    serviceAccountsService: ServiceAccountService
    recentHistoryService: RecentHistoryService
    configService: ConfigService
    genesisManagerService?: NodeGenesisManager
    sealKeyService: SealKeyService
    clockService: ClockService
    statisticsService: StatisticsService
  }) {
    super('state-service')
    this.configService = options.configService
    // C(s,h) keys are handled separately in setStateComponent
    // Map chapter indices to decoders (hardcoded according to Gray Paper)
    this.stateTypeRegistry.set(1, (data) =>
      decodeAuthpool(data, this.configService),
    ) // Chapter 1 - AuthPool (C(1))
    this.stateTypeRegistry.set(2, (data) =>
      decodeAuthqueue(data, this.configService),
    ) // Chapter 2 - AuthQueue (C(2))
    this.stateTypeRegistry.set(3, (data) => decodeRecent(data)) // Chapter 3 - Recent (C(3))
    this.stateTypeRegistry.set(4, (data) =>
      decodeSafrole(data, this.configService),
    ) // Chapter 4 - Safrole (C(4))
    this.stateTypeRegistry.set(5, (data) => decodeDisputeState(data)) // Chapter 5 - Disputes (C(5))
    this.stateTypeRegistry.set(6, (data) => decodeEntropy(data)) // Chapter 6 - Entropy (C(6))
    this.stateTypeRegistry.set(7, (data) =>
      decodeValidatorSet(data, this.configService),
    ) // Chapter 7 - StagingSet (C(7))
    this.stateTypeRegistry.set(8, (data) =>
      decodeValidatorSet(data, this.configService),
    ) // Chapter 8 - ActiveSet (C(8))
    this.stateTypeRegistry.set(9, (data) =>
      decodeValidatorSet(data, this.configService),
    ) // Chapter 9 - PreviousSet (C(9))
    this.stateTypeRegistry.set(10, (data) =>
      decodeStateWorkReports(data, this.configService),
    ) // Chapter 10 - Reports (C(10))
    this.stateTypeRegistry.set(11, (data) => decodeTheTime(data)) // Chapter 11 - TheTime (C(11))
    this.stateTypeRegistry.set(12, (data) =>
      decodePrivileges(data, this.configService, this.configService.jamVersion),
    ) // Chapter 12 - Privileges (C(12))
    this.stateTypeRegistry.set(13, (data) =>
      decodeActivity(data, this.configService, this.configService.jamVersion),
    ) // Chapter 13 - Activity (C(13))
    this.stateTypeRegistry.set(14, (data) =>
      decodeReady(data, this.configService),
    ) // Chapter 14 - Ready (C(14))
    this.stateTypeRegistry.set(15, (data) =>
      decodeAccumulated(data, this.configService),
    ) // Chapter 15 - Accumulated (C(15))
    this.stateTypeRegistry.set(16, (data) =>
      decodeLastAccumulationOutputs(data),
    ) // Chapter 16 - LastAccout (C(16))
    this.stateTypeRegistry.set(255, (data) =>
      decodeServiceAccount(data, this.configService.jamVersion),
    ) // Chapter 255 - Service Accounts (C(255, s))

    this.validatorSetManager = options.validatorSetManager
    this.entropyService = options.entropyService
    this.ticketService = options.ticketService
    this.authQueueService = options.authQueueService
    this.authPoolService = options.authPoolService
    this.statisticsService = options.statisticsService
    this.disputesService = options.disputesService
    this.readyService = options.readyService
    this.accumulationService = options.accumulationService
    this.workReportService = options.workReportService
    this.privilegesService = options.privilegesService
    this.serviceAccountsService = options.serviceAccountsService
    this.recentHistoryService = options.recentHistoryService
    this.genesisManagerService = options.genesisManagerService
    this.sealKeyService = options.sealKeyService
    this.clockService = options.clockService

    // Initialize state from genesis if available, otherwise start with empty state
    // This allows StateService to work without genesis (e.g., when using trace pre_state)
    if (this.genesisManagerService) {
      const [genesisHeaderError, genesisHeader] =
        this.genesisManagerService.getState()
      if (genesisHeaderError) {
        // Genesis not available - start with empty state
        // The state will be set from trace pre_state or other sources
        this.setState([])
      } else {
        this.setState(genesisHeader.keyvals)
      }
    } else {
      // No genesis manager - start with empty state
      // The state will be set from trace pre_state or Initialize message
      this.setState([])
    }
  }

  /**
   * Get genesis manager service
   */
  getGenesisManager(): IGenesisManagerService | undefined {
    return this.genesisManagerService ?? undefined
  }

  /**
   * Get specific state component by merklization chapter index
   * Delegates to appropriate service if available, otherwise returns from local state
   *
   * Gray Paper merklization.tex - State serialization T(σ):
   * T(σ) ≡ {
   *   C(1) ↦ encode{authpool},
   *   C(2) ↦ encode{authqueue},
   *   C(3) ↦ encode{recenthistory, mmrencode{accoutbelt}},
   *   C(4) ↦ encode{pendingset, epochroot, discriminator, sealtickets, var{ticketaccumulator}},
   *   C(5) ↦ encode{var{goodset}, var{badset}, var{wonkyset}, var{offenders}},
   *   C(6) ↦ encode{entropy},
   *   C(7) ↦ encode{stagingset},
   *   C(8) ↦ encode{activeset},
   *   C(9) ↦ encode{previousset},
   *   C(10) ↦ encode{sequence of maybe{(workreport, encode[4]{timestamp})}},
   *   C(11) ↦ encode[4]{thetime},
   *   C(12) ↦ encode{encode[4]{manager, assigners, delegator, registrar}, alwaysaccers},
   *   C(13) ↦ encode{encode[4]{valstatsaccumulator, valstatsprevious}, corestats, servicestats},
   *   C(14) ↦ encode{ready work reports with nested structure},
   *   C(15) ↦ encode{sequence of var{accumulated}},
   *   C(16) ↦ encode{var{sequence of (encode[4]{s}, encode{h})}},
   *   C(255, s) ↦ encode{service account data for service s}
   * }
   *
   * Reference: graypaper/text/merklization.tex equation (21-112)
   *
   * This function uses merklization chapter indices (C(1) through C(16) and C(255)):
   * C(1) = authpool (α)
   * C(2) = authqueue (χ)
   * C(3) = recent (β) - recenthistory + accoutbelt
   * C(4) = safrole (γ) - pendingset, epochroot, discriminator, sealtickets, ticketaccumulator
   * C(5) = disputes (ψ) - goodset, badset, wonkyset, offenders
   * C(6) = entropy (ε)
   * C(7) = stagingset (ι)
   * C(8) = activeset (κ)
   * C(9) = previousset (λ)
   * C(10) = reports (ρ)
   * C(11) = thetime (τ)
   * C(12) = privileges
   * C(13) = activity (π)
   * C(14) = ready (ω)
   * C(15) = accumulated (ξ)
   * C(16) = lastaccout (θ)
   * C(255, s) = accounts (δ) - service-specific, handled separately
   */
  getStateComponent(chapterIndex: number, serviceId?: bigint): StateComponent {
    switch (chapterIndex) {
      case 0:
        return this.serviceAccountsService.getServiceAccountKeyvals(serviceId!)
      // C(1) = authpool (α) - Core authorization requirements
      case 1:
        return this.authPoolService.getAuthPool()

      // C(2) = authqueue (χ) - Queued core authorizations
      case 2:
        return this.authQueueService.getAuthQueue()

      // C(3) = recent (β) - Recent blocks and accumulation outputs
      case 3:
        return this.recentHistoryService.getRecent()

      // C(4) = safrole (γ) - Consensus protocol internal state
      case 4: {
        // Use stored epochRoot from Initialize message if available, otherwise compute it
        // This ensures we match the fuzzer's expected state root
        const epochRoot =
          this.validatorSetManager.getStoredEpochRoot() ??
          this.validatorSetManager.getEpochRoot()

        return {
          pendingSet: this.validatorSetManager.getPendingValidators(),
          epochRoot: epochRoot,
          sealTickets: this.sealKeyService.getSealKeys(),
          ticketAccumulator: this.ticketService.getTicketAccumulator(),
        }
      }

      // C(5) = disputes (ψ) - Judgments on work-reports and validators
      case 5:
        return this.disputesService.getDisputesState()

      // C(6) = entropy (ε) - On-chain randomness accumulator
      case 6:
        return this.entropyService.getEntropy()

      // C(7) = stagingset (ι) - Validators queued for next epoch
      case 7:
        return this.validatorSetManager.getStagingValidators()

      // C(8) = activeset (κ) - Currently active validators
      case 8:
        return this.validatorSetManager.getActiveValidators()

      // C(9) = previousset (λ) - Previous epoch validators
      case 9:
        return this.validatorSetManager.getPreviousValidators()

      // C(10) = reports (ρ) - Work reports awaiting availability assurance
      case 10:
        return this.workReportService.getPendingReports()

      // C(11) = thetime (τ) - Most recent block's timeslot index
      case 11:
        return this.clockService.getLatestReportedBlockTimeslot()

      // C(12) = privileges - Services with special privileges
      case 12:
        return this.privilegesService.getPrivileges()

      // C(13) = activity (π) - Validator performance statistics
      case 13:
        return this.statisticsService.getActivity()

      // C(14) = ready (ω) - Reports ready for accumulation
      case 14:
        return this.readyService.getReady()

      // C(15) = accumulated (ξ) - Recently accumulated work-packages
      case 15:
        return this.accumulationService.getAccumulated()

      // C(16) = lastaccout (θ) - Most recent accumulation result
      case 16:
        return this.accumulationService.getLastAccumulationOutputs()

      // C(255, s) = accounts (δ) - Service accounts (handled separately per service)
      case 255: {
        if (serviceId === undefined) {
          throw new Error('Service ID is required for chapter 255')
        }
        const [error, accountCore] =
          this.serviceAccountsService.getServiceAccountCore(serviceId)
        if (error) {
          throw new Error('Failed to get service account core')
        }
        return accountCore
      }
    }

    throw new Error(`State component ${chapterIndex} not found`)
  }
  /**
   * Set state component by merklization chapter index
   * Delegates to appropriate service if available, otherwise stores in local state
   *
   * Gray Paper merklization.tex - State serialization T(σ):
   * T(σ) ≡ {
   *   C(1) ↦ encode{authpool},
   *   C(2) ↦ encode{authqueue},
   *   C(3) ↦ encode{recenthistory, mmrencode{accoutbelt}},
   *   C(4) ↦ encode{pendingset, epochroot, discriminator, sealtickets, var{ticketaccumulator}},
   *   C(5) ↦ encode{var{goodset}, var{badset}, var{wonkyset}, var{offenders}},
   *   C(6) ↦ encode{entropy},
   *   C(7) ↦ encode{stagingset},
   *   C(8) ↦ encode{activeset},
   *   C(9) ↦ encode{previousset},
   *   C(10) ↦ encode{sequence of maybe{(workreport, encode[4]{timestamp})}},
   *   C(11) ↦ encode[4]{thetime},
   *   C(12) ↦ encode{encode[4]{manager, assigners, delegator, registrar}, alwaysaccers},
   *   C(13) ↦ encode{encode[4]{valstatsaccumulator, valstatsprevious}, corestats, servicestats},
   *   C(14) ↦ encode{ready work reports with nested structure},
   *   C(15) ↦ encode{sequence of var{accumulated}},
   *   C(16) ↦ encode{var{sequence of (encode[4]{s}, encode{h})}},
   *   C(255, s) ↦ encode{service account data for service s}
   * }
   *
   * Reference: graypaper/text/merklization.tex equation (21-112)
   *
   * This function uses merklization chapter indices (C(1) through C(16) and C(255)):
   * C(1) = authpool (α)
   * C(2) = authqueue (χ)
   * C(3) = recent (β) - recenthistory + accoutbelt
   * C(4) = safrole (γ) - pendingset, epochroot, discriminator, sealtickets, ticketaccumulator
   * C(5) = disputes (ψ) - goodset, badset, wonkyset, offenders
   * C(6) = entropy (ε)
   * C(7) = stagingset (ι)
   * C(8) = activeset (κ)
   * C(9) = previousset (λ)
   * C(10) = reports (ρ)
   * C(11) = thetime (τ)
   * C(12) = privileges
   * C(13) = activity (π)
   * C(14) = ready (ω)
   * C(15) = accumulated (ξ)
   * C(16) = lastaccout (θ)
   * C(255, s) = accounts (δ) - service-specific, handled separately
   */
  setStateComponent(
    chapterIndex: number,
    value: StateComponent,
    keyval: Record<Hex, Hex>,
    serviceId: bigint | undefined,
  ): void {
    switch (chapterIndex) {
      case 0: {
        if (serviceId === undefined) {
          throw new Error('Service ID is required for C(s,h) keys')
        }

        this.serviceAccountsService.setServiceAccountKeyvals(serviceId!, keyval)

        break
      }
      // C1) = authpool (α) - Core authorization requirements
      case 1:
        this.authPoolService.setAuthPool(value as AuthPool)
        break

      // C(2) = authqueue (χ) - Queued core authorizations
      case 2:
        this.authQueueService.setAuthQueue(value as AuthQueue)
        break

      // C(3) = recent (β) - Recent blocks and accumulation outputs
      case 3:
        this.recentHistoryService.setRecent(value as Recent)
        break

      // C(4) = safrole (γ) - Consensus protocol internal state
      case 4:
        {
          const safroleState = value as SafroleState
          this.validatorSetManager.setPendingSet(safroleState.pendingSet)
          this.validatorSetManager.setEpochRoot(safroleState.epochRoot)
          this.ticketService.setTicketAccumulator(
            safroleState.ticketAccumulator,
          )
          this.sealKeyService.setSealKeys(safroleState.sealTickets ?? [])
        }
        break

      // C(5) = disputes (ψ) - Judgments on work-reports and validators
      case 5:
        this.disputesService.setDisputesState(value as Disputes)
        break

      // C(6) = entropy (ε) - On-chain randomness accumulator
      case 6:
        this.entropyService.setEntropy(value as EntropyState)
        break

      // C(7) = stagingset (ι) - Validators queued for next epoch
      case 7:
        this.validatorSetManager.setStagingSet(value as ValidatorPublicKeys[])
        break

      // C(8) = activeset (κ) - Currently active validators
      case 8:
        this.validatorSetManager.setActiveSet(value as ValidatorPublicKeys[])
        break

      // C(9) = previousset (λ) - Previous epoch validators
      case 9:
        this.validatorSetManager.setPreviousSet(value as ValidatorPublicKeys[])
        break

      // C(10) = reports (ρ) - Work reports awaiting availability assurance
      case 10: {
        // Skip validation during state initialization - thetime (Chapter 11) might not be set yet
        const [setPendingReportsError] =
          this.workReportService.setPendingReports(value as Reports, true)
        if (setPendingReportsError) {
          throw new Error(
            `Failed to set pending reports: ${setPendingReportsError.message}`,
          )
        }
        break
      }

      // C(11) = thetime (τ) - Most recent block's timeslot index
      case 11:
        this.clockService.setLatestReportedBlockTimeslot(value as bigint)
        break

      // C(12) = privileges - Services with special privileges
      case 12:
        this.privilegesService.setPrivileges(value as Privileges)
        break

      // C(13) = activity (π) - Validator performance statistics
      case 13:
        this.statisticsService.setActivity(value as Activity)
        break

      // C(14) = ready (ω) - Reports ready for accumulation
      case 14:
        this.readyService.setReady(value as Ready)
        break

      // C(15) = accumulated (ξ) - Recently accumulated work-packages
      case 15:
        this.accumulationService.setAccumulated(value as Accumulated)
        break

      // C(16) = lastaccout (θ) - Most recent accumulation result
      case 16: {
        // Decoder returns LastAccumulationOutput[] which is { serviceId, hash }[]
        // Convert to [bigint, Hex][] tuples expected by setLastAccumulationOutputs
        const decoded = value as unknown as { serviceId: bigint; hash: Hex }[]
        const tuples: [bigint, Hex][] = decoded.map((item) => [
          item.serviceId,
          item.hash,
        ])
        this.accumulationService.setLastAccumulationOutputs(tuples)
        break
      }

      // C(255, s) = accounts (δ) - Service accounts (handled separately per service)
      case 255: {
        if (serviceId === undefined) {
          throw new Error('Service ID is required for chapter 255')
        }
        this.serviceAccountsService.setServiceAccountCore(
          BigInt(serviceId),
          value as ServiceAccount,
        )
        break
      }

      default:
        logger.warn(`State component ${chapterIndex} not found`)
        break
    }
  }

  /**
   * Clear all state before loading a new state (e.g., when switching forks)
   *
   * According to Gray Paper, when switching between forks, the entire state
   * must be reset, not merged. This method clears all service accounts and
   * resets other stateful services to prevent state leakage between forks.
   *
   * Note: Most services are "replaced" by setState() which calls setters that
   * overwrite their internal state. Only services with Map/Set collections that
   * aren't fully replaced need explicit clearing here.
   */
  clearState(): void {
    // Clear service accounts - this is critical for fork switching
    this.serviceAccountsService.clearAllServiceAccounts()

    // Clear pending work reports - these can accumulate from failed block attempts
    this.workReportService.clearPendingReports()
  }

  /**
   * Set state from keyvals
   * @param keyvals - Array of key-value pairs
   */
  setState(keyvals: { key: Hex; value: Hex }[]): Safe<void> {
    // Track all input keyvals and which ones are processed
    const totalKeyvals = keyvals.length
    const processedKeys = new Set<Hex>()
    const unprocessedKeyvals: Array<{ key: Hex; value: Hex; reason: string }> =
      []

    // Process keyvals in the order they appear (no sorting)
    // This preserves the original order and avoids overwriting values incorrectly
    // Note: We still need to ensure service accounts (C(255, s)) exist before setting C(s, h) keyvals
    // But since setServiceAccountKeyvals merges, this should be safe
    for (const keyval of keyvals) {
      const [stateKeyError, parsedStateKey] = this.parseStateKey(keyval.key)

      if (stateKeyError) {
        unprocessedKeyvals.push({
          key: keyval.key,
          value: keyval.value,
          reason: `parseStateKey error: ${stateKeyError.message}`,
        })
        continue
      }

      if (!parsedStateKey) {
        unprocessedKeyvals.push({
          key: keyval.key,
          value: keyval.value,
          reason: 'parseStateKey returned null/undefined',
        })
        continue
      }

      const keyvalRecord: Record<Hex, Hex> = {
        [keyval.key]: keyval.value,
      }

      const [parsedValueError, parsedValue] = this.parseStateValue(
        keyval.value,
        parsedStateKey,
      )
      if (parsedValueError) {
        unprocessedKeyvals.push({
          key: keyval.key,
          value: keyval.value,
          reason: `parseStateValue error: ${parsedValueError.message}`,
        })
        // Continue processing other keyvals instead of returning early
        continue
      }
      const serviceId =
        'serviceId' in parsedStateKey ? parsedStateKey.serviceId : undefined

      // Instrumentation: log when the known mismatch state key is written (C(s,h) keyvals)
      const STATE_KEY_INSTRUMENT =
        '0xa129b72c68d16e40bc50d602526f4b46e8aca90eb8c77c165b6497cae7625f' as Hex
      if (keyval.key === STATE_KEY_INSTRUMENT) {
        logger.info(
          '[StateService] setState: writing instrumented C(s,h) key',
          {
            key: keyval.key,
            value: keyval.value,
            serviceId: serviceId?.toString(),
            chapterIndex: parsedStateKey.chapterIndex,
          },
        )
      }

      // For C(255, s) keys, serviceId is required and should be present
      try {
        this.setStateComponent(
          parsedStateKey.chapterIndex,
          parsedValue,
          keyvalRecord,
          serviceId,
        )
        processedKeys.add(keyval.key)
      } catch (error) {
        unprocessedKeyvals.push({
          key: keyval.key,
          value: keyval.value,
          reason: `setStateComponent error: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
    }

    // Log unprocessed keyvals if any
    if (unprocessedKeyvals.length > 0) {
      logger.warn(
        `[StateService] setState: ${unprocessedKeyvals.length} of ${totalKeyvals} keyvals were not processed`,
        {
          totalKeyvals,
          processedCount: processedKeys.size,
          unprocessedCount: unprocessedKeyvals.length,
          unprocessedKeyvals: unprocessedKeyvals.slice(0, 10), // Log first 10
        },
      )

      // Log details for each unprocessed keyval
      for (const unprocessed of unprocessedKeyvals) {
        logger.warn(
          `[StateService] Unprocessed keyval: ${unprocessed.key.substring(0, 20)}... (reason: ${unprocessed.reason})`,
        )
      }
    }

    return safeResult(undefined)
  }

  /**
   * Generate state trie from current state
   *
   * Creates a complete state trie according to Gray Paper merklization specification.
   * This is used for:
   * - State root calculation
   * - Merkle proof generation
   * - State synchronization
   * - Block header commitment
   */
  generateStateTrie(): Safe<StateTrie> {
    const globalState: GlobalState = {
      authpool: this.authPoolService.getAuthPool(),
      recent: this.recentHistoryService.getRecent(),
      lastAccumulationOutput:
        this.accumulationService.getLastAccumulationOutputs(),
      safrole: {
        pendingSet: this.validatorSetManager.getPendingValidators(),
        // Use stored epochRoot from Initialize message if available, otherwise compute it
        // This ensures we match the fuzzer's expected state root
        epochRoot:
          this.validatorSetManager.getStoredEpochRoot() ??
          this.validatorSetManager.getEpochRoot(),
        sealTickets: this.sealKeyService.getSealKeys(),
        ticketAccumulator: this.ticketService.getTicketAccumulator(),
      },
      accounts: this.serviceAccountsService.getServiceAccounts(),
      entropy: this.entropyService.getEntropy(),
      stagingset: this.validatorSetManager.getStagingValidators(),
      activeset: this.validatorSetManager.getActiveValidators(),
      previousset: this.validatorSetManager.getPreviousValidators(),
      reports: this.workReportService.getPendingReports(),
      thetime: this.clockService.getLatestReportedBlockTimeslot(),
      authqueue: this.authQueueService.getAuthQueue(),
      privileges: this.privilegesService.getPrivileges(),
      disputes: this.disputesService.getDisputesState(),
      activity: this.statisticsService.getActivity(),
      ready: this.readyService.getReady(),
      accumulated: this.accumulationService.getAccumulated(),
    }

    const [trieError, stateTrie] = createStateTrie(
      globalState,
      this.configService,
      this.configService.jamVersion,
    )

    if (trieError) {
      return safeError(trieError)
    }

    return safeResult(stateTrie)
  }

  /**
   * Get current state root hash
   *
   * Calculates the state root hash from the current state trie.
   * This represents the commitment to the current state and is used in block headers.
   */
  getStateRoot(): Safe<Hex> {
    const [trieError, stateTrie] = this.generateStateTrie()
    if (trieError) {
      return safeError(trieError)
    }

    // Calculate Merkle trie root from state trie
    // This is a simplified implementation - in production, use a proper Merkle trie library
    const stateRoot = this.calculateMerkleRoot(stateTrie)

    return safeResult(stateRoot)
  }

  /**
   * Query state trie value by key
   *
   * Looks up a value in the current state trie using a 31-byte state key.
   * This is the fundamental method for querying any state data.
   *
   * @param stateKey - 31-byte state key (as hex string)
   * @returns State value if found, undefined if not found
   */
  getStateTrieValue(stateKey: Hex): Safe<Hex | undefined> {
    const [trieError, stateTrie] = this.generateStateTrie()
    if (trieError) {
      return safeError(trieError)
    }

    // Normalize the key format
    const normalizedKey = stateKey.startsWith('0x') ? stateKey : `0x${stateKey}`

    const value = (stateTrie as Record<string, string>)[normalizedKey]
    return safeResult(value as Hex | undefined)
  }

  /**
   * Parse a state key to determine which state component it represents
   *
   * Gray Paper Reference: merklization.tex equation (10-16)
   * C(i) = ⟨i, 0, 0, ...⟩ for simple chapter indices
   * C(255, s) = ⟨255, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩ where n = encode[4](s)
   * C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, ...⟩ where n = encode[4](s), a = blake(h)
   *
   * For C(s, h) keys, the key type cannot be determined from the key alone.
   * Use determineKeyType() to determine the type.
   *
   * @param keyHex - Hex string representing the state key
   * @returns Parsed state key with type-safe discriminated union
   */
  /**
   * Parse state key to extract chapter index and other information
   * Public method for debugging and testing
   */
  public parseStateKey(keyHex: Hex): Safe<ParsedStateKey> {
    // Remove 0x prefix and convert to bytes
    const keyBytes = hexToBytes(keyHex)

    if (keyBytes.length !== 31) {
      return safeError(new Error('Invalid state key length'))
    }

    const firstByte = keyBytes[0]

    // Check if this is a C(i) key (simple chapter index)
    // Gray Paper: C(i) = ⟨i, 0, 0, ...⟩ where i ∈ {1, 2, ..., 16}
    // Valid chapter indices are 1-16 (and 255, already handled above)
    if (firstByte >= 1 && firstByte <= 16) {
      // Check if remaining bytes are all zeros (C(i) pattern)
      let allZeros = true
      for (let i = 1; i < keyBytes.length; i++) {
        if (keyBytes[i] !== 0) {
          allZeros = false
          break
        }
      }
      if (allZeros) {
        return safeResult({ chapterIndex: firstByte })
      }
    }

    if (firstByte === 0xff) {
      // Could be C(255, s) or C(s, h) where s starts with 0xff
      // Gray Paper: C(255, s) = ⟨255, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩
      // where n = encode[4](s), service ID in bytes 1, 3, 5, 7
      // The distinguishing feature is that bytes 2, 4, 6 are zeros for C(255, s)
      const isC255 = keyBytes[2] === 0 && keyBytes[4] === 0 && keyBytes[6] === 0

      if (isC255) {
        // Chapter 255 - Service Accounts
        const serviceId = this.parseServiceId(keyBytes)
        return safeResult({ chapterIndex: 255, serviceId })
      }
      // Otherwise, fall through to C(s, h) handling below
    }

    // This could be a C(s, h) key - extract service ID from bytes 0, 2, 4, 6
    // Note: Service ID 0 is valid, so firstByte === 0 is a valid C(s, h) key
    const serviceId = this.parseServiceIdFromCshKey(keyBytes)

    // Always return the service ID (even if it's 0) - it's a valid C(s, h) key
    return safeResult({ chapterIndex: 0, serviceId }) // Use 0 as indicator for C(s, h)
  }

  /**
   * Parse service ID from service account key (C(255, s))
   *
   * Gray Paper: C(255, s) = ⟨255, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩
   * Service ID is in bytes 1, 3, 5, 7 (interleaved with zeros)
   *
   * @param keyBytes - 31-byte state key
   * @returns Service ID as bigint
   */
  private parseServiceId(keyBytes: Uint8Array): bigint {
    // Service ID is encoded in bytes 1, 3, 5, 7 (every other byte starting from 1)
    // Gray Paper: C(255, s) = ⟨255, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩
    // where n = encode[4](s) in little-endian format
    const serviceIdBytes = new Uint8Array(4)
    serviceIdBytes[0] = keyBytes[1] // n₀
    serviceIdBytes[1] = keyBytes[3] // n₁
    serviceIdBytes[2] = keyBytes[5] // n₂
    serviceIdBytes[3] = keyBytes[7] // n₃

    // Convert to bigint (little-endian, matching createStateKey encoding)
    const view = new DataView(serviceIdBytes.buffer)
    return BigInt(view.getUint32(0, true))
  }

  /**
   * Parse service ID from C(s, h) key (storage/preimage/request)
   *
   * Gray Paper: C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
   * Service ID is in bytes 0, 2, 4, 6 (interleaved with Blake hash)
   *
   * @param keyBytes - 31-byte state key
   * @returns Service ID as bigint, or null if not a valid C(s, h) key
   */
  private parseServiceIdFromCshKey(keyBytes: Uint8Array): bigint | null {
    // Service ID is encoded in bytes 0, 2, 4, 6 (every other byte starting from 0)
    // Gray Paper: C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
    // where n = encode[4](s) in little-endian format
    const serviceIdBytes = new Uint8Array(4)
    serviceIdBytes[0] = keyBytes[0] // n₀
    serviceIdBytes[1] = keyBytes[2] // n₁
    serviceIdBytes[2] = keyBytes[4] // n₂
    serviceIdBytes[3] = keyBytes[6] // n₃

    // Convert to bigint (little-endian, matching createStateKey encoding)
    const view = new DataView(serviceIdBytes.buffer)
    return BigInt(view.getUint32(0, true))
  }

  /**
   * Parse state value based on component type
   *
   * @param component - State component name
   * @param valueHex - Hex string representing the encoded value
   * @returns Parsed value or null if parsing fails
   */
  private parseStateValue(
    valueHex: Hex,
    parsedStateKey: Extract<ParsedStateKey, { chapterIndex: number }>,
  ): Safe<StateComponent> {
    if (parsedStateKey.chapterIndex === 0) {
      return safeResult(valueHex)
    }
    const decoder = this.stateTypeRegistry.get(parsedStateKey.chapterIndex)

    if (!decoder) {
      return safeError(new Error('No decoder found for chapter index'))
    }

    const data = hexToBytes(valueHex)
    const [error, result] = decoder(data)

    if (error) {
      return safeError(new Error('Failed to decode state value'))
    }

    return safeResult(result.value as StateComponent)
  }

  /**
   * Calculate Merkle root from state trie
   *
   * Implements Gray Paper merklization algorithm using binary Patricia Merkle Trie.
   *
   * Gray Paper Reference: merklization.tex section D
   * Algorithm: M(d) where d is the dictionary of key-value pairs from T(σ)
   *
   * The algorithm:
   * 1. Uses 31-byte state keys (created by createStateKey)
   * 2. Implements binary Patricia Merkle Trie with 512-bit nodes
   * 3. Uses BLAKE2b for hashing
   * 4. Supports embedded-value leaves (≤32 bytes) and regular leaves (>32 bytes)
   * 5. Uses branch nodes for internal nodes
   */
  private calculateMerkleRoot(stateTrie: StateTrie): Hex {
    // Convert StateTrie to the format expected by merklizeState
    const hexKeyValues: Record<string, string> = {}

    for (const [key, value] of Object.entries(stateTrie)) {
      // Ensure keys are properly formatted as hex strings
      const normalizedKey = key.startsWith('0x') ? key : `0x${key}`
      const normalizedValue = value.startsWith('0x') ? value : `0x${value}`
      hexKeyValues[normalizedKey] = normalizedValue
    }

    // Use Gray Paper merklization implementation
    const [error, merkleRoot] = merklizeState(hexKeyValues)
    if (error) {
      logger.error('Failed to calculate Merkle root', { error: error.message })
      // Return zero hash as fallback
      return '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
    }

    // Convert Uint8Array to Hex
    const rootHex = bytesToHex(merkleRoot)

    return rootHex
  }
}
