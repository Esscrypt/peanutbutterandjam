/**
 * Database Integration Interface for Networking
 *
 * Provides abstract interface for database operations in networking protocols
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { type CoreDb, ServiceAccountStore } from '@pbnj/state'

/**
 * Database integration interface for networking protocols
 * Provides abstraction layer for database operations
 */
export interface NetworkingDatabaseIntegration {
  /**
   * Store a block by hash
   */
  storeBlock(hash: string, block: Uint8Array): Promise<void>

  /**
   * Retrieve a block by hash
   */
  getBlock(hash: string): Promise<Uint8Array | null>

  /**
   * Store work package data
   */
  storeWorkPackage(hash: string, workPackage: Uint8Array): Promise<void>

  /**
   * Retrieve work package by hash
   */
  getWorkPackage(hash: string): Promise<Uint8Array | null>

  /**
   * Store work report data
   */
  storeWorkReport(hash: string, workReport: Uint8Array): Promise<void>

  /**
   * Retrieve work report by hash
   */
  getWorkReport(hash: string): Promise<Uint8Array | null>

  /**
   * Store preimage data
   */
  storePreimage(hash: string, preimage: Uint8Array): Promise<void>

  /**
   * Retrieve preimage by hash
   */
  getPreimage(hash: string): Promise<Uint8Array | null>

  /**
   * Store state trie node
   */
  storeStateNode(key: string, value: Uint8Array): Promise<void>

  /**
   * Retrieve state trie node
   */
  getStateNode(key: string): Promise<Uint8Array | null>

  /**
   * Store audit data
   */
  storeAuditData(hash: string, auditData: Uint8Array): Promise<void>

  /**
   * Retrieve audit data
   */
  getAuditData(hash: string): Promise<Uint8Array | null>

  /**
   * Store justification data
   */
  storeJustification(hash: string, justification: Uint8Array): Promise<void>

  /**
   * Retrieve justification data
   */
  getJustification(hash: string): Promise<Uint8Array | null>

  /**
   * Store ticket data
   */
  storeTicket(hash: string, ticket: Uint8Array): Promise<void>

  /**
   * Retrieve ticket data
   */
  getTicket(hash: string): Promise<Uint8Array | null>

  /**
   * Store assurance data
   */
  storeAssurance(hash: string, assurance: Uint8Array): Promise<void>

  /**
   * Retrieve assurance data
   */
  getAssurance(hash: string): Promise<Uint8Array | null>

  /**
   * Store judgment data
   */
  storeJudgment(hash: string, judgment: Uint8Array): Promise<void>

  /**
   * Retrieve judgment data
   */
  getJudgment(hash: string): Promise<Uint8Array | null>

  /**
   * Generic service storage methods
   */
  setServiceStorage(key: string, value: Uint8Array): Promise<void>
  getServiceStorage(key: string): Promise<Uint8Array | null>

  /**
   * Service account store methods
   */
  getServiceAccountStore(): Promise<Map<string, Uint8Array>>

  /**
   * Finalized block methods
   */
  getFinalizedBlock(): Promise<{ hash: Uint8Array; slot: number } | null>
  storeFinalizedBlock(hash: Uint8Array, slot: number): Promise<void>

  /**
   * Known leaves methods
   */
  getKnownLeaves(): Promise<Map<string, { hash: Uint8Array; slot: number }>>
  storeKnownLeaf(hash: Uint8Array, slot: number): Promise<void>
  removeKnownLeaf(hash: Uint8Array): Promise<void>

  /**
   * Work package methods
   */
  getPendingWorkPackages(): Promise<Uint8Array[]>
  markWorkPackageProcessed(hash: Uint8Array): Promise<void>
}

/**
 * Real database integration using @pbnj/state package
 * This implementation uses the JAM state database with proper service accounts
 */
export class NetworkingStore implements NetworkingDatabaseIntegration {
  private serviceAccountStore: ServiceAccountStore
  private readonly NETWORKING_SERVICE_ID = 1000 // Reserved service ID for networking

  constructor(databaseManager: CoreDb) {
    this.serviceAccountStore = new ServiceAccountStore(databaseManager)
  }

  // Helper method to create storage keys
  private createKey(prefix: string, identifier: string): Uint8Array {
    return new TextEncoder().encode(`${prefix}_${identifier}`)
  }

  async initialize(): Promise<void> {
    // Initialize the networking service account if it doesn't exist
    try {
      const existingAccount = await this.serviceAccountStore.getServiceAccount(
        this.NETWORKING_SERVICE_ID,
      )
      if (!existingAccount) {
        await this.serviceAccountStore.upsertServiceAccount({
          serviceId: this.NETWORKING_SERVICE_ID,
          codeHash: `0x${'00'.repeat(32)}`, // Empty code hash for networking service
          balance: 0n,
          gratis: 0n,
          minAccGas: 0n,
          minMemoGas: 0n,
          created: Date.now(),
          lastAcc: Date.now(),
        })
      }
    } catch (error) {
      console.error('Failed to initialize networking service account:', error)
      throw error
    }
  }

  // Block storage methods
  async storeBlock(hash: string, block: Uint8Array): Promise<void> {
    const key = this.createKey('block', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      block,
    )
  }

