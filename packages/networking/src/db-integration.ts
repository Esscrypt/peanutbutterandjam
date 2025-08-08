import type { 
  Bytes, 
  ValidatorMetadata
} from '@pbnj/types'
import { DatabaseManager, ServiceAccountStore, ValidatorStore } from '@pbnj/state'

/**
 * Database integration layer for networking protocols
 * Provides persistent storage for protocol state across restarts
 */
export class NetworkingDatabaseIntegration {
  private dbManager: DatabaseManager
  private serviceAccountStore: ServiceAccountStore
  private validatorStore: ValidatorStore

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager
    this.serviceAccountStore = new ServiceAccountStore(dbManager.getDatabase())
    this.validatorStore = new ValidatorStore(dbManager.getDatabase())
  }

  // ============================================================================
  // Validator Management
  // ============================================================================

  /**
   * Store validator information from networking discovery
   */
  async storeValidator(validator: ValidatorMetadata, epoch: number): Promise<void> {
    await this.validatorStore.upsertValidator({
      index: validator.index,
      publicKey: validator.publicKey,
      metadata: validator,
      epoch,
      isActive: true
    })
  }

  /**
   * Get all active validators
   */
  async getActiveValidators(): Promise<ValidatorMetadata[]> {
    const validators = await this.validatorStore.getActiveValidators()
    return validators.map(v => ({
      index: v.index,
      publicKey: Buffer.from(v.publicKey, 'hex'),
      endpoint: {
        host: v.metadataHost,
        port: v.metadataPort,
        publicKey: Buffer.from(v.publicKey, 'hex') // Using same public key for endpoint
      }
    }))
  }

  /**
   * Get validators for a specific epoch
   */
  async getValidatorsForEpoch(epoch: number): Promise<ValidatorMetadata[]> {
    const validators = await this.validatorStore.getValidatorsForEpoch(epoch)
    return validators.map(v => ({
      index: v.index,
      publicKey: Buffer.from(v.publicKey, 'hex'),
      endpoint: {
        host: v.metadataHost,
        port: v.metadataPort,
        publicKey: Buffer.from(v.publicKey, 'hex')
      }
    }))
  }

  // ============================================================================
  // Block Announcement Protocol State
  // ============================================================================

  /**
   * Store finalized block information
   */
  async storeFinalizedBlock(hash: Bytes, slot: number): Promise<void> {
    // Store as a special service account entry (service ID 0 for system state)
    await this.serviceAccountStore.upsertServiceAccount({
      serviceId: 0,
      codeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      balance: 0n,
      gratis: 0n,
      minAccGas: 0n,
      minMemoGas: 0n,
      created: slot,
      lastAcc: slot
    })

    // Store finalized block hash in storage
    await this.serviceAccountStore.setStorageItem(
      0,
      Buffer.from('finalized_block_hash'),
      hash
    )

    // Store finalized block slot in storage
    await this.serviceAccountStore.setStorageItem(
      0,
      Buffer.from('finalized_block_slot'),
      Buffer.from(slot.toString())
    )
  }

  /**
   * Get finalized block information
   */
  async getFinalizedBlock(): Promise<{ hash: Bytes; slot: number } | null> {
    const hashData = await this.serviceAccountStore.getStorageItem(
      0,
      Buffer.from('finalized_block_hash')
    )
    const slotData = await this.serviceAccountStore.getStorageItem(
      0,
      Buffer.from('finalized_block_slot')
    )

    if (!hashData || !slotData) {
      return null
    }

    const slot = parseInt(slotData.toString())
    return { hash: hashData, slot }
  }

  /**
   * Store known leaf information
   */
  async storeKnownLeaf(hash: Bytes, slot: number): Promise<void> {
    const leafKey = Buffer.from(`known_leaf_${hash.toString()}`)
    const leafData = Buffer.from(JSON.stringify({ hash: hash.toString(), slot }))
    
    await this.serviceAccountStore.setStorageItem(0, leafKey, leafData)
  }

  /**
   * Get all known leaves
   */
  async getKnownLeaves(): Promise<Array<{ hash: Bytes; slot: number }>> {
    const storage = await this.serviceAccountStore.getServiceStorage(0)
    const leaves: Array<{ hash: Bytes; slot: number }> = []

    for (const item of storage) {
      if (item.storageKey.startsWith('known_leaf_')) {
        try {
          const leafData = JSON.parse(item.storageValue)
          leaves.push({
            hash: Buffer.from(leafData.hash, 'hex'),
            slot: leafData.slot
          })
        } catch (error) {
          console.error('Failed to parse known leaf data:', error)
        }
      }
    }

    return leaves
  }

  /**
   * Remove known leaf
   */
  async removeKnownLeaf(hash: Bytes): Promise<void> {
    // Note: This would require a delete method in ServiceAccountStore
    // For now, we'll mark it as removed by setting a special value
    const leafKey = Buffer.from(`known_leaf_${hash.toString()}`)
    await this.serviceAccountStore.setStorageItem(0, leafKey, Buffer.from('removed'))
  }

  // ============================================================================
  // Work Package Submission Protocol State
  // ============================================================================

  /**
   * Store work package submission
   */
  async storeWorkPackage(
    workPackageHash: Bytes,
    workPackage: Bytes,
    extrinsic: Bytes,
    coreIndex: number
  ): Promise<void> {
    // Store work package data
    await this.serviceAccountStore.setStorageItem(
      1, // Service ID 1 for work packages
      Buffer.from(`work_package_${workPackageHash.toString()}`),
      workPackage
    )

    // Store extrinsic data
    await this.serviceAccountStore.setStorageItem(
      1,
      Buffer.from(`extrinsic_${workPackageHash.toString()}`),
      extrinsic
    )

    // Store submission metadata
    const metadata = {
      coreIndex,
      timestamp: Date.now(),
      status: 'pending'
    }
    await this.serviceAccountStore.setStorageItem(
      1,
      Buffer.from(`metadata_${workPackageHash.toString()}`),
      Buffer.from(JSON.stringify(metadata))
    )
  }

  /**
   * Get work package by hash
   */
  async getWorkPackage(workPackageHash: Bytes): Promise<{
    workPackage: Bytes;
    extrinsic: Bytes;
    coreIndex: number;
    timestamp: number;
  } | null> {
    const workPackage = await this.serviceAccountStore.getStorageItem(
      1,
      Buffer.from(`work_package_${workPackageHash.toString()}`)
    )
    const extrinsic = await this.serviceAccountStore.getStorageItem(
      1,
      Buffer.from(`extrinsic_${workPackageHash.toString()}`),
    )
    const metadataData = await this.serviceAccountStore.getStorageItem(
      1,
      Buffer.from(`metadata_${workPackageHash.toString()}`),
    )

    if (!workPackage || !extrinsic || !metadataData) {
      return null
    }

    try {
      const metadata = JSON.parse(metadataData.toString())
      return {
        workPackage,
        extrinsic,
        coreIndex: metadata.coreIndex,
        timestamp: metadata.timestamp
      }
    } catch (error) {
      console.error('Failed to parse work package metadata:', error)
      return null
    }
  }

  /**
   * Get all pending work package submissions
   */
  async getPendingWorkPackages(): Promise<Array<{
    workPackageHash: Bytes;
    coreIndex: number;
    timestamp: number;
  }>> {
    const storage = await this.serviceAccountStore.getServiceStorage(1)
    const pending: Array<{
      workPackageHash: Bytes;
      coreIndex: number;
      timestamp: number;
    }> = []

    for (const item of storage) {
      if (item.storageKey.startsWith('metadata_')) {
        try {
          const metadata = JSON.parse(item.storageValue)
          if (metadata.status === 'pending') {
            const hashHex = item.storageKey.replace('metadata_', '')
            pending.push({
              workPackageHash: Buffer.from(hashHex, 'hex'),
              coreIndex: metadata.coreIndex,
              timestamp: metadata.timestamp
            })
          }
        } catch (error) {
          console.error('Failed to parse work package metadata:', error)
        }
      }
    }

    return pending
  }

  /**
   * Mark work package as processed
   */
  async markWorkPackageProcessed(workPackageHash: Bytes): Promise<void> {
    const metadataData = await this.serviceAccountStore.getStorageItem(
      1,
      Buffer.from(`metadata_${workPackageHash.toString()}`),
    )

    if (metadataData) {
      try {
        const metadata = JSON.parse(metadataData.toString())
        metadata.status = 'processed'
        metadata.processedAt = Date.now()

        await this.serviceAccountStore.setStorageItem(
          1,
          Buffer.from(`metadata_${workPackageHash.toString()}`),
          Buffer.from(JSON.stringify(metadata))
        )
      } catch (error) {
        console.error('Failed to update work package metadata:', error)
      }
    }
  }

  // ============================================================================
  // Preimage Management
  // ============================================================================

  /**
   * Store preimage for service
   */
  async storePreimage(serviceId: number, hash: string, preimage: Bytes): Promise<void> {
    await this.serviceAccountStore.setPreimage(serviceId, hash, preimage)
  }

  /**
   * Get preimage by hash
   */
  async getPreimage(serviceId: number, hash: string): Promise<Bytes | null> {
    return await this.serviceAccountStore.getPreimage(serviceId, hash)
  }

  /**
   * Request preimage
   */
  async requestPreimage(serviceId: number, hash: string, length: number): Promise<void> {
    await this.serviceAccountStore.requestPreimage(serviceId, hash, length)
  }

  /**
   * Mark preimage as available
   */
  async markPreimageAvailable(serviceId: number, hash: string, length: number, timeSlot: number): Promise<void> {
    await this.serviceAccountStore.markPreimageAvailable(serviceId, hash, length, timeSlot)
  }

  // ============================================================================
  // Service Account Management
  // ============================================================================

  /**
   * Create or update service account
   */
  async upsertServiceAccount(account: {
    serviceId: number
    codeHash: string
    balance: bigint
    gratis: bigint
    minAccGas: bigint
    minMemoGas: bigint
    created: number
    lastAcc: number
    parent?: number
  }): Promise<void> {
    await this.serviceAccountStore.upsertServiceAccount(account)
  }

  /**
   * Get service account
   */
  async getServiceAccount(serviceId: number) {
    return await this.serviceAccountStore.getServiceAccount(serviceId)
  }

  /**
   * Update service account balance
   */
  async updateServiceBalance(serviceId: number, balance: bigint): Promise<void> {
    await this.serviceAccountStore.updateBalance(serviceId, balance)
  }

  /**
   * Store key-value pair in service storage
   */
  async setServiceStorage(serviceId: number, key: Bytes, value: Bytes): Promise<void> {
    await this.serviceAccountStore.setStorageItem(serviceId, key, value)
  }

  /**
   * Get value from service storage
   */
  async getServiceStorage(serviceId: number, key: Bytes): Promise<Bytes | null> {
    return await this.serviceAccountStore.getStorageItem(serviceId, key)
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get database manager
   */
  getDatabaseManager(): DatabaseManager {
    return this.dbManager
  }

  /**
   * Get service account store
   */
  getServiceAccountStore(): ServiceAccountStore {
    return this.serviceAccountStore
  }

  /**
   * Get validator store
   */
  getValidatorStore(): ValidatorStore {
    return this.validatorStore
  }
} 