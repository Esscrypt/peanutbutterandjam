/**
 * Status Emitter Service
 *
 * Emits JIP-3 status events (event type 10) periodically every ~2 seconds
 * as specified in JIP-3.md section "10: Status"
 */

import { getAllServicePreimages } from '@pbnjam/codec'
import { bytesToHex, type EventBusService, logger } from '@pbnjam/core'
import type { IConfigService, SafePromise } from '@pbnjam/types'
import { BaseService, safeResult } from '@pbnjam/types'
import type { NetworkingService } from './networking-service'
import type { ServiceAccountService } from './service-account-service'
import type { ShardService } from './shard-service'
import type { TelemetryEventEmitterService } from './telemetry'
import type { ValidatorSetManager } from './validator-set'
import type { WorkReportService } from './work-report-service'

export class StatusEmitterService extends BaseService {
  private readonly configService: IConfigService
  private readonly networkingService: NetworkingService
  private readonly shardService: ShardService
  private readonly serviceAccountService: ServiceAccountService
  private readonly telemetryService: TelemetryEventEmitterService
  private readonly validatorSetManager: ValidatorSetManager
  private readonly workReportService: WorkReportService
  private readonly eventBusService: EventBusService

  // Track peers with block announcement streams (UP0, kind 0)
  private readonly blockAnnouncementPeers: Set<string> = new Set()

  private statusInterval: NodeJS.Timeout | null = null
  private isRunning = false

  constructor(options: {
    configService: IConfigService
    networkingService: NetworkingService
    shardService: ShardService
    serviceAccountService: ServiceAccountService
    telemetryService: TelemetryEventEmitterService
    validatorSetManager: ValidatorSetManager
    workReportService: WorkReportService
    eventBusService: EventBusService
  }) {
    super('status-emitter-service')
    this.configService = options.configService
    this.networkingService = options.networkingService
    this.shardService = options.shardService
    this.serviceAccountService = options.serviceAccountService
    this.telemetryService = options.telemetryService
    this.validatorSetManager = options.validatorSetManager
    this.workReportService = options.workReportService
    this.eventBusService = options.eventBusService

    // Listen for block announcement events to track UP0 streams
    this.eventBusService.addBlockAnnouncedCallback(
      (peerId: Uint8Array, _connectionSide: 'local' | 'remote') => {
        const peerIdHex = bytesToHex(peerId)
        this.blockAnnouncementPeers.add(peerIdHex)
      },
    )
  }

  async start(): SafePromise<boolean> {
    if (this.isRunning) {
      return safeResult(true)
    }

    this.isRunning = true
    this.startStatusEmission()

    return safeResult(true)
  }

  async stop(): SafePromise<boolean> {
    if (!this.isRunning) {
      return safeResult(true)
    }

    this.isRunning = false
    this.stopStatusEmission()

    return safeResult(true)
  }

  /**
   * Start periodic status emission (every ~2 seconds as per JIP-3)
   */
  private startStatusEmission(): void {
    // Clear any existing interval
    if (this.statusInterval) {
      clearInterval(this.statusInterval)
    }

    // Emit status immediately, then every ~2 seconds
    this.emitStatus()
    this.statusInterval = setInterval(() => {
      this.emitStatus()
    }, 2000)
  }

  /**
   * Stop periodic status emission
   */
  private stopStatusEmission(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval)
      this.statusInterval = null
    }
  }

  /**
   * Collect status data and emit status event
   */
  private async emitStatus(): Promise<void> {
    try {
      // Collect peer counts
      const totalPeerCount = BigInt(
        this.networkingService.publicKeyToConnection.size,
      )

      // Count validator peers
      let validatorPeerCount = 0n
      const activeValidators = this.validatorSetManager.getActiveValidators()
      const pendingValidators = this.validatorSetManager.getPendingValidators()
      const previousValidators =
        this.validatorSetManager.getPreviousValidators()

      const validatorPublicKeys = new Set<string>()
      for (const validator of activeValidators) {
        validatorPublicKeys.add(validator.ed25519)
      }
      for (const validator of pendingValidators) {
        validatorPublicKeys.add(validator.ed25519)
      }
      for (const validator of previousValidators) {
        validatorPublicKeys.add(validator.ed25519)
      }

      // Count how many connected peers are validators
      for (const peerPublicKey of this.networkingService.publicKeyToConnection.keys()) {
        if (validatorPublicKeys.has(peerPublicKey)) {
          validatorPeerCount++
        }
      }

      // Count peers with block announcement stream open (UP0, kind 0)
      // Track peers that have sent block announcements
      const blockAnnouncementStreamPeerCount = BigInt(
        this.blockAnnouncementPeers.size,
      )

      // Get guarantees by core
      // JIP-3: [u8; C] where C is the total number of cores
      // Count pending work reports per core (these represent guarantees in the pool)
      const numCores = this.configService.numCores
      const guaranteesByCore = new Uint8Array(numCores)

      // Get pending reports from work report service
      // Each pending report represents a guarantee in the pool
      const pendingReports = this.workReportService.getPendingReports()
      for (
        let i = 0;
        i < numCores && i < pendingReports.coreReports.length;
        i++
      ) {
        // Count 1 if there's a pending report for this core, 0 otherwise
        guaranteesByCore[i] = pendingReports.coreReports[i] !== null ? 1 : 0
      }

      // Get shard count and total size from shard service
      const shardStats = this.shardService.getShardStats()
      const shardCount = shardStats.count
      const shardTotalSizeBytes = shardStats.totalSizeBytes

      // Get preimage count and total size
      // JIP-3: "Number of preimages in pool, ready to be included in a block"
      // This means preimages that are requested on-chain and ready
      // Use getAllServiceRequests to efficiently get all requests, then match with preimages
      let readyPreimageCount = 0n
      let readyPreimageTotalSizeBytes = 0n

      // Iterate through all service accounts to count ready preimages
      const serviceIds = this.serviceAccountService.listServiceIds()
      for (const serviceId of serviceIds) {
        const [accountError, serviceAccount] =
          this.serviceAccountService.getServiceAccount(serviceId)
        if (accountError || !serviceAccount) {
          continue
        }

        // Get all preimages for this service
        const preimages = getAllServicePreimages(serviceAccount)

        // For each preimage, check if it has a request (is ready to be included)
        // A preimage is "ready" if it exists AND is requested on-chain
        for (const [, preimageData] of preimages) {
          const { preimageHash, blob } = preimageData
          const blobLength = BigInt(blob.length)

          // Check if this preimage is requested on-chain using the actual blob length
          const requestStatus =
            this.serviceAccountService.getPreimageRequestStatus(
              serviceId,
              preimageHash,
              blobLength,
            )

          // A preimage is ready if it exists and has a request status
          // Request status is an array of timeslots - if it exists and has entries, it's requested
          if (requestStatus !== undefined && requestStatus.length > 0) {
            readyPreimageCount++
            readyPreimageTotalSizeBytes += blobLength
          }
        }
      }

      // Emit status event
      const [emitError] = await this.telemetryService.emitStatus({
        totalPeerCount,
        validatorPeerCount,
        blockAnnouncementStreamPeerCount,
        guaranteesByCore,
        shardCount,
        shardTotalSizeBytes,
        readyPreimageCount,
        readyPreimageTotalSizeBytes,
      })

      if (emitError) {
        logger.error('[StatusEmitter] Failed to emit status event', {
          error: emitError.message,
        })
      }
    } catch (error) {
      logger.error('[StatusEmitter] Error emitting status event', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
