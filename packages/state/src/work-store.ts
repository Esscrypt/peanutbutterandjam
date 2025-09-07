/**
 * Work Store - Database Integration for JAM Work Packages, Reports, and Digests
 *
 * Provides storage and retrieval of JAM work packages, work reports, and work digests
 * using fully normalized tables following Gray Paper specifications.
 */

import {
  bytesToHex,
  type Hex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  calculateWorkPackageHash,
  calculateWorkReportHash,
  decodeWorkPackage,
  decodeWorkReport,
  encodeWorkPackage,
  encodeWorkReport,
} from '@pbnj/serialization'
import type { WorkPackage, WorkReport, WorkResult } from '@pbnj/types'
import { and, count, desc, eq, sum } from 'drizzle-orm'
import type { CoreDb } from './index'
import {
  type DbNewWorkDigest,
  type DbNewWorkItem,
  type DbNewWorkPackage,
  type DbNewWorkReport,
  type DbWorkPackage,
  type DbWorkReport,
  workDigests,
  workItems,
  workPackages,
  workReports,
} from './schema/core-schema'

/**
 * Work package status for tracking
 */
export type WorkPackageStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'

/**
 * Work report status for tracking
 */
export type WorkReportStatus =
  | 'pending'
  | 'guaranteed'
  | 'available'
  | 'finalized'

/**
 * Work package query options
 */
export interface WorkPackageQuery {
  /** Filter by status */
  status?: WorkPackageStatus
  /** Filter by core index */
  coreIndex?: number
  /** Filter by auth code host */
  authCodeHost?: bigint
  /** Filter by context anchor */
  contextAnchor?: Hex
  /** Limit results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Work report query options
 */
export interface WorkReportQuery {
  /** Filter by status */
  status?: WorkReportStatus
  /** Filter by core index */
  coreIndex?: bigint
  /** Filter by authorizer */
  authorizer?: Hex
  /** Filter by package hash */
  packageHash?: Hex
  /** Limit results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Work statistics
 */
export interface WorkStats {
  totalPackages: number
  pendingPackages: number
  processingPackages: number
  completedPackages: number
  failedPackages: number
  totalReports: number
  pendingReports: number
  guaranteedReports: number
  availableReports: number
  finalizedReports: number
  totalDigests: number
  avgGasUsedPerDigest: number
}

/**
 * Work Store for JAM work packages, reports, and digests
 */
export class WorkStore {
  constructor(private db: CoreDb) {}

  /**
   * Store a work package with its work items
   */
  async storeWorkPackage(
    workPackage: WorkPackage,
    status: WorkPackageStatus = 'pending',
    coreIndex?: number,
  ): Promise<Safe<{ packageHash: Hex }>> {
    const [hashError, packageHash] = calculateWorkPackageHash(workPackage)
    if (hashError) {
      return safeError(hashError)
    }

    const [encodeError, encoded] = encodeWorkPackage(workPackage)
    if (encodeError) {
      return safeError(encodeError)
    }

    try {
      const result = await this.db.transaction(async (tx) => {
        // Store work package
        const packageData: DbNewWorkPackage = {
          packageHash,
          authToken: workPackage.authToken,
          authCodeHost: workPackage.authCodeHost,
          authCodeHash: workPackage.authCodeHash,
          authConfig: workPackage.authConfig,
          contextAnchor: workPackage.context.anchorHash,
          contextState: workPackage.context.anchorPostState,
          contextBelief: workPackage.context.anchorAccoutLog,
          contextEpochMark: workPackage.context.lookupAnchorHash,
          workItemCount: workPackage.workItems.length,
          data: bytesToHex(encoded),
          status,
          coreIndex: coreIndex || null,
        }

        await tx.insert(workPackages).values(packageData).onConflictDoNothing()

        // Store work items
        if (workPackage.workItems.length > 0) {
          const itemsData: DbNewWorkItem[] = workPackage.workItems.map(
            (item, index) => ({
              workPackageHash: packageHash,
              serviceIndex: item.serviceindex,
              codeHash: item.codehash,
              payload: item.payload,
              gasLimit: item.refgaslimit,
              accGasLimit: item.accgaslimit,
              importSegments: JSON.stringify(item.importsegments), //TODO: Fix this
              extrinsics: JSON.stringify(item.extrinsics), //TODO: Fix this
              exportCount: Number(item.exportcount),
              sequenceIndex: index,
            }),
          )

          await tx.insert(workItems).values(itemsData)
        }

        return { packageHash }
      })

      return safeResult(result)
    } catch (error) {
      return safeError(new Error(`Failed to store work package: ${error}`))
    }
  }

  /**
   * Get work package by hash
   */
  async getWorkPackage(packageHash: Hex): Promise<WorkPackage | null> {
    try {
      const result = await this.db
        .select()
        .from(workPackages)
        .where(eq(workPackages.packageHash, packageHash))
        .limit(1)

      if (result.length === 0) return null

      const packageData = result[0]
      const [decodeError, workPackage] = decodeWorkPackage(
        hexToBytes(packageData.data),
      )

      if (decodeError) {
        console.error('Failed to decode work package:', decodeError)
        return null
      }

      return workPackage.value
    } catch (error) {
      console.error('Failed to get work package:', error)
      return null
    }
  }

