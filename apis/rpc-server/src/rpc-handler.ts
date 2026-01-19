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
import { decodeBase64, encodeBase64, logger } from '@pbnjam/core'
import type { MainService } from '@pbnjam/node'
import type { Activity, WorkPackage } from '@pbnjam/types'
import {
  AUTHORIZATION_CONSTANTS,
  DEPOSIT_CONSTANTS,
  HISTORY_CONSTANTS,
  SERVICE_CONSTANTS,
  TIME_CONSTANTS,
  TRANSFER_CONSTANTS,
  WORK_PACKAGE_CONSTANTS,
  WORK_REPORT_CONSTANTS,
} from '@pbnjam/types'
import { bytesToHex, hexToBytes, zeroHash } from 'viem'
import type { SubscriptionManager } from './subscription-manager'
import type { Blob, Hash, Parameters, WebSocket } from './types'

/**
 * Global main service - set during server initialization
 */
let mainService: MainService | null = null

/**
 * Set the main service (called from index.ts during initialization)
 */
export function setMainService(service: MainService): void {
  mainService = service
  logger.info('Main service set for RPC handler')
}

/**
 * Get main service with null check
 */
function getMainService(): MainService {
  if (!mainService) {
    throw new Error(
      'Node services not initialized. Server may still be starting.',
    )
  }
  return mainService
}

/**
 * Check if services are available
 */
export function hasServices(): boolean {
  return mainService !== null
}

/**
 * Convert Hex to Base64 Hash (JIP-2: Hash is Base64-encoded 32-byte data)
 */
function hexToBase64Hash(hex: Hex): Hash {
  const bytes = hexToBytes(hex)
  if (bytes.length !== 32) {
    throw new Error(`Hash must be 32 bytes, got ${bytes.length}`)
  }
  return encodeBase64(bytes)
}

/**
 * Convert Base64 Hash to Hex
 */
function base64HashToHex(base64: Hash): Hex {
  const bytes = decodeBase64(base64)
  if (bytes.length !== 32) {
    throw new Error(`Hash must be 32 bytes when decoded, got ${bytes.length}`)
  }
  return bytesToHex(bytes) as Hex
}

/**
 * Convert Uint8Array to Base64 Blob (JIP-2: Blob is Base64-encoded arbitrary-length data)
 */
function bytesToBase64Blob(bytes: Uint8Array): Blob {
  return encodeBase64(bytes)
}

/**
 * Convert Base64 Blob to Uint8Array
 */
