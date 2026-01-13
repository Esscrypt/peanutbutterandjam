/**
 * RPC Handler
 *
 * JIP-2 compliant RPC handler that directly accesses @pbnjam/node services.
 * Uses ServiceContext from service-factory for type-safe service access.
 *
 * JIP-2 Reference: https://hackmd.io/@polkadot/jip2
 */

import {
  decodeWorkPackage,
  encodeActivity,
  encodeServiceAccount,
} from '@pbnjam/codec'
import type { Hex } from '@pbnjam/core'
import { logger } from '@pbnjam/core'
import type { ServiceContext } from '@pbnjam/node'
import type { Activity, WorkPackage } from '@pbnjam/types'
import {
  AUTHORIZATION_CONSTANTS,
  DEPOSIT_CONSTANTS,
  HISTORY_CONSTANTS,
  PVM_CONSTANTS_GRAY_PAPER,
  SERVICE_CONSTANTS,
  TIME_CONSTANTS,
  WORK_PACKAGE_CONSTANTS,
  WORK_REPORT_CONSTANTS,
} from '@pbnjam/types'
import { bytesToHex, zeroHash } from 'viem'
import type { SubscriptionManager } from './subscription-manager'
import type { Parameters, WebSocket } from './types'

/**
 * Global service context - set during server initialization
 */
let serviceContext: ServiceContext | null = null

/**
 * Set the service context (called from index.ts during initialization)
 */
export function setServiceContext(context: ServiceContext): void {
  serviceContext = context
  logger.info('Service context set for RPC handler')
}

/**
 * Get services with null check
 */
function getServices(): ServiceContext {
  if (!serviceContext) {
    throw new Error(
      'Node services not initialized. Server may still be starting.',
    )
  }
  return serviceContext
}

/**
 * Check if services are available
 */
export function hasServices(): boolean {
  return serviceContext !== null
}

/**
 * JIP-2 RPC Handler
 *
 * All methods directly access services from ServiceContext.
 * No additional abstraction layers.
 */
export class RpcHandler {
  constructor(private subscriptionManager: SubscriptionManager) {}

  // ============================================================================
  // Chain Information Methods
  // ============================================================================

  /**
   * parameters - Returns the parameters of the current node/chain
   * JIP-2: Returns the (version 1) Parameters object
   *
   * Gray Paper Reference: definitions.tex for all C_ constants
   * Uses configService for node-specific values, constants for protocol values
   */
  async parameters(): Promise<Parameters> {
    const { configService } = getServices()

    return {
      // Deposit constants (Gray Paper: B_S, B_I, B_L)
      deposit_per_account: BigInt(DEPOSIT_CONSTANTS.C_BASEDEPOSIT), // C_basedeposit
      deposit_per_item: BigInt(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT), // C_itemdeposit
      deposit_per_byte: BigInt(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT), // C_bytedeposit

      // Time constants
      min_turnaround_period: TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD, // D - min turnaround
      epoch_period: configService.epochDuration, // E - C_epochlen
      rotation_period: configService.rotationPeriod, // R - C_rotationperiod
      availability_timeout: TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD, // U - C_assurancetimeoutperiod

      // Gas constants (Gray Paper: G_A, G_I, G_R, G_T)
      max_accumulate_gas: WORK_REPORT_CONSTANTS.C_REPORTACCGAS, // G_A - C_reportaccgas
      max_is_authorized_gas: AUTHORIZATION_CONSTANTS.C_PACKAGEAUTHGAS, // G_I - C_packageauthgas
      max_refine_gas: configService.maxRefineGas, // G_R - C_packagerefgas
      block_gas_limit: configService.maxBlockGas, // G_T - C_blockaccgas

      // History and queue constants
      recent_block_count: HISTORY_CONSTANTS.C_RECENTHISTORYLEN, // H - C_recenthistorylen
      auth_window: AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE, // O - C_authpoolsize
      auth_queue_len: AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE, // Q - C_authqueuesize
      max_lookup_anchor_age: configService.maxLookupAnchorage, // L - C_maxlookupanchorage

      // Work package constants (Gray Paper: I, J, K, N, T)
      max_work_items: WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEITEMS, // I - C_maxpackageitems
      max_dependencies: WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS, // J - C_maxreportdeps
      max_tickets_per_block: configService.maxTicketsPerExtrinsic, // K - C_maxblocktickets
      tickets_attempts_number: configService.ticketsPerValidator, // N - C_ticketentries
      max_extrinsics: WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEXTS, // T - C_maxpackagexts

      // Validator count
      val_count: configService.numValidators, // V - C_valcount

      // Size constants (Gray Paper: W_B, W_C, W_E, W_M, W_I, W_X)
      max_input: WORK_PACKAGE_CONSTANTS.C_MAXBUNDLESIZE, // W_B - C_maxbundlesize
      max_refine_code_size: SERVICE_CONSTANTS.C_MAXSERVICECODESIZE, // W_C - C_maxservicecodesize
      basic_piece_len: configService.ecPieceSize, // W_E - C_ecpiecesize
      max_imports: WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEIMPORTS, // W_M - C_maxpackageimports
      max_is_authorized_code_size: AUTHORIZATION_CONSTANTS.C_MAXAUTHCODESIZE, // W_I - C_maxauthcodesize
      max_exports: WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEEXPORTS, // W_X - C_maxpackageexports

      // PVM memory constants (Gray Paper: pvm.tex)
      max_refine_memory: PVM_CONSTANTS_GRAY_PAPER.C_PVMINITINPUTSIZE, // PVM init input size (2^24)
      max_is_authorized_memory: PVM_CONSTANTS_GRAY_PAPER.C_PVMINITZONESIZE, // PVM init zone size (2^16)
    }
  }