  /**
   * Store a work report with its work digests
   */
  async storeWorkReport(
    workReport: WorkReport,
    workPackageHash?: Hex,
    status: WorkReportStatus = 'pending',
  ): Promise<Safe<{ reportHash: Hex }>> {
    const [hashError, reportHash] = calculateWorkReportHash(workReport)
    if (hashError) {
      return safeError(hashError)
    }

    const [encodeError, encoded] = encodeWorkReport(workReport)
    if (encodeError) {
      return safeError(encodeError)
    }

    try {
      const result = await this.db.transaction(async (tx) => {
        // Store work report
        const reportData: DbNewWorkReport = {
          reportHash,
          workPackageHash: workPackageHash || null,
          coreIndex: workReport.coreIndex,
          authorizer: workReport.authorizer,
          authTrace: bytesToHex(workReport.authTrace),
          authGasUsed: workReport.authGasUsed,
          packageHash: workReport.availabilitySpec.packageHash,
          erasureRoot: workReport.availabilitySpec.erasureRoot,
          exportsRoot: workReport.availabilitySpec.segmentRoot,
          exportsCount: Number(workReport.availabilitySpec.segmentCount),
          contextAnchor: workReport.context.anchorHash,
          contextState: workReport.context.anchorPostState,
          contextBelief: workReport.context.anchorAccoutLog,
          contextEpochMark: workReport.context.lookupAnchorHash,
          digestCount: workReport.digests.length,
          srLookup: JSON.stringify(Object.fromEntries(workReport.srLookup)),
          data: bytesToHex(encoded),
          status,
        }

        await tx.insert(workReports).values(reportData).onConflictDoNothing()

        // Store work digests
        if (workReport.digests.length > 0) {
          const digestsData: DbNewWorkDigest[] = workReport.digests.map(
            (digest, index) => ({
              workReportHash: reportHash,
              serviceIndex: digest.serviceIndex,
              codeHash: digest.codeHash,
              payloadHash: digest.payloadHash,
              gasLimit: digest.gasLimit,
              gasUsed: digest.gasUsed,
              result: this.serializeWorkResult(digest.result),
              isError: this.isWorkResultError(digest.result),
              importCount: digest.importCount,
              extrinsicCount: digest.extrinsicCount,
              extrinsicSize: digest.extrinsicSize,
              exportCount: digest.exportCount,
              sequenceIndex: index,
            }),
          )

          await tx.insert(workDigests).values(digestsData)
        }

        return { reportHash }
      })

      return safeResult(result)
    } catch (error) {
      return safeError(new Error(`Failed to store work report: ${error}`))
    }
  }

  /**
   * Get work report by hash
   */
  async getWorkReport(reportHash: Hex): Promise<WorkReport | null> {
    try {
      const result = await this.db
        .select()
        .from(workReports)
        .where(eq(workReports.reportHash, reportHash))
        .limit(1)

      if (result.length === 0) return null

      const reportData = result[0]
      const [decodeError, workReport] = decodeWorkReport(
        hexToBytes(reportData.data),
      )

      if (decodeError) {
        console.error('Failed to decode work report:', decodeError)
        return null
      }

      return workReport.value
    } catch (error) {
      console.error('Failed to get work report:', error)
      return null
    }
  }

  /**
   * Query work packages
   */
  async queryWorkPackages(
    query: WorkPackageQuery = {},
  ): Promise<DbWorkPackage[]> {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM type complexity
      let dbQuery: any = this.db.select().from(workPackages)

      // Apply filters
      const conditions = []
      if (query.status) {
        conditions.push(eq(workPackages.status, query.status))
      }
      if (query.coreIndex !== undefined) {
        conditions.push(eq(workPackages.coreIndex, query.coreIndex))
      }
      if (query.authCodeHost) {
        conditions.push(eq(workPackages.authCodeHost, query.authCodeHost))
      }
      if (query.contextAnchor) {
        conditions.push(eq(workPackages.contextAnchor, query.contextAnchor))
      }

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions))
      }

      // Order by creation time (newest first)
      dbQuery = dbQuery.orderBy(desc(workPackages.createdAt))