function base64BlobToBytes(blob: Blob): Uint8Array {
  return decodeBase64(blob)
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
    const configService = getMainService().getConfigService()

    return {
      // Order matches desired response exactly
      deposit_per_item: BigInt(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT), // B_I
      deposit_per_byte: BigInt(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT), // B_L
      deposit_per_account: BigInt(DEPOSIT_CONSTANTS.C_BASEDEPOSIT), // B_S
      core_count: configService.numCores, // C
      min_turnaround_period: configService.preimageExpungePeriod, // D - C_expungeperiod (period after which unreferenced preimage may be expunged)
      epoch_period: configService.epochDuration, // E
      max_accumulate_gas: WORK_REPORT_CONSTANTS.C_REPORTACCGAS, // G_A
      max_is_authorized_gas: AUTHORIZATION_CONSTANTS.C_PACKAGEAUTHGAS, // G_I
      max_refine_gas: configService.maxRefineGas, // G_R
      block_gas_limit: configService.maxBlockGas, // G_T
      recent_block_count: HISTORY_CONSTANTS.C_RECENTHISTORYLEN, // H
      max_work_items: WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEITEMS, // I
      max_dependencies: WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS, // J
      max_tickets_per_block: configService.maxTicketsPerExtrinsic, // K
      max_lookup_anchor_age: configService.maxLookupAnchorage, // L
      tickets_attempts_number: configService.ticketsPerValidator, // N
      auth_window: AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE, // O
      slot_period_sec: configService.slotDuration / 1000, // P (convert ms to seconds)
      auth_queue_len: AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE, // Q
      rotation_period: configService.rotationPeriod, // R
      max_extrinsics: WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEXTS, // T
      availability_timeout: TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD, // U
      val_count: configService.numValidators, // V
      max_authorizer_code_size: AUTHORIZATION_CONSTANTS.C_MAXAUTHCODESIZE, // W_A
      max_input: WORK_PACKAGE_CONSTANTS.C_MAXBUNDLESIZE, // W_B
      max_service_code_size: SERVICE_CONSTANTS.C_MAXSERVICECODESIZE, // W_C
      basic_piece_len: configService.ecPieceSize, // W_E
      max_imports: WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEIMPORTS, // W_M
      segment_piece_count: configService.numEcPiecesPerSegment, // W_P
      max_report_elective_data: WORK_REPORT_CONSTANTS.C_MAXREPORTVARSIZE, // W_R
      transfer_memo_size: TRANSFER_CONSTANTS.C_MEMOSIZE, // W_T
      max_exports: WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEEXPORTS, // W_X
      epoch_tail_start: configService.contestDuration, // Y
    }
  }

  // ============================================================================
  // Block Methods
  // ============================================================================

  /**
   * bestBlock - Returns the header hash and slot of the head of the "best" chain
   * JIP-2: Returns Block Descriptor with Base64-encoded hash
   */
  async bestBlock(): Promise<{ hash: Hash; slot: bigint }> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const clockService = mainService.getClockService()

    const recentHistory = recentHistoryService.getRecentHistory()
    if (recentHistory.length === 0) {
      return { hash: hexToBase64Hash(zeroHash), slot: 0n }
    }

    const latestBlock = recentHistory[recentHistory.length - 1]
    const currentSlot = clockService.getCurrentSlot()

    return {
      hash: hexToBase64Hash(latestBlock.headerHash),
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
   * JIP-2: Returns Block Descriptor with Base64-encoded hash
   */
  async finalizedBlock(): Promise<{ hash: Hash; slot: bigint }> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const clockService = mainService.getClockService()

    const recentHistory = recentHistoryService.getRecentHistory()
    if (recentHistory.length === 0) {
      return { hash: hexToBase64Hash(`0x${'0'.repeat(64)}` as Hex), slot: 0n }
    }

    // Oldest block in recent history is considered finalized
    const finalizedBlock = recentHistory[0]
    const currentSlot = clockService.getCurrentSlot()
    const finalizedSlot = currentSlot - BigInt(recentHistory.length - 1)

    return {
      hash: hexToBase64Hash(finalizedBlock.headerHash),
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
   * JIP-2: Accepts Base64-encoded hash, returns Block Descriptor with Base64-encoded hash
   */
  async parent(blockHash: Hash): Promise<{ hash: Hash; slot: bigint } | null> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const clockService = mainService.getClockService()

    const blockHashHex = base64HashToHex(blockHash)
    const recentHistory = recentHistoryService.getRecentHistory()
    const blockIndex = recentHistory.findIndex(
      (entry) => entry.headerHash === blockHashHex,
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
      hash: hexToBase64Hash(parentBlock.headerHash),
      slot: parentSlot > 0n ? parentSlot : 0n,
    }
  }

  /**
   * stateRoot - Returns the posterior state root of the block
   * JIP-2: Accepts Base64-encoded hash, returns Base64-encoded hash
   */
  async stateRoot(blockHash: Hash): Promise<Hash | null> {
    const recentHistoryService = getMainService().getRecentHistoryService()

    const blockHashHex = base64HashToHex(blockHash)
    const blockEntry =
      recentHistoryService.getRecentHistoryForBlock(blockHashHex)
    if (!blockEntry) {
      logger.debug('Block not found in recent history', blockHash)
      return null
    }

    return hexToBase64Hash(blockEntry.stateRoot)
  }

  /**
   * beefyRoot - Returns the BEEFY root (accumulation output log super-peak) of the block
   *
   * Gray Paper: The accoutLogSuperPeak is the Merkle mountain range commitment
   * that serves as the BEEFY finality commitment root.
   * JIP-2: Accepts Base64-encoded hash, returns Base64-encoded hash
   */
  async beefyRoot(blockHash: Hash): Promise<Hash | null> {
    const recentHistoryService = getMainService().getRecentHistoryService()

    const blockHashHex = base64HashToHex(blockHash)
    const blockEntry =
      recentHistoryService.getRecentHistoryForBlock(blockHashHex)
    if (!blockEntry) {
      return null
    }

    // accoutLogSuperPeak is the BEEFY root (accumulation output log super-peak)
    return hexToBase64Hash(blockEntry.accoutLogSuperPeak)
  }

  // ============================================================================
  // Statistics Methods
  // ============================================================================

  /**
   * statistics - Returns activity statistics encoded as per Gray Paper
   * JIP-2: Accepts Base64-encoded hash, returns Base64-encoded blob
   */
  async statistics(blockHash: Hash): Promise<Blob | null> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const statisticsService = mainService.getStatisticsService()
    const configService = mainService.getConfigService()

    // Verify block exists
    const blockHashHex = base64HashToHex(blockHash)
    const blockEntry =
      recentHistoryService.getRecentHistoryForBlock(blockHashHex)
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

    return bytesToBase64Blob(encoded)
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
   * JIP-2: Accepts Base64-encoded hash, returns Base64-encoded blob
   */
  async serviceData(blockHash: Hash, serviceId: number): Promise<Blob | null> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const serviceAccountService = mainService.getServiceAccountService()
    const configService = mainService.getConfigService()

    // Verify block exists
    const blockHashHex = base64HashToHex(blockHash)
    const blockEntry =
      recentHistoryService.getRecentHistoryForBlock(blockHashHex)
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

    return bytesToBase64Blob(encoded)
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
   * JIP-2: Accepts Base64-encoded hash and blob, returns Base64-encoded blob
   */
  async serviceValue(
    blockHash: Hash,
    serviceId: number,
    key: Blob,
  ): Promise<Blob | null> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const serviceAccountService = mainService.getServiceAccountService()

    // Verify block exists
    const blockHashHex = base64HashToHex(blockHash)
    const blockEntry =
      recentHistoryService.getRecentHistoryForBlock(blockHashHex)
    if (!blockEntry) {
      return null
    }

    const keyBytes = base64BlobToBytes(key)
    const keyHex = bytesToHex(keyBytes)
    const value = serviceAccountService.getStorageValue(
      BigInt(serviceId),
      keyHex,
    )

    if (!value) {
      logger.debug('Storage value not found', serviceId, keyHex)
      return null
    }

    return bytesToBase64Blob(value)
  }

  /**
   * subscribeServiceValue - Subscribe to service value updates
   * JIP-2: Accepts Base64-encoded blob for key
   */
  subscribeServiceValue(
    serviceId: number,
    key: Blob,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    return this.subscriptionManager.addSubscription(ws, 'serviceValue', [
      serviceId,
      key,
      finalized,
    ])
  }

  /**
   * servicePreimage - Returns preimage for a service by hash
   * JIP-2: Accepts Base64-encoded hashes, returns Base64-encoded blob
   */
  async servicePreimage(
    blockHash: Hash,
    serviceId: number,
    hash: Hash,
  ): Promise<Blob | null> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const serviceAccountService = mainService.getServiceAccountService()
    const clockService = mainService.getClockService()

    // Verify block exists
    const blockHashHex = base64HashToHex(blockHash)
    const blockEntry =
      recentHistoryService.getRecentHistoryForBlock(blockHashHex)
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
    const hashHex = base64HashToHex(hash)
    const currentSlot = clockService.getCurrentSlot()
    const [lookupError, preimage] =
      serviceAccountService.histLookupServiceAccount(
        BigInt(serviceId),
        serviceAccount,
        hashHex,
        currentSlot,
      )

    if (lookupError || !preimage) {
      logger.debug('Preimage not found', serviceId, hash)
      return null
    }

    return bytesToBase64Blob(preimage)
  }

  /**
   * subscribeServicePreimage - Subscribe to service preimage updates
   * JIP-2: Accepts Base64-encoded hash
   */
  subscribeServicePreimage(
    serviceId: number,
    hash: Hash,
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
   * JIP-2: Accepts Base64-encoded hashes
   */
  async serviceRequest(
    blockHash: Hash,
    serviceId: number,
    hash: Hash,
    length: number,
  ): Promise<bigint[] | null> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const serviceAccountService = mainService.getServiceAccountService()

    // Verify block exists
    const blockHashHex = base64HashToHex(blockHash)
    const blockEntry =
      recentHistoryService.getRecentHistoryForBlock(blockHashHex)
    if (!blockEntry) {
      return null
    }

    // Get preimage request status using the new method
    const hashHex = base64HashToHex(hash)
    const requestStatus = serviceAccountService.getPreimageRequestStatus(
      BigInt(serviceId),
      hashHex,
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
   * JIP-2: Accepts Base64-encoded hash
   */
  subscribeServiceRequest(
    serviceId: number,
    hash: Hash,
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
   * JIP-2: Accepts Base64-encoded hash
   */
  async listServices(blockHash: Hash): Promise<bigint[]> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const serviceAccountService = mainService.getServiceAccountService()

    // Verify block exists
    const blockHashHex = base64HashToHex(blockHash)
    const blockEntry =
      recentHistoryService.getRecentHistoryForBlock(blockHashHex)
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
   * JIP-2: Accepts Base64-encoded blobs
   *
   * @param coreIndex - Target core index for the work package
   * @param workPackageBlob - Base64-encoded work package (Gray Paper format)
   * @param extrinsics - Array of Base64-encoded extrinsic data blobs
   */
  async submitWorkPackage(
    coreIndex: bigint,
    workPackageBlob: Blob,
    extrinsics: Blob[],
  ): Promise<void> {
    const eventBusService = getMainService().getEventBusService()

    logger.info(
      'Submitting work package via event bus',
      Number(coreIndex),
      workPackageBlob.length,
      extrinsics.length,
    )

    // Decode work package from Base64 blob
    const workPackageBytes = base64BlobToBytes(workPackageBlob)
    const [decodeError, decodeResult] = decodeWorkPackage(workPackageBytes)
    if (decodeError) {
      logger.error('Failed to decode work package', decodeError)
      throw new Error(`Failed to decode work package: ${decodeError}`)
    }

    const workPackage: WorkPackage = decodeResult.value

    // Decode and concatenate all extrinsics into a single blob
    const extrinsicsBytes = extrinsics.map((ext) => base64BlobToBytes(ext))
    const totalLength = extrinsicsBytes.reduce(
      (sum, ext) => sum + ext.length,
      0,
    )
    const extrinsicData = new Uint8Array(totalLength)
    let offset = 0
    for (const ext of extrinsicsBytes) {
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
   * JIP-2: Accepts Base64-encoded blob and hash
   *
   * @param serviceId - Service ID requesting the preimage
   * @param preimage - Base64-encoded preimage data
   * @param blockHash - Base64-encoded block hash for best-chain validation
   */
  async submitPreimage(
    serviceId: bigint,
    preimage: Blob,
    blockHash: Hash,
  ): Promise<void> {
    const mainService = getMainService()
    const recentHistoryService = mainService.getRecentHistoryService()
    const serviceAccountService = mainService.getServiceAccountService()
    const clockService = mainService.getClockService()

    const preimageBytes = base64BlobToBytes(preimage)
    logger.info('Submitting preimage', Number(serviceId), preimageBytes.length)

    // Verify block exists (for best-chain validation)
    const blockHashHex = base64HashToHex(blockHash)
    const blockEntry =
      recentHistoryService.getRecentHistoryForBlock(blockHashHex)
    if (!blockEntry) {
      throw new Error('Block not found in recent history')
    }

    // Store preimage
    const currentSlot = clockService.getCurrentSlot()
    const [error] = serviceAccountService.storePreimage(
      {
        requester: serviceId,
        blob: bytesToHex(preimageBytes) as Hex,
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