  // ============================================================================
  // Block Methods
  // ============================================================================

  /**
   * bestBlock - Returns the header hash and slot of the head of the "best" chain
   */
  async bestBlock(): Promise<{ hash: Hex; slot: bigint }> {
    const { recentHistoryService, clockService } = getServices()

    const recentHistory = recentHistoryService.getRecentHistory()
    if (recentHistory.length === 0) {
      return { hash: zeroHash, slot: 0n }
    }

    const latestBlock = recentHistory[recentHistory.length - 1]
    const currentSlot = clockService.getCurrentSlot()

    return {
      hash: latestBlock.headerHash,
      slot: currentSlot,
    }
  }

  /**
   * subscribeBestBlock - Subscribe to best block updates
   */
  subscribeBestBlock(ws: WebSocket): string {
    return this.subscriptionManager.addSubscription(ws, 'bestBlock', [])
  }

  /**
   * finalizedBlock - Returns the header hash and slot of the latest finalized block
   * Note: JAM uses GRANDPA-like finality; approximated with oldest in recent history
   */
  async finalizedBlock(): Promise<{ hash: Hex; slot: bigint }> {
    const { recentHistoryService, clockService } = getServices()

    const recentHistory = recentHistoryService.getRecentHistory()
    if (recentHistory.length === 0) {
      return { hash: `0x${'0'.repeat(64)}` as Hex, slot: 0n }
    }

    // Oldest block in recent history is considered finalized
    const finalizedBlock = recentHistory[0]
    const currentSlot = clockService.getCurrentSlot()
    const finalizedSlot = currentSlot - BigInt(recentHistory.length - 1)

    return {
      hash: finalizedBlock.headerHash,
      slot: finalizedSlot > 0n ? finalizedSlot : 0n,
    }
  }

  /**
   * subscribeFinalizedBlock - Subscribe to finalized block updates
   */
  subscribeFinalizedBlock(ws: WebSocket): string {
    return this.subscriptionManager.addSubscription(ws, 'finalizedBlock', [])
  }

  /**
   * parent - Returns the parent block hash and slot
   */
  async parent(blockHash: Hex): Promise<{ hash: Hex; slot: bigint } | null> {
    const { recentHistoryService, clockService } = getServices()

    const recentHistory = recentHistoryService.getRecentHistory()
    const blockIndex = recentHistory.findIndex(
      (entry) => entry.headerHash === blockHash,
    )

    if (blockIndex === -1) {
      logger.debug('Block not found in recent history', blockHash)
      return null
    }

    if (blockIndex === 0) {
      logger.debug(
        'Block is oldest in recent history, no parent available',
        blockHash,
      )
      return null
    }

    const parentBlock = recentHistory[blockIndex - 1]
    const currentSlot = clockService.getCurrentSlot()
    const parentSlot = currentSlot - BigInt(recentHistory.length - blockIndex)

    return {
      hash: parentBlock.headerHash,
      slot: parentSlot > 0n ? parentSlot : 0n,
    }
  }

  /**
   * stateRoot - Returns the posterior state root of the block
   */
  async stateRoot(blockHash: Hex): Promise<Hex | null> {
    const { recentHistoryService } = getServices()

    const blockEntry = recentHistoryService.getRecentHistoryForBlock(blockHash)
    if (!blockEntry) {
      logger.debug('Block not found in recent history', blockHash)
      return null
    }

    return blockEntry.stateRoot
  }

  /**
   * beefyRoot - Returns the BEEFY root (accumulation output log super-peak) of the block
   *
   * Gray Paper: The accoutLogSuperPeak is the Merkle mountain range commitment
   * that serves as the BEEFY finality commitment root.
   */
  async beefyRoot(blockHash: Hex): Promise<Hex | null> {
    const { recentHistoryService } = getServices()

    const blockEntry = recentHistoryService.getRecentHistoryForBlock(blockHash)
    if (!blockEntry) {
      return null
    }

    // accoutLogSuperPeak is the BEEFY root (accumulation output log super-peak)
    return blockEntry.accoutLogSuperPeak
  }