  async getBlock(hash: string): Promise<Uint8Array | null> {
    const key = this.createKey('block', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Work package methods
  async storeWorkPackage(hash: string, workPackage: Uint8Array): Promise<void> {
    const key = this.createKey('workpackage', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      workPackage,
    )
  }

  async getWorkPackage(hash: string): Promise<Uint8Array | null> {
    const key = this.createKey('workpackage', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Work report methods
  async storeWorkReport(hash: string, workReport: Uint8Array): Promise<void> {
    const key = this.createKey('workreport', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      workReport,
    )
  }

  async getWorkReport(hash: string): Promise<Uint8Array | null> {
    const key = this.createKey('workreport', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Preimage methods
  async storePreimage(hash: string, preimage: Uint8Array): Promise<void> {
    await this.serviceAccountStore.setPreimage(
      this.NETWORKING_SERVICE_ID,
      hash,
      preimage,
    )
  }

  async getPreimage(hash: string): Promise<Uint8Array | null> {
    return await this.serviceAccountStore.getPreimage(
      this.NETWORKING_SERVICE_ID,
      hash,
    )
  }

  // State trie methods
  async storeStateNode(key: string, value: Uint8Array): Promise<void> {
    const keyBytes = this.createKey('state', key)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      keyBytes,
      value,
    )
  }

  async getStateNode(key: string): Promise<Uint8Array | null> {
    const keyBytes = this.createKey('state', key)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      keyBytes,
    )
  }

  // Audit data methods
  async storeAuditData(hash: string, auditData: Uint8Array): Promise<void> {
    const key = this.createKey('audit', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      auditData,
    )
  }

  async getAuditData(hash: string): Promise<Uint8Array | null> {
    const key = this.createKey('audit', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Justification methods
  async storeJustification(
    hash: string,
    justification: Uint8Array,
  ): Promise<void> {
    const key = this.createKey('justification', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      justification,
    )
  }

  async getJustification(hash: string): Promise<Uint8Array | null> {
    const key = this.createKey('justification', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Ticket methods
  async storeTicket(hash: string, ticket: Uint8Array): Promise<void> {
    const key = this.createKey('ticket', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      ticket,
    )
  }

  async getTicket(hash: string): Promise<Uint8Array | null> {
    const key = this.createKey('ticket', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Assurance methods
  async storeAssurance(hash: string, assurance: Uint8Array): Promise<void> {
    const key = this.createKey('assurance', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      assurance,
    )
  }

  async getAssurance(hash: string): Promise<Uint8Array | null> {
    const key = this.createKey('assurance', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Judgment methods
  async storeJudgment(hash: string, judgment: Uint8Array): Promise<void> {
    const key = this.createKey('judgment', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      judgment,
    )
  }

  async getJudgment(hash: string): Promise<Uint8Array | null> {
    const key = this.createKey('judgment', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Generic service storage methods
  async setServiceStorage(key: string, value: Uint8Array): Promise<void> {
    const keyBytes = new TextEncoder().encode(key)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      keyBytes,
      value,
    )
  }

  async getServiceStorage(key: string): Promise<Uint8Array | null> {
    const keyBytes = new TextEncoder().encode(key)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      keyBytes,
    )
  }

  // Service account store methods
  async getServiceAccountStore(): Promise<Map<string, Uint8Array>> {
    const storage = await this.serviceAccountStore.getServiceStorage(
      this.NETWORKING_SERVICE_ID,
    )
    const map = new Map<string, Uint8Array>()

    for (const item of storage) {
      const hexValue = item.storageValue.startsWith('0x')
        ? item.storageValue
        : `0x${item.storageValue}`
      map.set(item.storageKey, hexToBytes(hexValue as `0x${string}`))
    }

    return map
  }

  // Finalized block methods (using special keys)
  async getFinalizedBlock(): Promise<{
    hash: Uint8Array
    slot: number
  } | null> {
    const data = await this.getServiceStorage('finalized_block')
    if (!data || data.length < 36) return null

    return {
      hash: data.slice(0, 32),
      slot: new DataView(data.buffer).getUint32(32, true),
    }
  }

  async storeFinalizedBlock(hash: Uint8Array, slot: number): Promise<void> {
    const buffer = new ArrayBuffer(36)
    const view = new DataView(buffer)
    new Uint8Array(buffer).set(hash, 0)
    view.setUint32(32, slot, true)
    await this.setServiceStorage('finalized_block', new Uint8Array(buffer))
  }

  // Known leaves methods
  async getKnownLeaves(): Promise<
    Map<string, { hash: Uint8Array; slot: number }>
  > {
    const storage = await this.getServiceAccountStore()
    const leavesMap = new Map<string, { hash: Uint8Array; slot: number }>()

    for (const [key, value] of storage) {
      if (key.startsWith('leaf_') && value.length >= 36) {
        const hash = value.slice(0, 32)
        const slot = new DataView(value.buffer).getUint32(32, true)
        leavesMap.set(key.substring(5), { hash, slot })
      }
    }

    return leavesMap
  }

  async storeKnownLeaf(hash: Uint8Array, slot: number): Promise<void> {
    const buffer = new ArrayBuffer(36)
    const view = new DataView(buffer)
    new Uint8Array(buffer).set(hash, 0)
    view.setUint32(32, slot, true)
    const hashStr = bytesToHex(hash)
    await this.setServiceStorage(`leaf_${hashStr}`, new Uint8Array(buffer))
  }

  async removeKnownLeaf(hash: Uint8Array): Promise<void> {
    const hashStr = bytesToHex(hash)
    // Mark as removed (we don't have a delete operation)
    await this.setServiceStorage(`leaf_${hashStr}`, new Uint8Array([0]))
  }

  // Work package methods
  async getPendingWorkPackages(): Promise<Uint8Array[]> {
    const storage = await this.getServiceAccountStore()
    const packages: Uint8Array[] = []

    for (const [key, value] of storage) {
      if (key.startsWith('pending_workpackage_')) {
        packages.push(value)
      }
    }

    return packages
  }

  async markWorkPackageProcessed(hash: Uint8Array): Promise<void> {
    const hashStr = bytesToHex(hash)
    // Remove from pending and add to processed
    await this.setServiceStorage(`processed_workpackage_${hashStr}`, hash)
  }
}
