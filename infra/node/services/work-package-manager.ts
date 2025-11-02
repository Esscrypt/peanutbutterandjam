/**
 * Work Package Manager Service
 *
 * Gray Paper Reference: reporting_assurance.tex, work_packages_and_reports.tex
 *
 * Manages the lifecycle of work packages and work reports according to the Gray Paper:
 *
 * Work Package Lifecycle:
 * 1. **Submitted**: Builder submits work-package to guarantors
 * 2. **Evaluating**: Guarantor evaluates authorization and computes work-report
 * 3. **Guaranteed**: Work-report is signed and guarantee extrinsic is created
 * 4. **Reported**: Work-report is included on-chain (in reports state)
 * 5. **Erasure Coded**: Work-package is erasure coded and distributed
 * 6. **Assured**: Validators attest to availability (enough assurances received)
 * 7. **Available**: Work-report is ready for accumulation
 * 8. **Accumulated**: Work-digests have been applied to service state
 * 9. **Timed Out**: Work-report was not assured in time and can be replaced
 *
 * State Management:
 * - Gray Paper §6.1: reports ∈ sequence[C_corecount]{optional{tuple{workreport, timestamp}}}
 * - Only one work-report per core at a time
 * - Reports track: work-report + timestamp of reporting
 */

import type { EventBusService } from '@pbnj/core'
import type { Extrinsic, Safe, WorkPackage, WorkReport } from '@pbnj/types'
import {
  BaseService,
  safeError,
  safeResult,
  type WorkPackageSubmissionRequest,
} from '@pbnj/types'
import type { Hex } from 'viem'

/**
 * Work Package State according to Gray Paper lifecycle
 */
export type WorkPackageState =
  | 'submitted' // Builder submitted, waiting for evaluation
  | 'evaluating' // Guarantor is computing work-report
  | 'guaranteed' // Work-report signed, guarantee created
  | 'reported' // Work-report included on-chain (in reports state)
  | 'erasure_coded' // Erasure coded and distributed to validators
  | 'assured' // Availability assured by validators
  | 'available' // Available and ready for accumulation
  | 'accumulated' // Accumulated into service state
  | 'timed_out' // Failed to become available in time
  | 'rejected' // Failed validation or authorization

/**
 * Complete work package entry with metadata
 */
export interface WorkPackageEntry {
  /** The work package submitted by builder */
  workPackage: WorkPackage
  /** Associated extrinsic data */
  extrinsic: Extrinsic
  /** Current state in lifecycle */
  state: WorkPackageState
  /** Core index this work package is for */
  coreIndex: bigint
  /** Timestamp of submission */
  submittedAt: bigint
  /** Timestamp of last state change */
  updatedAt: bigint
  /** The computed work report (if guaranteed) */
  workReport?: WorkReport
  /** Timestamp when reported on-chain (if reported) */
  reportedAt?: bigint
  /** Number of assurances received (if erasure coded) */
  assuranceCount?: number
  /** Reason for rejection (if rejected) */
  rejectionReason?: string
}

/**
 * Work Package Manager Interface
 */
export interface IWorkPackageManager {
  /**
   * Add a newly submitted work package
   * Gray Paper: Initial state when builder submits to guarantor
   */
  addWorkPackage(
    workPackageHash: Hex,
    workPackage: WorkPackage,
    extrinsic: Extrinsic,
    coreIndex: bigint,
  ): Safe<void>

  /**
   * Get work package entry by hash
   */
  getWorkPackage(workPackageHash: Hex): WorkPackageEntry | undefined

  /**
   * Update work package state
   * Gray Paper: Reflects state transitions in the work package lifecycle
   */
  updateWorkPackageState(
    workPackageHash: Hex,
    newState: WorkPackageState,
    metadata?: {
      workReport?: WorkReport
      reportedAt?: bigint
      assuranceCount?: number
      rejectionReason?: string
    },
  ): Safe<void>

  /**
   * Attach work report to work package
   * Gray Paper: After guarantor computes work-report from work-package
   */
  attachWorkReport(workPackageHash: Hex, workReport: WorkReport): Safe<void>

  /**
   * Get pending work packages for a specific core
   * Gray Paper: For guarantors to check which packages need processing
   */
  getPendingWorkPackages(coreIndex: bigint): WorkPackageEntry[]

  /**
   * Get work packages by state
   */
  getWorkPackagesByState(state: WorkPackageState): WorkPackageEntry[]

