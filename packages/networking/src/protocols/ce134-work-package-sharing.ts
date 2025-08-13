/**
 * CE 134: Work Package Sharing Protocol
 *
 * Implements the work package sharing protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for guarantors to share work packages.
 */

import type {
  Bytes,
  StreamInfo,
  WorkPackageSharing,
  WorkPackageSharingResponse,
} from '@pbnj/types'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * Work package sharing protocol handler
 */
export class WorkPackageSharingProtocol {
  private workPackageBundles: Map<
    string,
    { bundle: Bytes; coreIndex: number; timestamp: number }
  > = new Map()
  private segmentsRootMappings: Map<string, Bytes> = new Map()
  private dbIntegration: NetworkingDatabaseIntegration | null = null

  constructor(dbIntegration?: NetworkingDatabaseIntegration) {
    this.dbIntegration = dbIntegration || null
  }

  /**
   * Set database integration for persistent storage
   */
  setDatabaseIntegration(dbIntegration: NetworkingDatabaseIntegration): void {
    this.dbIntegration = dbIntegration
  }

  /**
   * Load state from database
   */
  async loadState(): Promise<void> {
    if (!this.dbIntegration) return

    try {
      // Load work package bundles from database (service ID 5 for work package sharing)
      console.log(
        'Work package sharing state loading - protocol not yet fully implemented',
      )
    } catch (error) {
      console.error(
        'Failed to load work package sharing state from database:',
        error,
      )
    }
  }

  /**
   * Store work package bundle in local store and persist to database
   */
  async storeWorkPackageBundle(
    bundleHash: Bytes,
    bundle: Bytes,
    coreIndex: number,
  ): Promise<void> {
    const hashString = bundleHash.toString()
    this.workPackageBundles.set(hashString, {
      bundle,
      coreIndex,
      timestamp: Date.now(),
    })

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          `bundle_${hashString}`,
          bundle,
        )

        // Store metadata
        const metadata = {
          coreIndex,
          timestamp: Date.now(),
          hash: Buffer.from(bundleHash).toString('hex'),
        }

