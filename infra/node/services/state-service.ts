/**
 * JAM State Service
 *
 * Implements the complete JAM global state management according to Gray Paper specifications.
 * Manages all 17 state components and their transition dependencies.
 *
 * Gray Paper Reference: Section "State Transition Dependency Graph" (equations 48-64)
 * State Definition: Equation (34) - thestate ≡ (authpool, recent, lastaccout, safrole, accounts, entropy, stagingset, activeset, previousset, reports, thetime, authqueue, privileges, disputes, activity, ready, accumulated)
 */

import type { GenesisHeaderState, Safe } from '@pbnj/core'
import {
  bytesToHex,
  hexToBytes,
  logger,
  merklizeState,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  createServicePreimageKey,
  createServiceRequestKey,
  createServiceStorageKey,
  createStateTrie,
  decodeAccumulated,
  decodeActivity,
  decodeAuthpool,
  decodeAuthqueue,
  decodeDisputeState,
  decodeEntropy,
  decodeLastAccountOut,
  decodePrivileges,
  decodeReady,
  decodeRecent,
  decodeSafrole,
  decodeServiceAccount,
  decodeStateWorkReports,
  decodeTheTime,
  decodeValidatorSet,
} from '@pbnj/serialization'
import type {
  Accumulated,
  Activity,
  AuthPool,
  AuthQueue,
  DecodingResult,
  Disputes,
  EntropyState,
  GlobalState,
  IConfigService,
  Privileges,
  Ready,
  Recent,
  Reports,
  SafroleState,
  SafroleTicketWithoutProof,
  ServiceAccounts,
  StateTrie,
  ValidatorPublicKeys,
} from '@pbnj/types'
import type { Hex } from 'viem'
import type { AccumulatedService } from './accumulated-service'
import type { ActivityService } from './activity-service'
import type { AuthPoolService } from './auth-pool-service'
import type { AuthQueueService } from './auth-queue-service'
import type { ClockService } from './clock-service'
import type { DisputesService } from './disputes-service'
import type { EntropyService } from './entropy'
import type { NodeGenesisManager } from './genesis-manager'
import type { LastAccoutService } from './lastaccout-service'
import type { PrivilegesService } from './privileges-service'
import type { ReadyService } from './ready-service'
import type { RecentHistoryService } from './recent-history-service'
import type { SealKeyService } from './seal-key'
import type { ServiceAccountsService } from './service-accounts-service'
import type { TicketService } from './ticket-service'
import type { ValidatorSetManager } from './validator-set'
import type { IWorkReportService } from './work-report-service'

/**
 * State component update reasons
 */
export type StateUpdateReason =
  | 'block_processing'
  | 'epoch_transition'
  | 'accumulation'
  | 'authorization'
  | 'dispute_resolution'
  | 'work_report_processing'
  | 'validator_rotation'
  | 'entropy_update'
  | 'time_slot_advance'

/**
 * State transition dependency tracking
 */
export interface StateDependency {
  component: keyof GlobalState
  dependsOn: (keyof GlobalState)[]
  updateReason: StateUpdateReason[]
  description: string
}

/**
 * State update event
 */
export interface StateUpdateEvent {
  component: keyof GlobalState
  reason: StateUpdateReason
  timestamp: number
  blockNumber?: bigint
  details?: Record<string, unknown>
}

/**
 * State transition validation result
 */
export interface StateValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * State mapping type alias for internal use
 */
type StateMapping = Map<keyof GlobalState, GlobalState[keyof GlobalState]>

/**
 * State service manager interface
 */
export interface IStateServiceManager {
  getStateComponent<K extends keyof GlobalState>(
    component: K,
  ): GlobalState[K] | undefined
  setStateComponent<K extends keyof GlobalState>(
    component: K,
    value: GlobalState[K],
  ): void
  initializeState(initialState: GenesisHeaderState): void
  getStateRangeWithBoundaries(
    headerHash: Hex,
    startKey: Uint8Array,
    endKey: Uint8Array,
    maxSize: number,
  ): Safe<{
    boundaryNodes: Uint8Array[]
    keyValuePairs: Array<{ key: Uint8Array; value: Uint8Array }>
  }>
}

/**
 * JAM State Service
 *
 * Manages the complete JAM global state according to Gray Paper specifications.
 * Implements the state transition dependency graph and ensures proper update ordering.
 * Delegates state management to specialized services for better modularity.
 */
export class StateService implements IStateServiceManager {
  private state: StateMapping
  private updateHistory: StateUpdateEvent[] = []
  private readonly maxHistorySize = 1000
  private readonly configService: IConfigService
  private readonly stateTypeRegistry = new Map<
    number,
    (data: Uint8Array) => Safe<DecodingResult<unknown>>
  >()