  /**
   * Remove work package (after accumulation or timeout)
   * Gray Paper: Cleanup after work-report is accumulated or timed out
   */
  removeWorkPackage(workPackageHash: Hex): Safe<void>

  /**
   * Mark work package as reported on-chain
   * Gray Paper: When work-report is included in reports state
   */
  markAsReported(workPackageHash: Hex, timestamp: bigint): Safe<void>

  /**
   * Update assurance count
   * Gray Paper: Track validator attestations to availability
   */
  updateAssuranceCount(workPackageHash: Hex, assuranceCount: number): Safe<void>

  /**
   * Get work package for a core from reports state
   * Gray Paper: reports[core] = optional{tuple{workreport, timestamp}}
   */
  getReportedWorkPackage(coreIndex: bigint): WorkPackageEntry | undefined
}

/**
 * Work Package Manager Implementation
 */
export class WorkPackageManager
  extends BaseService
  implements IWorkPackageManager
{
  /** In-memory map of work packages */
  private readonly workPackages: Map<Hex, WorkPackageEntry> = new Map()

  /** Pending submissions indexed by core */
  private readonly pendingByCore: Map<bigint, Set<Hex>> = new Map()

  /** Reported work packages indexed by core (Gray Paper: reports state) */
  private readonly reportedByCore: Map<bigint, Hex> = new Map()

  /** Persistent storage */
  private readonly eventBusService

  constructor(options: { eventBus: EventBusService }) {
    super('work-package-manager')
    this.eventBusService = options.eventBus

    this.eventBusService.addWorkPackageSubmissionReceivedCallback(
      this.handleWorkPackageReceived,
    )
  }

  stop(): Safe<boolean> {
    this.eventBusService.removeWorkPackageSubmissionReceivedCallback(
      this.handleWorkPackageReceived,
    )
    return safeResult(true)
  }

  private handleWorkPackageReceived(
    _workPackage: WorkPackageSubmissionRequest,
  ) {
    // const { workPackageHash, workPackage, extrinsic, coreIndex } = workPackage
    // this.addWorkPackage(workPackageHash, workPackage, extrinsic, coreIndex)
    // this.updateWorkPackageState(workPackageHash, 'submitted')
  }

  /**
   * Add a newly submitted work package
   */
  addWorkPackage(
    workPackageHash: Hex,
    workPackage: WorkPackage,
    extrinsic: Extrinsic,
    coreIndex: bigint,
  ): Safe<void> {
    try {
      const now = BigInt(Date.now())

      const entry: WorkPackageEntry = {
        workPackage,
        extrinsic,
        state: 'submitted',
        coreIndex,
        submittedAt: now,
        updatedAt: now,
      }

      // Store in memory
      this.workPackages.set(workPackageHash, entry)

      // Index by core
      if (!this.pendingByCore.has(coreIndex)) {
        this.pendingByCore.set(coreIndex, new Set())
      }
      this.pendingByCore.get(coreIndex)?.add(workPackageHash)

      // Persist to database
      // void this.workStore.storeWorkPackage(
      //   workPackage,
      //   'pending',
      //   Number(coreIndex),
      // )

      return safeResult(undefined)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Get work package entry by hash
   */
  getWorkPackage(workPackageHash: Hex): WorkPackageEntry | undefined {
    return this.workPackages.get(workPackageHash)
  }

  /**
   * Update work package state
   */
  updateWorkPackageState(
    workPackageHash: Hex,
    newState: WorkPackageState,
    metadata?: {
      workReport?: WorkReport
      reportedAt?: bigint
      assuranceCount?: number
      rejectionReason?: string
    },
  ): Safe<void> {
    try {
      const entry = this.workPackages.get(workPackageHash)
      if (!entry) {
        return safeError(
          new Error(`Work package not found: ${workPackageHash}`),
        )
      }

      // Update state
      entry.state = newState
      entry.updatedAt = BigInt(Date.now())

      // Update metadata if provided
      if (metadata?.workReport) {
        entry.workReport = metadata.workReport
      }
      if (metadata?.reportedAt) {
        entry.reportedAt = metadata.reportedAt
      }
      if (metadata?.assuranceCount !== undefined) {
        entry.assuranceCount = metadata.assuranceCount
      }
      if (metadata?.rejectionReason) {
        entry.rejectionReason = metadata.rejectionReason
      }

      // Update indexes based on state
      if (newState === 'reported') {
        // Gray Paper: Only one report per core at a time
        this.reportedByCore.set(entry.coreIndex, workPackageHash)
        // Remove from pending
        this.pendingByCore.get(entry.coreIndex)?.delete(workPackageHash)
      }

      // Persist state change to database
      // const dbStatus = this.mapStateToDbStatus(newState)
      // void this.workStore.updateWorkPackageStatus(workPackageHash, dbStatus)

      return safeResult(undefined)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Attach work report to work package
   */
  attachWorkReport(workPackageHash: Hex, workReport: WorkReport): Safe<void> {
    try {
      const entry = this.workPackages.get(workPackageHash)
      if (!entry) {
        return safeError(
          new Error(`Work package not found: ${workPackageHash}`),
        )
      }

      entry.workReport = workReport
      entry.updatedAt = BigInt(Date.now())

      return safeResult(undefined)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Get pending work packages for a specific core
   */
  getPendingWorkPackages(coreIndex: bigint): WorkPackageEntry[] {
    const pendingHashes = this.pendingByCore.get(coreIndex)
    if (!pendingHashes) {
      return []
    }

    const pending: WorkPackageEntry[] = []
    for (const hash of pendingHashes) {
      const entry = this.workPackages.get(hash)
      if (entry && entry.state === 'submitted') {
        pending.push(entry)
      }
    }

    // Sort by submission time
    return pending.sort((a, b) => Number(a.submittedAt - b.submittedAt))
  }

  /**
   * Get work packages by state
   */
  getWorkPackagesByState(state: WorkPackageState): WorkPackageEntry[] {
    const packages: WorkPackageEntry[] = []

    for (const entry of this.workPackages.values()) {
      if (entry.state === state) {
        packages.push(entry)
      }
    }

    return packages
  }

  /**
   * Remove work package
   */
  removeWorkPackage(workPackageHash: Hex): Safe<void> {
    try {
      const entry = this.workPackages.get(workPackageHash)
      if (!entry) {
        return safeError(
          new Error(`Work package not found: ${workPackageHash}`),
        )
      }

      // Remove from indexes
      this.pendingByCore.get(entry.coreIndex)?.delete(workPackageHash)
      if (this.reportedByCore.get(entry.coreIndex) === workPackageHash) {
        this.reportedByCore.delete(entry.coreIndex)
      }

      // Remove from memory
      this.workPackages.delete(workPackageHash)

      return safeResult(undefined)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Mark work package as reported on-chain
   */
  markAsReported(workPackageHash: Hex, timestamp: bigint): Safe<void> {
    return this.updateWorkPackageState(workPackageHash, 'reported', {
      reportedAt: timestamp,
    })
  }

  /**
   * Update assurance count
   */
  updateAssuranceCount(
    workPackageHash: Hex,
    assuranceCount: number,
  ): Safe<void> {
    try {
      const entry = this.workPackages.get(workPackageHash)
      if (!entry) {
        return safeError(
          new Error(`Work package not found: ${workPackageHash}`),
        )
      }

      entry.assuranceCount = assuranceCount
      entry.updatedAt = BigInt(Date.now())

      // Check if we have enough assurances to mark as available
      // Gray Paper: Need super-majority (2/3+) of validators
      // TODO: Get actual validator count from config
      const REQUIRED_ASSURANCES = 342 // 2/3 of 513 validators

      if (assuranceCount >= REQUIRED_ASSURANCES && entry.state === 'assured') {
        entry.state = 'available'
      }

      return safeResult(undefined)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Get work package for a core from reports state
   */
  getReportedWorkPackage(coreIndex: bigint): WorkPackageEntry | undefined {
    const workPackageHash = this.reportedByCore.get(coreIndex)
    if (!workPackageHash) {
      return undefined
    }
    return this.workPackages.get(workPackageHash)
  }

  /**
   * Map internal state to database status
   */
  // private mapStateToDbStatus(
  //   state: WorkPackageState,
  // ): 'pending' | 'processing' | 'completed' | 'failed' {
  //   switch (state) {
  //     case 'submitted':
  //     case 'evaluating':
  //       return 'pending'
  //     case 'guaranteed':
  //     case 'reported':
  //     case 'erasure_coded':
  //     case 'assured':
  //     case 'available':
  //       return 'processing'
  //     case 'accumulated':
  //       return 'completed'
  //     case 'timed_out':
  //     case 'rejected':
  //       return 'failed'
  //     default:
  //       return 'pending'
  //   }
  // }
}