      // Apply pagination
      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit)
      }
      if (query.offset) {
        dbQuery = dbQuery.offset(query.offset)
      }

      return await dbQuery
    } catch (error) {
      console.error('Failed to query work packages:', error)
      return []
    }
  }

  /**
   * Query work reports
   */
  async queryWorkReports(query: WorkReportQuery = {}): Promise<DbWorkReport[]> {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle ORM type complexity
      let dbQuery: any = this.db.select().from(workReports)

      // Apply filters
      const conditions = []
      if (query.status) {
        conditions.push(eq(workReports.status, query.status))
      }
      if (query.coreIndex !== undefined) {
        conditions.push(eq(workReports.coreIndex, query.coreIndex))
      }
      if (query.authorizer) {
        conditions.push(eq(workReports.authorizer, query.authorizer))
      }
      if (query.packageHash) {
        conditions.push(eq(workReports.packageHash, query.packageHash))
      }

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions))
      }

      // Order by creation time (newest first)
      dbQuery = dbQuery.orderBy(desc(workReports.createdAt))

      // Apply pagination
      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit)
      }
      if (query.offset) {
        dbQuery = dbQuery.offset(query.offset)
      }

      return await dbQuery
    } catch (error) {
      console.error('Failed to query work reports:', error)
      return []
    }
  }

  /**
   * Update work package status
   */
  async updateWorkPackageStatus(
    packageHash: Hex,
    status: WorkPackageStatus,
  ): Promise<boolean> {
    try {
      await this.db
        .update(workPackages)
        .set({
          status,
          processedAt: status === 'completed' ? new Date() : undefined,
        })
        .where(eq(workPackages.packageHash, packageHash))

      return true
    } catch (error) {
      console.error('Failed to update work package status:', error)
      return false
    }
  }

  /**
   * Update work report status
   */
  async updateWorkReportStatus(
    reportHash: Hex,
    status: WorkReportStatus,
  ): Promise<boolean> {
    try {
      const updateData: Partial<DbWorkReport> = { status }

      if (status === 'guaranteed') {
        updateData.guaranteedAt = new Date()
      } else if (status === 'finalized') {
        updateData.finalizedAt = new Date()
      }

      await this.db
        .update(workReports)
        .set(updateData)
        .where(eq(workReports.reportHash, reportHash))

      return true
    } catch (error) {
      console.error('Failed to update work report status:', error)
      return false
    }
  }

  /**
   * Get work statistics
   */
  async getWorkStats(): Promise<WorkStats> {
    try {
      const [packageStats, reportStats, digestStats] = await Promise.all([
        // Package statistics
        this.db
          .select({
            total: count(),
            pending: sum(eq(workPackages.status, 'pending')),
            processing: sum(eq(workPackages.status, 'processing')),
            completed: sum(eq(workPackages.status, 'completed')),
            failed: sum(eq(workPackages.status, 'failed')),
          })
          .from(workPackages),

        // Report statistics
        this.db
          .select({
            total: count(),
            pending: sum(eq(workReports.status, 'pending')),
            guaranteed: sum(eq(workReports.status, 'guaranteed')),
            available: sum(eq(workReports.status, 'available')),
            finalized: sum(eq(workReports.status, 'finalized')),
          })
          .from(workReports),

        // Digest statistics
        this.db
          .select({
            total: count(),
            avgGasUsed: sum(workDigests.gasUsed),
          })
          .from(workDigests),
      ])

      const packageStat = packageStats[0]
      const reportStat = reportStats[0]
      const digestStat = digestStats[0]

      return {
        totalPackages: packageStat?.total || 0,
        pendingPackages: Number(packageStat?.pending || 0),
        processingPackages: Number(packageStat?.processing || 0),
        completedPackages: Number(packageStat?.completed || 0),
        failedPackages: Number(packageStat?.failed || 0),
        totalReports: reportStat?.total || 0,
        pendingReports: Number(reportStat?.pending || 0),
        guaranteedReports: Number(reportStat?.guaranteed || 0),
        availableReports: Number(reportStat?.available || 0),
        finalizedReports: Number(reportStat?.finalized || 0),
        totalDigests: digestStat?.total || 0,
        avgGasUsedPerDigest: digestStat?.total
          ? Number(digestStat.avgGasUsed || 0) / digestStat.total
          : 0,
      }
    } catch (error) {
      console.error('Failed to get work stats:', error)
      return {
        totalPackages: 0,
        pendingPackages: 0,
        processingPackages: 0,
        completedPackages: 0,
        failedPackages: 0,
        totalReports: 0,
        pendingReports: 0,
        guaranteedReports: 0,
        availableReports: 0,
        finalizedReports: 0,
        totalDigests: 0,
        avgGasUsedPerDigest: 0,
      }
    }
  }

  /**
   * Check if work package exists
   */
  async hasWorkPackage(packageHash: Hex): Promise<boolean> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(workPackages)
        .where(eq(workPackages.packageHash, packageHash))

      return (result[0]?.count || 0) > 0
    } catch (error) {
      console.error('Failed to check work package existence:', error)
      return false
    }
  }

  /**
   * Check if work report exists
   */
  async hasWorkReport(reportHash: Hex): Promise<boolean> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(workReports)
        .where(eq(workReports.reportHash, reportHash))

      return (result[0]?.count || 0) > 0
    } catch (error) {
      console.error('Failed to check work report existence:', error)
      return false
    }
  }

  /**
   * Serialize work result for database storage
   */
  private serializeWorkResult(result: WorkResult): Hex {
    if (typeof result === 'string') {
      // Error case
      return bytesToHex(new TextEncoder().encode(result))
    } else {
      // Success case (Uint8Array)
      return bytesToHex(result)
    }
  }

  /**
   * Check if work result is an error
   */
  private isWorkResultError(result: WorkResult): boolean {
    return typeof result === 'string'
  }
}