  // Service delegates for state components
  private validatorSetManager: ValidatorSetManager
  private entropyService: EntropyService
  private ticketHolderService: TicketService
  private authQueueService: AuthQueueService
  private authPoolService: AuthPoolService
  private activityService: ActivityService
  private disputesService: DisputesService
  private readyService: ReadyService
  private accumulatedService: AccumulatedService
  private lastAccoutService: LastAccoutService
  private workReportService: IWorkReportService
  private privilegesService: PrivilegesService
  private serviceAccountsService: ServiceAccountsService
  private recentHistoryService: RecentHistoryService
  // private authService?: AuthService
  private genesisManagerService: NodeGenesisManager
  private sealKeyService: SealKeyService
  private clockService: ClockService
  constructor(options: {
    validatorSetManager: ValidatorSetManager
    entropyService: EntropyService
    ticketHolderService: TicketService
    authQueueService: AuthQueueService
    authPoolService: AuthPoolService
    activityService: ActivityService
    disputesService: DisputesService
    readyService: ReadyService
    accumulatedService: AccumulatedService
    lastAccoutService: LastAccoutService
    workReportService: IWorkReportService
    privilegesService: PrivilegesService
    serviceAccountsService: ServiceAccountsService
    recentHistoryService: RecentHistoryService
    configService: IConfigService
    genesisManagerService: NodeGenesisManager
    sealKeyService: SealKeyService
    clockService: ClockService
  }) {
    this.state = new Map<keyof GlobalState, GlobalState[keyof GlobalState]>()
    logger.info('StateService initialized (uninitialized state)')
    // Map chapter indices to decoders (hardcoded according to Gray Paper)
    this.stateTypeRegistry.set(0, (data) =>
      decodeAuthpool(data, this.configService),
    ) // Chapter 0 - AuthPool
    this.stateTypeRegistry.set(1, (data) => decodeRecent(data)) // Chapter 1 - Recent
    this.stateTypeRegistry.set(2, (data) => decodeLastAccountOut(data)) // Chapter 2 - LastAccout
    this.stateTypeRegistry.set(3, (data) =>
      decodeSafrole(data, this.configService),
    ) // Chapter 3 - Safrole
    this.stateTypeRegistry.set(4, (data) => decodeServiceAccount(data)) // Chapter 4 - Accounts
    this.stateTypeRegistry.set(5, (data) => decodeEntropy(data)) // Chapter 5 - Entropy
    this.stateTypeRegistry.set(6, (data) =>
      decodeValidatorSet(data, this.configService),
    ) // Chapter 6 - StagingSet
    this.stateTypeRegistry.set(7, (data) =>
      decodeValidatorSet(data, this.configService),
    ) // Chapter 7 - ActiveSet
    this.stateTypeRegistry.set(8, (data) =>
      decodeValidatorSet(data, this.configService),
    ) // Chapter 8 - PreviousSet
    this.stateTypeRegistry.set(9, (data) =>
      decodeStateWorkReports(data, this.configService),
    ) // Chapter 9 - Reports
    this.stateTypeRegistry.set(10, (data) => decodeTheTime(data)) // Chapter 10 - TheTime
    this.stateTypeRegistry.set(11, (data) =>
      decodeAuthqueue(data, this.configService),
    ) // Chapter 11 - AuthQueue
    this.stateTypeRegistry.set(12, (data) => decodePrivileges(data)) // Chapter 12 - Privileges
    this.stateTypeRegistry.set(13, (data) => decodeDisputeState(data)) // Chapter 13 - Disputes
    this.stateTypeRegistry.set(14, (data) => decodeActivity(data)) // Chapter 14 - Activity
    this.stateTypeRegistry.set(15, (data) =>
      decodeReady(data, this.configService),
    ) // Chapter 15 - Ready
    this.stateTypeRegistry.set(16, decodeAccumulated) // Chapter 16 - Accumulated
    this.stateTypeRegistry.set(255, (data) => decodeServiceAccount(data)) // Chapter 255 - Service Accounts

    this.validatorSetManager = options.validatorSetManager
    this.entropyService = options.entropyService
    this.ticketHolderService = options.ticketHolderService
    this.authQueueService = options.authQueueService
    this.authPoolService = options.authPoolService
    this.activityService = options.activityService
    this.disputesService = options.disputesService
    this.readyService = options.readyService
    this.accumulatedService = options.accumulatedService
    this.lastAccoutService = options.lastAccoutService
    this.workReportService = options.workReportService
    this.privilegesService = options.privilegesService
    this.serviceAccountsService = options.serviceAccountsService
    this.recentHistoryService = options.recentHistoryService
    this.configService = options.configService
    this.genesisManagerService = options.genesisManagerService
    this.sealKeyService = options.sealKeyService
    this.clockService = options.clockService

    const [genesisHeaderError, genesisHeader] =
      this.genesisManagerService.getState()
    if (genesisHeaderError) {
      throw new Error('Failed to get genesis header')
    }
    this.initializeState(genesisHeader)
  }

