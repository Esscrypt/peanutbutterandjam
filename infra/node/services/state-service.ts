/**
 * JAM State Service
 *
 * Implements the complete JAM global state management according to Gray Paper specifications.
 * Manages all 17 state components and their transition dependencies.
 *
 * Gray Paper Reference: Section "State Transition Dependency Graph" (equations 48-64)
 * State Definition: Equation (34) - thestate ≡ (authpool, recent, lastaccout, safrole, accounts, entropy, stagingset, activeset, previousset, reports, thetime, authqueue, privileges, disputes, activity, ready, accumulated)
 */

import type { GenesisHeaderState } from '@pbnj/core'
import { bytesToHex, hexToBytes, logger, merklizeState } from '@pbnj/core'
import {
  // createServicePreimageKey,
  // createServiceRequestKey,
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
  Privileges,
  Ready,
  Recent,
  Reports,
  Safe,
  SafroleState,
  SafroleTicket,
  ServiceAccounts,
  StateComponent,
  StateTrie,
  ValidatorPublicKeys,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import type { Hex } from 'viem'
import type { AccumulationService } from './accumulation-service'
import type { ActivityService } from './activity-service'
import type { AuthPoolService } from './auth-pool-service'
import type { AuthQueueService } from './auth-queue-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { DisputesService } from './disputes-service'
import type { EntropyService } from './entropy'
import type { NodeGenesisManager } from './genesis-manager'
import type { LastAccoutService } from './lastaccout-service'
import type { PrivilegesService } from './privileges-service'
import type { ReadyService } from './ready-service'
import type { RecentHistoryService } from './recent-history-service'
import type { SealKeyService } from './seal-key'
import type { ServiceAccountService } from './service-account-service'
import type { TicketService } from './ticket-service'
import type { ValidatorSetManager } from './validator-set'
import type { WorkReportService } from './work-report-service'

/**
 * JAM State Service
 *
 * Manages the complete JAM global state according to Gray Paper specifications.
 * Implements the state transition dependency graph and ensures proper update ordering.
 * Delegates state management to specialized services for better modularity.
 */
export class StateService {
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
  private activityService: ActivityService
  private disputesService: DisputesService
  private readyService: ReadyService
  private accumulatedService: AccumulationService
  private lastAccoutService: LastAccoutService
  private workReportService: WorkReportService
  private privilegesService: PrivilegesService
  private serviceAccountsService: ServiceAccountService
  private recentHistoryService: RecentHistoryService
  // private authService?: AuthService
  private genesisManagerService: NodeGenesisManager
  private sealKeyService: SealKeyService
  private clockService: ClockService

  constructor(options: {
    validatorSetManager: ValidatorSetManager
    entropyService: EntropyService
    ticketService: TicketService
    authQueueService: AuthQueueService
    authPoolService: AuthPoolService
    activityService: ActivityService
    disputesService: DisputesService
    readyService: ReadyService
    accumulatedService: AccumulationService
    lastAccoutService: LastAccoutService
    workReportService: WorkReportService
    privilegesService: PrivilegesService
    serviceAccountsService: ServiceAccountService
    recentHistoryService: RecentHistoryService
    configService: ConfigService
    genesisManagerService: NodeGenesisManager
    sealKeyService: SealKeyService
    clockService: ClockService
  }) {
    this.configService = options.configService
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
    this.ticketService = options.ticketService
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
    this.genesisManagerService = options.genesisManagerService
    this.sealKeyService = options.sealKeyService
    this.clockService = options.clockService

    const [genesisHeaderError, genesisHeader] =
      this.genesisManagerService.getState()
    if (genesisHeaderError) {
      throw new Error('Failed to get genesis header')
    }
    this.setState(genesisHeader.keyvals)
  }

  /**
   * Get specific state component
   * Delegates to appropriate service if available, otherwise returns from local state
   *
   * Ordered by Gray Paper equation (34): thestate ≡ (authpool, recent, lastaccout, safrole, accounts, entropy,
   * stagingset, activeset, previousset, reports, thetime, authqueue, privileges, disputes, activity, ready, accumulated)
   */
  getStateComponent(chapterIndex: number): StateComponent {
    switch (chapterIndex) {
      // 1. authpool (α) - Core authorization requirements
      case 1:
        return this.authPoolService.getAuthPool()

      // 2. recent (β) - Recent blocks and accumulation outputs
      case 2:
        return this.recentHistoryService.getRecent()

      // 3. lastaccout (θ) - Most recent accumulation result
      case 3:
        return this.lastAccoutService.getLastAccout()

      // 4. safrole (γ) - Consensus protocol internal state
      case 4:
        return {
          pendingSet: Array.from(
            this.validatorSetManager.getPendingValidators().values(),
          ),
          epochRoot: this.validatorSetManager.getEpochRoot(),
          sealTickets: this.sealKeyService.getSealKeys(),
          ticketAccumulator: this.ticketService.getTicketAccumulator(),
        }

      // 5. accounts (δ) - All service (smart contract) state
      case 5:
        return this.serviceAccountsService.getServiceAccounts()

      // 6. entropy (ε) - On-chain randomness accumulator
      case 6:
        return this.entropyService.getEntropy()

      // 7. stagingset (ι) - Validators queued for next epoch
      case 7:
        return Array.from(
          this.validatorSetManager.getStagingValidators().values(),
        )

      // 8. activeset (κ) - Currently active validators
      case 8:
        return Array.from(
          this.validatorSetManager.getActiveValidators().values(),
        )

      // 10. reports (ρ) - Work reports awaiting availability assurance
      case 10:
        return this.workReportService.getPendingReports()
      // 11. thetime (τ) - Most recent block's timeslot index
      case 11:
        return this.clockService.getCurrentSlot()
      // 12. authqueue (φ) - Queued core authorizations
      case 12:
        return this.authQueueService.getAuthQueue()

      // 13. privileges - Services with special privileges
      case 13:
        return this.privilegesService.getPrivileges()

      // 14. disputes (ψ) - Judgments on work-reports and validators
      case 14:
        return this.disputesService.getDisputesState()

      // 15. activity (π) - Validator performance statistics
      case 15:
        return this.activityService.getActivity()

      // 16. ready (ω) - Reports ready for accumulation
      case 16:
        return this.readyService.getReady()

      // 17. accumulated (ξ) - Recently accumulated work-packages
      case 17:
        return this.accumulatedService.getAccumulated()
    }

    throw new Error(`State component ${chapterIndex} not found`)
  }

  /**
   * Set state component
   * Delegates to appropriate service if available, otherwise stores in local state
   *
   * Ordered by Gray Paper equation (34): thestate ≡ (authpool, recent, lastaccout, safrole, accounts, entropy,
   * stagingset, activeset, previousset, reports, thetime, authqueue, privileges, disputes, activity, ready, accumulated)
   */
  setStateComponent(chapterIndex: number, value: StateComponent): void {
    switch (chapterIndex) {
      // 1. authpool (α) - Core authorization requirements
      case 1:
        this.authPoolService.setAuthPool(value as AuthPool)
        break

      // 2. recent (β) - Recent blocks and accumulation outputs
      case 2:
        this.recentHistoryService.setRecent(value as Recent)
        break

      // 3. lastaccout (θ) - Most recent accumulation result
      case 3:
        this.lastAccoutService.setLastAccout(value as Hex)
        break

      // 4. safrole (γ) - Consensus protocol internal state
      case 4:
        {
          const safroleState = value as SafroleState
          this.validatorSetManager.setPendingSet(safroleState.pendingSet)
          this.validatorSetManager.setEpochRoot(safroleState.epochRoot)
          this.ticketService.setTicketAccumulator(
            safroleState.ticketAccumulator,
          )
          this.sealKeyService.setSealKeys(
            safroleState.sealTickets as SafroleTicket[],
          )
        }
        break

      // 5. accounts (δ) - All service (smart contract) state
      case 5:
        for (const [serviceId, serviceAccount] of (
          value as ServiceAccounts
        ).accounts.entries()) {
          this.serviceAccountsService.setServiceAccount(
            serviceId,
            serviceAccount,
          )
        }
        break

      // 6. entropy (ε) - On-chain randomness accumulator
      case 6:
        this.entropyService.setEntropy(value as EntropyState)
        break

      // 7. stagingset (ι) - Validators queued for next epoch
      case 7:
        this.validatorSetManager.setStagingSet(value as ValidatorPublicKeys[])
        break

      // 8. activeset (κ) - Currently active validators
      case 8:
        this.validatorSetManager.setActiveSet(value as ValidatorPublicKeys[])
        break

      // 9. previousset (λ) - Previous epoch validators
      case 9:
        this.validatorSetManager.setPreviousSet(value as ValidatorPublicKeys[])
        break

      // 10. reports (ρ) - Work reports awaiting availability assurance
      case 10:
        this.workReportService.setPendingReports(value as Reports)
        break

      // 11. thetime (τ) - Most recent block's timeslot index
      case 11:
        this.clockService.setLatestReportedBlockTimeslot(value as bigint)
        break

      // 12. authqueue (φ) - Queued core authorizations
      case 12:
        this.authQueueService.setAuthQueue(value as AuthQueue)
        break

      // 13. privileges - Services with special privileges
      case 13:
        this.privilegesService.setPrivileges(value as Privileges)
        break

      // 14. disputes (ψ) - Judgments on work-reports and validators
      case 14:
        this.disputesService.setDisputesState(value as Disputes)
        break

      // 15. activity (π) - Validator performance statistics
      case 15:
        this.activityService.setActivity(value as Activity)
        break

      // 16. ready (ω) - Reports ready for accumulation
      case 16:
        this.readyService.setReady(value as Ready)
        break

      // 17. accumulated (ξ) - Recently accumulated work-packages
      case 17:
        this.accumulatedService.setAccumulated(value as Accumulated)
        break
      default:
        logger.warn(`State component ${chapterIndex} not found`)
        break
    }
  }

  setState(keyvals: { key: Hex; value: Hex }[]): Safe<void> {
    // store the stateRoot here and in recentHistoryService
    for (const keyval of keyvals) {
      const [stateKeyError, stateKeyResult] = this.parseStateKey(keyval.key)
      if (stateKeyError) {
        return safeError(stateKeyError)
      }
      const parsedValue = this.parseStateValue(
        stateKeyResult.chapterIndex,
        keyval.value,
      )
      if (parsedValue) {
        this.setStateComponent(
          stateKeyResult.chapterIndex,
          parsedValue as StateComponent,
        )
      } else {
        return safeError(
          new Error(`Failed to parse state value for key ${keyval.key}`),
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
      lastaccout: this.lastAccoutService.getLastAccout(),
      safrole: {
        pendingSet: Array.from(
          this.validatorSetManager.getPendingValidators().values(),
        ),
        epochRoot: this.validatorSetManager.getEpochRoot(),
        sealTickets: this.sealKeyService.getSealKeys(),
        ticketAccumulator: this.ticketService.getTicketAccumulator(),
      },
      accounts: this.serviceAccountsService.getServiceAccounts(),
      entropy: this.entropyService.getEntropy(),
      stagingset: Array.from(
        this.validatorSetManager.getStagingValidators().values(),
      ),
      activeset: Array.from(
        this.validatorSetManager.getActiveValidators().values(),
      ),
      previousset: Array.from(
        this.validatorSetManager.getPreviousValidators().values(),
      ),
      reports: this.workReportService.getPendingReports(),
      thetime: this.clockService.getCurrentSlot(),
      authqueue: this.authQueueService.getAuthQueue(),
      privileges: this.privilegesService.getPrivileges(),
      disputes: this.disputesService.getDisputesState(),
      activity: this.activityService.getActivity(),
      ready: this.readyService.getReady(),
      accumulated: this.accumulatedService.getAccumulated(),
    }
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
    _headerHash: Hex,
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
      // const responseSize = this.estimateResponseSize(
      //   boundaryNodes,
      //   keyValuePairs,
      // )
      // TEMPORARY HACK
      const responseSize = maxSize - 1
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
  // TODO: implement properly
  // private estimateResponseSize(
  //   boundaryNodes: Uint8Array[],
  //   keyValuePairs: Array<{ key: Uint8Array; value: Uint8Array }>,
  // ): number {
  //   let size = 0

  //   // Boundary nodes: 64 bytes each
  //   size += boundaryNodes.length * 64

  //   // Key-value pairs: 31 bytes key + 4 bytes length + value length
  //   for (const { key, value } of keyValuePairs) {
  //     size += 31 + 4 + value.length
  //   }

  //   return size
  // }

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