        await this.dbIntegration.setServiceStorage(
          `bundle_meta_${hashString}`,
          Buffer.from(JSON.stringify(metadata), 'utf8'),
        )
      } catch (error) {
        console.error(
          'Failed to persist work package bundle to database:',
          error,
        )
      }
    }
  }

  /**
   * Store segments root mapping in local store and persist to database
   */
  async storeSegmentsRootMapping(
    workPackageHash: Bytes,
    segmentsRoot: Bytes,
  ): Promise<void> {
    const hashString = workPackageHash.toString()
    this.segmentsRootMappings.set(hashString, segmentsRoot)

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          `segments_root_${hashString}`,
          segmentsRoot,
        )
      } catch (error) {
        console.error(
          'Failed to persist segments root mapping to database:',
          error,
        )
      }
    }
  }

  /**
   * Get work package bundle from local store
   */
  getWorkPackageBundle(
    bundleHash: Bytes,
  ): { bundle: Bytes; coreIndex: number; timestamp: number } | undefined {
    return this.workPackageBundles.get(bundleHash.toString())
  }

  /**
   * Get segments root mapping from local store
   */
  getSegmentsRootMapping(workPackageHash: Bytes): Bytes | undefined {
    return this.segmentsRootMappings.get(workPackageHash.toString())
  }

  /**
   * Get work package bundle from database if not in local store
   */
  async getWorkPackageBundleFromDatabase(
    bundleHash: Bytes,
  ): Promise<{ bundle: Bytes; coreIndex: number; timestamp: number } | null> {
    if (this.getWorkPackageBundle(bundleHash)) {
      return this.getWorkPackageBundle(bundleHash) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = bundleHash.toString()
      const bundleData = await this.dbIntegration.getServiceStorage(
        `bundle_${hashString}`,
      )

      if (bundleData) {
        // Get metadata
        const metadataData = await this.dbIntegration.getServiceStorage(
          `bundle_meta_${hashString}`,
        )

        let coreIndex = 0
        let timestamp = Date.now()

        if (metadataData) {
          try {
            const metadata = JSON.parse(metadataData.toString())
            coreIndex = metadata.coreIndex
            timestamp = metadata.timestamp
          } catch (error) {
            console.error('Failed to parse bundle metadata:', error)
          }
        }

        // Cache in local store
        this.workPackageBundles.set(hashString, {
          bundle: bundleData,
          coreIndex,
          timestamp,
        })
        return { bundle: bundleData, coreIndex, timestamp }
      }

      return null
    } catch (error) {
      console.error('Failed to get work package bundle from database:', error)
      return null
    }
  }

  /**
   * Get segments root mapping from database if not in local store
   */
  async getSegmentsRootMappingFromDatabase(
    workPackageHash: Bytes,
  ): Promise<Bytes | null> {
    if (this.getSegmentsRootMapping(workPackageHash)) {
      return this.getSegmentsRootMapping(workPackageHash) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = workPackageHash.toString()
      const segmentsRoot = await this.dbIntegration.getServiceStorage(
        `segments_root_${hashString}`,
      )

      if (segmentsRoot) {
        // Cache in local store
        this.segmentsRootMappings.set(hashString, segmentsRoot)
        return segmentsRoot
      }

      return null
    } catch (error) {
      console.error('Failed to get segments root mapping from database:', error)
      return null
    }
  }

  /**
   * Process work package sharing
   */
  async processWorkPackageSharing(
    sharing: WorkPackageSharing,
  ): Promise<WorkPackageSharingResponse | null> {
    try {
      // Store segments root mappings
      for (const mapping of sharing.segmentsRootMappings) {
        await this.storeSegmentsRootMapping(
          mapping.workPackageHash,
          mapping.segmentsRoot,
        )
      }

      // Store work package bundle
      const bundleHash = Buffer.from('placeholder_hash') // In practice, this would be calculated
      await this.storeWorkPackageBundle(
        bundleHash,
        sharing.workPackageBundle,
        sharing.coreIndex,
      )

      console.log(
        `Processed work package sharing for core ${sharing.coreIndex}`,
      )

      // Create response (placeholder)
      return {
        workReportHash: Buffer.from('placeholder_work_report_hash'),
        signature: Buffer.from('placeholder_signature'),
      }
    } catch (error) {
      console.error('Failed to process work package sharing:', error)
      return null
    }
  }

  /**
   * Create work package sharing message
   */
  createWorkPackageSharing(
    coreIndex: number,
    segmentsRootMappings: Array<{
      workPackageHash: Bytes
      segmentsRoot: Bytes
    }>,
    workPackageBundle: Bytes,
  ): WorkPackageSharing {
    return {
      coreIndex,
      segmentsRootMappings,
      workPackageBundle,
    }
  }

  /**
   * Serialize work package sharing message
   */
  serializeWorkPackageSharing(sharing: WorkPackageSharing): Bytes {
    // Calculate total size
    let totalSize = 4 + 4 // coreIndex + number of mappings

    // Size for segments root mappings
    for (const _mapping of sharing.segmentsRootMappings) {
      totalSize += 32 + 32 // workPackageHash + segmentsRoot
    }

    // Size for work package bundle
    totalSize += 4 + sharing.workPackageBundle.length // bundle length + bundle data

    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)
    let offset = 0

    // Write core index (4 bytes, little-endian)
    view.setUint32(offset, sharing.coreIndex, true)
    offset += 4

    // Write number of segments root mappings (4 bytes, little-endian)
    view.setUint32(offset, sharing.segmentsRootMappings.length, true)
    offset += 4

    // Write segments root mappings
    for (const mapping of sharing.segmentsRootMappings) {
      // Write work package hash (32 bytes)
      new Uint8Array(buffer).set(mapping.workPackageHash, offset)
      offset += 32

      // Write segments root (32 bytes)
      new Uint8Array(buffer).set(mapping.segmentsRoot, offset)
      offset += 32
    }

    // Write work package bundle length (4 bytes, little-endian)
    view.setUint32(offset, sharing.workPackageBundle.length, true)
    offset += 4

    // Write work package bundle data
    new Uint8Array(buffer).set(sharing.workPackageBundle, offset)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize work package sharing message
   */
  deserializeWorkPackageSharing(data: Bytes): WorkPackageSharing {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read core index (4 bytes, little-endian)
    const coreIndex = view.getUint32(offset, true)
    offset += 4

    // Read number of segments root mappings (4 bytes, little-endian)
    const numMappings = view.getUint32(offset, true)
    offset += 4

    // Read segments root mappings
    const segmentsRootMappings: Array<{
      workPackageHash: Bytes
      segmentsRoot: Bytes
    }> = []
    for (let i = 0; i < numMappings; i++) {
      // Read work package hash (32 bytes)
      const workPackageHash = data.slice(offset, offset + 32)
      offset += 32

      // Read segments root (32 bytes)
      const segmentsRoot = data.slice(offset, offset + 32)
      offset += 32

      segmentsRootMappings.push({ workPackageHash, segmentsRoot })
    }

    // Read work package bundle length (4 bytes, little-endian)
    const bundleLength = view.getUint32(offset, true)
    offset += 4

    // Read work package bundle data
    const workPackageBundle = data.slice(offset, offset + bundleLength)

    return {
      coreIndex,
      segmentsRootMappings,
      workPackageBundle,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(
    _stream: StreamInfo,
    data: Bytes,
  ): Promise<WorkPackageSharingResponse | null> {
    try {
      const sharing = this.deserializeWorkPackageSharing(data)
      return await this.processWorkPackageSharing(sharing)
    } catch (error) {
      console.error('Failed to handle work package sharing stream data:', error)
      return null
    }
  }
}