  /**
   * Initialize state from genesis data
   */
  initializeState(initialState: GenesisHeaderState): void {
    const stateMapping = this.convertToMapping(initialState)

    // Set state components and delegate to services
    for (const [component, value] of stateMapping) {
      this.setStateComponent(component, value)
    }

    logger.info('State initialized from genesis data', {
      componentCount: stateMapping.size,
    })
  }

  /**
   * Get current state mapping
   */
  getState(): StateMapping {
    return this.state
  }

  constructState(): Safe<GenesisHeaderState> {
    // TODO: Implement state construction from current state
    return safeError(new Error('constructState not implemented'))
  }
  /**
   * Get specific state component
   * Delegates to appropriate service if available, otherwise returns from local state
   *
   * Ordered by Gray Paper equation (34): thestate ≡ (authpool, recent, lastaccout, safrole, accounts, entropy,
   * stagingset, activeset, previousset, reports, thetime, authqueue, privileges, disputes, activity, ready, accumulated)
   */
  getStateComponent<K extends keyof GlobalState>(
    component: K,
  ): GlobalState[K] | undefined {
    switch (component) {
      // 1. authpool (α) - Core authorization requirements
      case 'authpool':
        if (this.authPoolService) {
          return this.authPoolService.getAuthPool() as GlobalState[K]
        }
        break

      // 2. recent (β) - Recent blocks and accumulation outputs
      case 'recent':
        if (this.recentHistoryService) {
          return this.recentHistoryService.getRecent() as GlobalState[K]
        }
        break

      // 3. lastaccout (θ) - Most recent accumulation result
      case 'lastaccout':
        if (this.lastAccoutService) {
          return this.lastAccoutService.getLastAccout() as GlobalState[K]
        }
        break

      // 4. safrole (γ) - Consensus protocol internal state
      case 'safrole':
        if (this.ticketHolderService && this.validatorSetManager) {
          // Construct SafroleState from available services according to Gray Paper Eq. 50
          // safrole ≡ (pendingset, epochroot, sealtickets, ticketaccumulator)

          const pendingSetMap = this.validatorSetManager.getPendingValidators()
          const pendingSet = Array.from(pendingSetMap.values())
          const [epochRootError, epochRoot] =
            this.validatorSetManager.getEpochRoot()
          const ticketAccumulator =
            this.ticketHolderService.getTicketAccumulator()

          if (epochRootError) {
            logger.error('Failed to get epoch root for safrole state', {
              error: epochRootError,
            })
            return undefined
          }

          // TODO: Get sealTickets from SealKeyService (not currently available)
          // For now, use empty array as placeholder
          const sealTickets: (SafroleTicketWithoutProof | Uint8Array)[] =
            this.sealKeyService.getSealKeys()

          const safroleState: SafroleState = {
            pendingSet: Array.from(pendingSet.values()),
            epochRoot: bytesToHex(epochRoot),
            sealTickets,
            ticketAccumulator: ticketAccumulator.map((ticket) => ({
              id: ticket.id,
              entryIndex: ticket.entryIndex,
            })),
          }

          return safroleState as GlobalState[K]
        }
        break

      // 5. accounts (δ) - All service (smart contract) state
      case 'accounts':
        if (this.serviceAccountsService) {
          return this.serviceAccountsService.getServiceAccounts() as GlobalState[K]
        }
        break

      // 6. entropy (ε) - On-chain randomness accumulator
      case 'entropy':
        if (this.entropyService) {
          return this.entropyService.getEntropy() as GlobalState[K]
        }
        return undefined

      // 7. stagingset (ι) - Validators queued for next epoch
      case 'stagingset':
        return Array.from(
          this.validatorSetManager?.getStagingValidators().values() || [],
        ) as GlobalState[K]

      // 8. activeset (κ) - Currently active validators
      case 'activeset':
        return Array.from(
          this.validatorSetManager?.getActiveValidators().values() || [],
        ) as GlobalState[K]

      // 9. previousset (λ) - Previous epoch validators
      case 'previousset':
        return Array.from(
          this.validatorSetManager?.getPreviousValidators().values() || [],
        ) as GlobalState[K]

      // 10. reports (ρ) - Work reports awaiting availability assurance
      case 'reports':
        if (this.workReportService) {
          return this.workReportService.getReports() as GlobalState[K]
        }
        break

      // 11. thetime (τ) - Most recent block's timeslot index
      case 'thetime':
        if (this.clockService) {
          return this.clockService.getCurrentSlot() as GlobalState[K]
        }
        // TODO: Implement thetime service
        break

      // 12. authqueue (φ) - Queued core authorizations
      case 'authqueue':
        if (this.authQueueService) {
          return this.authQueueService.getAuthQueue() as GlobalState[K]
        }
        break

      // 13. privileges - Services with special privileges
      case 'privileges':
        if (this.privilegesService) {
          return this.privilegesService.getPrivileges() as GlobalState[K]
        }
        break

      // 14. disputes (ψ) - Judgments on work-reports and validators
      case 'disputes':
        if (this.disputesService) {
          return this.disputesService.getDisputesState() as GlobalState[K]
        }
        break

      // 15. activity (π) - Validator performance statistics
      case 'activity':
        if (this.activityService) {
          return this.activityService.getActivity() as GlobalState[K]
        }
        break

      // 16. ready (ω) - Reports ready for accumulation
      case 'ready':
        if (this.readyService) {
          return this.readyService.getReady() as GlobalState[K]
        }
        break

      // 17. accumulated (ξ) - Recently accumulated work-packages
      case 'accumulated':
        if (this.accumulatedService) {
          return this.accumulatedService.getAccumulated() as GlobalState[K]
        }
        break
    }

    // Fallback to local state
    return this.state.get(component) as GlobalState[K] | undefined
  }