  // ============================================================================
  // Statistics Methods
  // ============================================================================

  /**
   * statistics - Returns activity statistics encoded as per Gray Paper
   */
  async statistics(blockHash: Hex): Promise<Uint8Array | null> {
    const { recentHistoryService, statisticsService, configService } =
      getServices()

    // Verify block exists
    const blockEntry = recentHistoryService.getRecentHistoryForBlock(blockHash)
    if (!blockEntry) {
      return null
    }

    // Get and encode activity
    const activity: Activity = statisticsService.getActivity()
    const [encodeError, encoded] = encodeActivity(activity, configService)

    if (encodeError) {
      logger.error('Failed to encode activity', encodeError, blockHash)
      return null
    }

    return encoded
  }

  /**
   * subscribeStatistics - Subscribe to statistics updates
   */
  subscribeStatistics(finalized: boolean, ws: WebSocket): string {
    return this.subscriptionManager.addSubscription(ws, 'statistics', [
      finalized,
    ])
  }

  // ============================================================================
  // Service Methods
  // ============================================================================

  /**
   * serviceData - Returns the service data for a service ID, encoded as per GP
   */
  async serviceData(
    blockHash: Hex,
    serviceId: number,
  ): Promise<Uint8Array | null> {
    const { recentHistoryService, serviceAccountService, configService } =
      getServices()

    // Verify block exists
    const blockEntry = recentHistoryService.getRecentHistoryForBlock(blockHash)
    if (!blockEntry) {
      return null
    }

    const [error, serviceAccount] = serviceAccountService.getServiceAccount(
      BigInt(serviceId),
    )
    if (error || !serviceAccount) {
      logger.debug('Service account not found', serviceId)
      return null
    }

    // Encode service account as per Gray Paper
    const [encodeError, encoded] = encodeServiceAccount(
      serviceAccount,
      configService.jamVersion,
    )
    if (encodeError) {
      logger.error('Failed to encode service account', encodeError, serviceId)
      return null
    }

    return encoded
  }

  /**
   * subscribeServiceData - Subscribe to service data updates
   */
  subscribeServiceData(
    serviceId: number,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    return this.subscriptionManager.addSubscription(ws, 'serviceData', [
      serviceId,
      finalized,
    ])
  }

  /**
   * serviceValue - Returns a storage value for a service
   */
  async serviceValue(
    blockHash: Hex,
    serviceId: number,
    key: Uint8Array,
  ): Promise<Uint8Array | null> {
    const { recentHistoryService, serviceAccountService } = getServices()

    // Verify block exists
    const blockEntry = recentHistoryService.getRecentHistoryForBlock(blockHash)
    if (!blockEntry) {
      return null
    }

    const keyHex = bytesToHex(key)
    const value = serviceAccountService.getStorageValue(
      BigInt(serviceId),
      keyHex,
    )

    if (!value) {
      logger.debug('Storage value not found', serviceId, keyHex)
      return null
    }

    return value
  }

  /**
   * subscribeServiceValue - Subscribe to service value updates
   */
  subscribeServiceValue(
    serviceId: number,
    key: Uint8Array,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    return this.subscriptionManager.addSubscription(ws, 'serviceValue', [
      serviceId,
      bytesToHex(key),
      finalized,
    ])
  }

  /**
   * servicePreimage - Returns preimage for a service by hash
   */
  async servicePreimage(
    blockHash: Hex,
    serviceId: number,
    hash: Hex,
  ): Promise<Uint8Array | null> {
    const { recentHistoryService, serviceAccountService, clockService } =
      getServices()

    // Verify block exists
    const blockEntry = recentHistoryService.getRecentHistoryForBlock(blockHash)
    if (!blockEntry) {
      return null
    }

    const [accountError, serviceAccount] =
      serviceAccountService.getServiceAccount(BigInt(serviceId))
    if (accountError || !serviceAccount) {
      logger.debug('Service account not found', serviceId)
      return null
    }

    // Look up preimage using histLookup
    const currentSlot = clockService.getCurrentSlot()
    const [lookupError, preimage] =
      serviceAccountService.histLookupServiceAccount(
        BigInt(serviceId),
        serviceAccount,
        hash,
        currentSlot,
      )

    if (lookupError || !preimage) {
      logger.debug('Preimage not found', serviceId, hash)
      return null
    }

    return preimage
  }

  /**
   * subscribeServicePreimage - Subscribe to service preimage updates
   */
  subscribeServicePreimage(
    serviceId: number,
    hash: Hex,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    return this.subscriptionManager.addSubscription(ws, 'servicePreimage', [
      serviceId,
      hash,
      finalized,
    ])
  }