  /**
   * Set state component
   * Delegates to appropriate service if available, otherwise stores in local state
   *
   * Ordered by Gray Paper equation (34): thestate ≡ (authpool, recent, lastaccout, safrole, accounts, entropy,
   * stagingset, activeset, previousset, reports, thetime, authqueue, privileges, disputes, activity, ready, accumulated)
   */
  setStateComponent<K extends keyof GlobalState>(
    component: K,
    value: GlobalState[K],
  ): void {
    switch (component) {
      // 1. authpool (α) - Core authorization requirements
      case 'authpool':
        if (this.authPoolService) {
          this.authPoolService.setAuthPool(value as AuthPool)
          return
        }
        break

      // 2. recent (β) - Recent blocks and accumulation outputs
      case 'recent':
        if (this.recentHistoryService) {
          // TODO: RecentHistoryService doesn't have a setRecent method
          // The service updates its state through event handling instead of direct setters
          logger.warn(
            'RecentHistoryService setter not implemented - service updates through events',
          )
          return
        }
        break

      // 3. lastaccout (θ) - Most recent accumulation result
      case 'lastaccout':
        if (this.lastAccoutService) {
          this.lastAccoutService.setLastAccout(value as Hex)
          return
        }
        break

      // 4. safrole (γ) - Consensus protocol internal state
      case 'safrole':
        // TODO: Safrole state is constructed from multiple services
        // Individual components are managed by their respective services:
        // - pendingSet: ValidatorSetManager
        // - epochRoot: ValidatorSetManager (computed from pendingSet)
        // - sealTickets: SealKeyService (not currently integrated)
        // - ticketAccumulator: TicketService
        logger.warn(
          'Safrole state setter not implemented - state is constructed from multiple services',
        )
        break

      // 5. accounts (δ) - All service (smart contract) state
      case 'accounts':
        if (this.serviceAccountsService) {
          this.serviceAccountsService.setServiceAccounts(
            value as ServiceAccounts,
          )
          return
        }
        break

      // 6. entropy (ε) - On-chain randomness accumulator
      case 'entropy':
        if (this.entropyService) {
          this.entropyService.setEntropy(value as EntropyState)
          return
        }
        break

      // 7. stagingset (ι) - Validators queued for next epoch
      case 'stagingset':
        if (this.validatorSetManager) {
          this.validatorSetManager.setStagingSet(value as ValidatorPublicKeys[])
          return
        }
        break

      // 8. activeset (κ) - Currently active validators
      case 'activeset':
        if (this.validatorSetManager) {
          this.validatorSetManager.setActiveSet(value as ValidatorPublicKeys[])
          return
        }
        break

      // 9. previousset (λ) - Previous epoch validators
      case 'previousset':
        if (this.validatorSetManager) {
          this.validatorSetManager.setPreviousSet(
            value as ValidatorPublicKeys[],
          )
          return
        }
        break

      // 10. reports (ρ) - Work reports awaiting availability assurance
      case 'reports':
        if (this.workReportService) {
          // Note: setReports is async but we don't await here for backward compatibility
          // The WorkReportService will handle the state reconstruction internally
          void this.workReportService.setReports(value as Reports)
          return
        }
        break

      // 11. thetime (τ) - Most recent block's timeslot index
      case 'thetime':
        // TODO: Implement thetime service setter
        break

      // 12. authqueue (φ) - Queued core authorizations
      case 'authqueue':
        if (this.authQueueService) {
          this.authQueueService.setAuthQueue(value as AuthQueue)
          return
        }
        break

      // 13. privileges - Services with special privileges
      case 'privileges':
        if (this.privilegesService) {
          this.privilegesService.setPrivileges(value as Privileges)
          return
        }
        break

      // 14. disputes (ψ) - Judgments on work-reports and validators
      case 'disputes':
        if (this.disputesService) {
          this.disputesService.setDisputesState(value as Disputes)
          return
        }
        break

      // 15. activity (π) - Validator performance statistics
      case 'activity':
        if (this.activityService) {
          this.activityService.setActivity(value as Activity)
          return
        }
        break

      // 16. ready (ω) - Reports ready for accumulation
      case 'ready':
        if (this.readyService) {
          this.readyService.setReady(value as Ready)
          return
        }
        break

      // 17. accumulated (ξ) - Recently accumulated work-packages
      case 'accumulated':
        if (this.accumulatedService) {
          this.accumulatedService.setAccumulated(value as Accumulated)
          return
        }
        break
    }

    // Fallback to local state
    this.state.set(component, value)
  }

  /**
   * Update a single state component
   *
   * @param component - State component to update
   * @param value - New value for the component
   * @param reason - Reason for the update
   * @param blockNumber - Block number (if applicable)
   * @param details - Additional update details
   */
  updateStateComponent<K extends keyof GlobalState>(
    component: K,
    value: GlobalState[K],
    reason: StateUpdateReason,
    blockNumber?: bigint,
    details?: Record<string, unknown>,
  ): Safe<void> {
    // Validate the update is allowed
    const validation = this.validateStateUpdate(component, reason)
    if (!validation.isValid) {
      return safeError(
        new Error(`Invalid state update: ${validation.errors.join(', ')}`),
      )
    }

    // Check dependencies
    const dependencyCheck = this.checkDependencies(component, reason)
    if (dependencyCheck[0]) {
      return dependencyCheck
    }

    // Update the state
    this.state.set(component, value)

    // Record the update
    this.recordUpdate({
      component,
      reason,
      timestamp: Date.now(),
      blockNumber,
      details,
    })

    logger.debug(`State component updated: ${component}`, {
      reason,
      blockNumber: blockNumber?.toString(),
      details,
    })

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
    const globalState = this.convertToGlobalState()
    return createStateTrie(globalState, this.configService)
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

    logger.debug('State root calculated', {
      stateRoot,
      trieSize: Object.keys(stateTrie).length,
    })

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
   * Query service account storage value
   *
   * Gray Paper merklization.tex (lines 103-104):
   * ∀ ⟨s, sa⟩ ∈ accounts, ⟨k, v⟩ ∈ sa_storage:
   * C(s, encode[4]{2³²-1} ∥ k) ↦ v
   *
   * @param serviceId - Service account ID
   * @param storageKey - Storage key (blob)
   * @returns Storage value if found, undefined if not found
   */
  getServiceStorageValue(
    serviceId: bigint,
    storageKey: Hex,
  ): Safe<Uint8Array | undefined> {
    const storageStateKey = createServiceStorageKey(serviceId, storageKey)
    const stateKeyHex = bytesToHex(storageStateKey)

    const [error, value] = this.getStateTrieValue(stateKeyHex)
    if (error) {
      return safeError(error)
    }

    if (!value) {
      return safeResult(undefined)
    }

    // Convert hex value back to Uint8Array
    const valueBytes = hexToBytes(value)
    return safeResult(valueBytes)
  }

  /**
   * Query service account preimage
   *
   * Gray Paper merklization.tex (lines 105-106):
   * ∀ ⟨s, sa⟩ ∈ accounts, ⟨h, p⟩ ∈ sa_preimages:
   * C(s, encode[4]{2³²-2} ∥ h) ↦ p
   *
   * @param serviceId - Service account ID
   * @param preimageHash - Preimage hash
   * @returns Preimage data if found, undefined if not found
   */
  getServicePreimage(
    serviceId: bigint,
    preimageHash: Hex,
  ): Safe<Uint8Array | undefined> {
    const preimageStateKey = createServicePreimageKey(serviceId, preimageHash)
    const stateKeyHex = bytesToHex(preimageStateKey)

    const [error, value] = this.getStateTrieValue(stateKeyHex)
    if (error) {
      return safeError(error)
    }

    if (!value) {
      return safeResult(undefined)
    }

    // Convert hex value back to Uint8Array
    const valueBytes = hexToBytes(value)
    return safeResult(valueBytes)
  }

  /**
   * Query service account request status
   *
   * Gray Paper merklization.tex (lines 107-110):
   * ∀ ⟨s, sa⟩ ∈ accounts, ⟨⟨h, l⟩, t⟩ ∈ sa_requests:
   * C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
   *
   * @param serviceId - Service account ID
   * @param requestHash - Request hash
   * @param length - Blob length
   * @returns Request status sequence if found, undefined if not found
   */
  getServiceRequest(
    serviceId: bigint,
    requestHash: Hex,
    length: bigint,
  ): Safe<bigint[] | undefined> {
    const requestStateKey = createServiceRequestKey(
      serviceId,
      requestHash,
      length,
    )
    const stateKeyHex = bytesToHex(requestStateKey)

    const [error, value] = this.getStateTrieValue(stateKeyHex)
    if (error) {
      return safeError(error)
    }

    if (!value) {
      return safeResult(undefined)
    }

    // TODO: Decode the request status sequence from the hex value
    // The value should be: encode{var{sequence{encode[4]{x} | x ∈ t}}}
    // For now, return undefined as we need to implement the decoder
    logger.warn('Service request decoding not yet implemented', {
      serviceId: serviceId.toString(),
      requestHash,
      length: length.toString(),
      value,
    })

    return safeResult(undefined)
  }

  /**
   * Get state trie for specific components
   *
   * Generates a partial state trie containing only the specified components.
   * Useful for:
   * - Partial state synchronization
   * - Component-specific Merkle proofs
   * - Incremental state updates
   */
  getPartialStateTrie(components: (keyof GlobalState)[]): Safe<StateTrie> {
    const globalState = this.convertToGlobalState()

    // Create a partial state with only the requested components
    const partialState: Partial<GlobalState> = {}
    for (const component of components) {
      ;(partialState as Record<string, unknown>)[component] =
        globalState[component]
    }

    // Generate trie for partial state
    return createStateTrie(partialState as GlobalState, this.configService)
  }

  /**
   * Get state range with boundary nodes for CE129 protocol
   *
   * CE129: State request - Returns contiguous range of key/value pairs from state trie
   * along with boundary nodes needed for verification.
   *
   * @param headerHash - Block header hash
   * @param startKey - 31-byte start key (inclusive)
   * @param endKey - 31-byte end key (inclusive)
   * @param maxSize - Maximum response size in bytes
   * @returns State range with boundary nodes
   */
  getStateRangeWithBoundaries(
    headerHash: Hex,
    startKey: Uint8Array,
    endKey: Uint8Array,
    maxSize: number,
  ): Safe<{
    boundaryNodes: Uint8Array[]
    keyValuePairs: Array<{ key: Uint8Array; value: Uint8Array }>
  }> {
    try {
      // Generate current state trie
      const [trieError, stateTrie] = this.generateStateTrie()
      if (trieError) {
        return safeError(trieError)
      }

      // Convert to sorted key-value pairs
      const keyValuePairs: Array<{ key: Uint8Array; value: Uint8Array }> = []
      const sortedKeys = Object.keys(stateTrie).sort()

      // Find range within sorted keys
      for (const keyHex of sortedKeys) {
        const key = hexToBytes(
          keyHex.startsWith('0x') ? (keyHex as `0x${string}`) : `0x${keyHex}`,
        )
        const key31 = key.slice(0, 31) // Only first 31 bytes matter

        // Check if key is in range
        if (
          this.compareKeys(key31, startKey) >= 0 &&
          this.compareKeys(key31, endKey) <= 0
        ) {
          const value = hexToBytes(stateTrie[keyHex as `0x${string}`])
          keyValuePairs.push({ key: key31, value })
        }
      }

      // Build boundary nodes for the range
      const boundaryNodes = this.buildBoundaryNodes(stateTrie, startKey, endKey)

      // Check size limit (unless only one key/value pair)
      const responseSize = this.estimateResponseSize(
        boundaryNodes,
        keyValuePairs,
      )
      if (responseSize > maxSize && keyValuePairs.length > 1) {
        // Truncate to fit maxSize
        const truncatedPairs = this.truncateToSize(
          keyValuePairs,
          maxSize,
          boundaryNodes.length,
        )
        return safeResult({
          boundaryNodes,
          keyValuePairs: truncatedPairs,
        })
      }

      return safeResult({ boundaryNodes, keyValuePairs })
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Validate state trie consistency
   *
   * Checks that the current state can be properly serialized into a state trie
   * and that all components are valid according to Gray Paper specifications.
   */

  /**
   * Convert GenesisHeaderState keyvals to StateMapping
   *
   * Parses the keyvals array from genesis.json and maps each key to the correct
   * state component according to Gray Paper state key specifications.
   *
   * Gray Paper Reference: merklization.tex equation (10-16)
   * State keys are 31-byte identifiers created using the C() function
   *
   * @param state - Genesis header state with keyvals array
   * @returns Map of state component names to their parsed values
   */
  private convertToMapping(
    state: GenesisHeaderState,
  ): Map<keyof GlobalState, GlobalState[keyof GlobalState]> {
    const stateMapping = new Map<
      keyof GlobalState,
      GlobalState[keyof GlobalState]
    >()

    // Parse keyvals array and map to state components
    for (const keyval of state.keyvals) {
      const [stateKeyError, stateKeyResult] = this.parseStateKey(keyval.key)
      if (stateKeyError) {
        logger.warn('Failed to parse state key', {
          keyHex: keyval.key,
          error: stateKeyError.message,
        })
        continue
      }

      const parsedValue = this.parseStateValue(
        stateKeyResult.chapterIndex,
        keyval.value,
      )
      if (parsedValue) {
        // Map chapter index to component name for storage
        const componentMap: Record<number, keyof GlobalState> = {
          0: 'authpool',
          1: 'recent',
          2: 'lastaccout',
          3: 'safrole',
          4: 'accounts',
          5: 'entropy',
          6: 'stagingset',
          7: 'activeset',
          8: 'previousset',
          9: 'reports',
          10: 'thetime',
          11: 'authqueue',
          12: 'privileges',
          13: 'disputes',
          14: 'activity',
          15: 'ready',
          16: 'accumulated',
          255: 'accounts', // Service accounts map to accounts component
        }
        const component = componentMap[stateKeyResult.chapterIndex]
        if (component) {
          stateMapping.set(component, parsedValue)
        }
      } else {
        logger.warn('Failed to parse state value', {
          chapterIndex: stateKeyResult.chapterIndex,
          valueHex: keyval.value,
        })
      }
    }

    return stateMapping
  }

  /**
   * Parse a state key to determine which state component it represents
   *
   * Gray Paper Reference: merklization.tex equation (10-16)
   * C(i) = ⟨i, 0, 0, ...⟩ for simple chapter indices
   * C(255, s) = ⟨255, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩ where n = encode[4](s)
   * C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, ...⟩ where n = encode[4](s), a = encode[4](h)
   *
   * @param keyHex - Hex string representing the state key
   * @returns Object with component name and metadata, or null if unrecognized
   */
  private parseStateKey(
    keyHex: Hex,
  ): Safe<{ chapterIndex: number; metadata?: unknown }> {
    // Remove 0x prefix and convert to bytes
    const keyBytes = hexToBytes(keyHex)

    if (keyBytes.length !== 31) {
      return safeError(new Error('Invalid state key length'))
    }

    // Extract first byte as chapter index
    const chapterIndex = keyBytes[0]

    if (chapterIndex === 0xff) {
      // Chapter 255 - Service Accounts
      // Service account keys: C(255, s) = ⟨255, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩
      const serviceId = this.parseServiceId(keyBytes)
      return safeResult({ chapterIndex: 255, metadata: { serviceId } })
    }

    return safeResult({ chapterIndex })
  }

  /**
   * Parse service ID from service account key
   *
   * @param keyBytes - 31-byte state key
   * @returns Service ID as bigint
   */
  private parseServiceId(keyBytes: Uint8Array): bigint {
    // Service ID is encoded in bytes 1, 3, 5, 7 (every other byte starting from 1)
    const serviceIdBytes = new Uint8Array(4)
    serviceIdBytes[0] = keyBytes[1]
    serviceIdBytes[1] = keyBytes[3]
    serviceIdBytes[2] = keyBytes[5]
    serviceIdBytes[3] = keyBytes[7]

    // Convert to bigint (big-endian)
    const view = new DataView(serviceIdBytes.buffer)
    return BigInt(view.getUint32(0, false))
  }

  /**
   * Parse state value based on component type
   *
   * @param component - State component name
   * @param valueHex - Hex string representing the encoded value
   * @returns Parsed value or null if parsing fails
   */
  private parseStateValue(
    chapterIndex: number,
    valueHex: Hex,
  ): GlobalState[keyof GlobalState] | null {
    const decoder = this.stateTypeRegistry.get(chapterIndex)
    if (!decoder) {
      return null
    }

    const data = hexToBytes(valueHex)
    const [error, result] = decoder(data)

    if (error) {
      logger.warn('Failed to decode state value', {
        chapterIndex,
        valueHex,
        error: error.message,
      })
      return null
    }

    return result.value as GlobalState[keyof GlobalState]
  }

  /**
   * Validate state update is allowed
   */
  private validateStateUpdate(
    _component: keyof GlobalState,
    _reason: StateUpdateReason,
  ): StateValidationResult {
    // TODO: Implement state validation
    return { isValid: true, errors: [], warnings: [] }
  }

  /**
   * Check if dependencies are satisfied for a single update
   */
  private checkDependencies(
    _component: keyof GlobalState,
    _reason: StateUpdateReason,
  ): Safe<void> {
    // TODO: Implement dependency checking
    return safeResult(undefined)
  }

  /**
   * Record state update event
   */
  private recordUpdate(event: StateUpdateEvent): void {
    this.updateHistory.push(event)

    // Maintain history size limit
    if (this.updateHistory.length > this.maxHistorySize) {
      this.updateHistory = this.updateHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Convert StateMapping back to GlobalState
   */
  private convertToGlobalState(): GlobalState {
    return {
      authpool: this.state.get('authpool') as AuthPool,
      recent: this.state.get('recent') as Recent,
      lastaccout: this.state.get('lastaccout') as Hex,
      safrole: this.state.get('safrole') as SafroleState,
      accounts: this.state.get('accounts') as ServiceAccounts,
      entropy: this.state.get('entropy') as EntropyState,
      stagingset: this.state.get('stagingset') as ValidatorPublicKeys[],
      activeset: this.state.get('activeset') as ValidatorPublicKeys[],
      previousset: this.state.get('previousset') as ValidatorPublicKeys[],
      reports: this.state.get('reports') as Reports,
      thetime: this.state.get('thetime') as bigint,
      authqueue: this.state.get('authqueue') as AuthQueue,
      privileges: this.state.get('privileges') as Privileges,
      disputes: this.state.get('disputes') as Disputes,
      activity: this.state.get('activity') as Activity,
      ready: this.state.get('ready') as Ready,
      accumulated: this.state.get('accumulated') as Accumulated,
    }
  }

  /**
   * Compare two 31-byte keys lexicographically
   */
  private compareKeys(key1: Uint8Array, key2: Uint8Array): number {
    for (let i = 0; i < 31; i++) {
      if (key1[i] < key2[i]) return -1
      if (key1[i] > key2[i]) return 1
    }
    return 0
  }

  /**
   * Build boundary nodes for state range
   */
  private buildBoundaryNodes(
    stateTrie: StateTrie,
    startKey: Uint8Array,
    endKey: Uint8Array,
  ): Uint8Array[] {
    // Simplified implementation - in practice, this would traverse the trie
    // and collect nodes on paths from root to start/end keys
    const boundaryNodes: Uint8Array[] = []

    // For now, return empty array as full trie traversal implementation
    // would be quite complex and require the actual trie structure
    logger.debug('Building boundary nodes for state range', {
      startKey: bytesToHex(startKey),
      endKey: bytesToHex(endKey),
      trieSize: Object.keys(stateTrie).length,
    })

    return boundaryNodes
  }

  /**
   * Estimate response size in bytes
   */
  private estimateResponseSize(
    boundaryNodes: Uint8Array[],
    keyValuePairs: Array<{ key: Uint8Array; value: Uint8Array }>,
  ): number {
    let size = 0

    // Boundary nodes: 64 bytes each
    size += boundaryNodes.length * 64

    // Key-value pairs: 31 bytes key + 4 bytes length + value length
    for (const { key, value } of keyValuePairs) {
      size += 31 + 4 + value.length
    }

    return size
  }

  /**
   * Truncate key-value pairs to fit within size limit
   */
  private truncateToSize(
    keyValuePairs: Array<{ key: Uint8Array; value: Uint8Array }>,
    maxSize: number,
    boundaryNodeCount: number,
  ): Array<{ key: Uint8Array; value: Uint8Array }> {
    const boundaryNodeSize = boundaryNodeCount * 64
    const availableSize = maxSize - boundaryNodeSize

    const truncated: Array<{ key: Uint8Array; value: Uint8Array }> = []
    let currentSize = 0

    for (const { key, value } of keyValuePairs) {
      const itemSize = 31 + 4 + value.length
      if (currentSize + itemSize > availableSize) {
        break
      }
      truncated.push({ key, value })
      currentSize += itemSize
    }

    return truncated
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

    logger.debug('Merkle root calculated using Gray Paper algorithm', {
      rootHex,
      keyCount: Object.keys(hexKeyValues).length,
    })

    return rootHex
  }
}