  /**
   * serviceRequest - Returns preimage request slots for a service
   *
   * Gray Paper: sa_requests[(hash, length)] -> sequence[:3]{timeslot}
   * Returns the request status array indicating:
   * - [] = requested but not yet supplied
   * - [t0] = available since timeslot t0
   * - [t0, t1] = was available from t0 until t1 (now unavailable)
   * - [t0, t1, t2] = was available t0-t1, now available again since t2
   */
  async serviceRequest(
    blockHash: Hex,
    serviceId: number,
    hash: Hex,
    length: number,
  ): Promise<bigint[] | null> {
    const { recentHistoryService, serviceAccountService } = getServices()

    // Verify block exists
    const blockEntry = recentHistoryService.getRecentHistoryForBlock(blockHash)
    if (!blockEntry) {
      return null
    }

    // Get preimage request status using the new method
    const requestStatus = serviceAccountService.getPreimageRequestStatus(
      BigInt(serviceId),
      hash,
      BigInt(length),
    )

    if (requestStatus === undefined) {
      logger.debug('Preimage request not found', serviceId, hash, length)
      return null
    }

    return requestStatus
  }

  /**
   * subscribeServiceRequest - Subscribe to service request updates
   */
  subscribeServiceRequest(
    serviceId: number,
    hash: Hex,
    length: number,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    return this.subscriptionManager.addSubscription(ws, 'serviceRequest', [
      serviceId,
      hash,
      length,
      finalized,
    ])
  }

  /**
   * listServices - Returns all known service IDs
   */
  async listServices(blockHash: Hex): Promise<bigint[]> {
    const { recentHistoryService, serviceAccountService } = getServices()

    // Verify block exists
    const blockEntry = recentHistoryService.getRecentHistoryForBlock(blockHash)
    if (!blockEntry) {
      return []
    }

    return serviceAccountService.listServiceIds()
  }

  // ============================================================================
  // Submission Methods
  // ============================================================================

  /**
   * submitWorkPackage - Submit a work package to guarantors
   *
   * Decodes the work package from bytes using the codec and submits
   * via the event bus to the GuarantorService.
   *
   * @param coreIndex - Target core index for the work package
   * @param workPackageBytes - Encoded work package (Gray Paper format)
   * @param extrinsics - Array of extrinsic data blobs
   */
  async submitWorkPackage(
    coreIndex: bigint,
    workPackageBytes: Uint8Array,
    extrinsics: Uint8Array[],
  ): Promise<void> {
    const { eventBusService } = getServices()

    logger.info(
      'Submitting work package via event bus',
      Number(coreIndex),
      workPackageBytes.length,
      extrinsics.length,
    )

    // Decode work package from bytes
    const [decodeError, decodeResult] = decodeWorkPackage(workPackageBytes)
    if (decodeError) {
      logger.error('Failed to decode work package', decodeError)
      throw new Error(`Failed to decode work package: ${decodeError}`)
    }

    const workPackage: WorkPackage = decodeResult.value

    // Concatenate all extrinsics into a single blob
    const totalLength = extrinsics.reduce((sum, ext) => sum + ext.length, 0)
    const extrinsicData = new Uint8Array(totalLength)
    let offset = 0
    for (const ext of extrinsics) {
      extrinsicData.set(ext, offset)
      offset += ext.length
    }

    // Emit work package submission event
    // The GuarantorService will handle it via handleWorkPackageSubmission
    await eventBusService.emitWorkPackageReceived(
      {
        coreIndex,
        workPackage,
        extrinsics: extrinsicData,
      },
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex, // RPC submission (no peer)
    )

    logger.info('Work package submission emitted', Number(coreIndex))
  }

  /**
   * submitPreimage - Submit a preimage for a service
   *
   * @param serviceId - Service ID requesting the preimage
   * @param preimage - Raw preimage data
   * @param blockHash - Block hash for best-chain validation
   */
  async submitPreimage(
    serviceId: bigint,
    preimage: Uint8Array,
    blockHash: Hex,
  ): Promise<void> {
    const { recentHistoryService, serviceAccountService, clockService } =
      getServices()

    logger.info('Submitting preimage', Number(serviceId), preimage.length)

    // Verify block exists (for best-chain validation)
    const blockEntry = recentHistoryService.getRecentHistoryForBlock(blockHash)
    if (!blockEntry) {
      throw new Error('Block not found in recent history')
    }

    // Store preimage
    const currentSlot = clockService.getCurrentSlot()
    const [error] = serviceAccountService.storePreimage(
      {
        requester: serviceId,
        blob: bytesToHex(preimage) as Hex,
      },
      currentSlot,
    )

    if (error) {
      logger.error('Failed to submit preimage', error)
      throw error
    }

    logger.info('Preimage submitted successfully', Number(serviceId))
  }
}
