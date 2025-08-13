/**
 * Database Integration Interface for Networking
 *
 * Provides abstract interface for database operations in networking protocols
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { type DatabaseManager, ServiceAccountStore } from '@pbnj/state'
import type { Bytes } from '@pbnj/types'

/**
 * Database integration interface for networking protocols
 * Provides abstraction layer for database operations
 */
export interface NetworkingDatabaseIntegration {
  /**
   * Store a block by hash
   */
  storeBlock(hash: string, block: Bytes): Promise<void>

  /**
   * Retrieve a block by hash
   */
  getBlock(hash: string): Promise<Bytes | null>

  /**
   * Store work package data
   */
  storeWorkPackage(hash: string, workPackage: Bytes): Promise<void>

  /**
   * Retrieve work package by hash
   */
  getWorkPackage(hash: string): Promise<Bytes | null>

  /**
   * Store work report data
   */
  storeWorkReport(hash: string, workReport: Bytes): Promise<void>

  /**
   * Retrieve work report by hash
   */
  getWorkReport(hash: string): Promise<Bytes | null>

  /**
   * Store preimage data
   */
  storePreimage(hash: string, preimage: Bytes): Promise<void>

  /**
   * Retrieve preimage by hash
   */
  getPreimage(hash: string): Promise<Bytes | null>

  /**
   * Store state trie node
   */
  storeStateNode(key: string, value: Bytes): Promise<void>

  /**
   * Retrieve state trie node
   */
  getStateNode(key: string): Promise<Bytes | null>

  /**
   * Store audit data
   */
  storeAuditData(hash: string, auditData: Bytes): Promise<void>

  /**
   * Retrieve audit data
   */
  getAuditData(hash: string): Promise<Bytes | null>

  /**
   * Store justification data
   */
  storeJustification(hash: string, justification: Bytes): Promise<void>

  /**
   * Retrieve justification data
   */
  getJustification(hash: string): Promise<Bytes | null>

  /**
   * Store ticket data
   */
  storeTicket(hash: string, ticket: Bytes): Promise<void>

  /**
   * Retrieve ticket data
   */
  getTicket(hash: string): Promise<Bytes | null>

  /**
   * Store assurance data
   */
  storeAssurance(hash: string, assurance: Bytes): Promise<void>

  /**
   * Retrieve assurance data
   */
  getAssurance(hash: string): Promise<Bytes | null>

  /**
   * Store judgment data
   */
  storeJudgment(hash: string, judgment: Bytes): Promise<void>

  /**
   * Retrieve judgment data
   */
  getJudgment(hash: string): Promise<Bytes | null>

  /**
   * Generic service storage methods
   */
  setServiceStorage(key: string, value: Bytes): Promise<void>
  getServiceStorage(key: string): Promise<Bytes | null>

  /**
   * Service account store methods
   */
  getServiceAccountStore(): Promise<Map<string, Bytes>>

  /**
   * Finalized block methods
   */
  getFinalizedBlock(): Promise<{ hash: Bytes; slot: number } | null>
  storeFinalizedBlock(hash: Bytes, slot: number): Promise<void>

  /**
   * Known leaves methods
   */
  getKnownLeaves(): Promise<Map<string, { hash: Bytes; slot: number }>>
  storeKnownLeaf(hash: Bytes, slot: number): Promise<void>
  removeKnownLeaf(hash: Bytes): Promise<void>

  /**
   * Work package methods
   */
  getPendingWorkPackages(): Promise<Bytes[]>
  markWorkPackageProcessed(hash: Bytes): Promise<void>
}

/**
 * Mock database integration for testing
 */
export class MockNetworkingDatabaseIntegration
  implements NetworkingDatabaseIntegration
{
  private storage = new Map<string, Bytes>()

  async storeBlock(hash: string, block: Bytes): Promise<void> {
    this.storage.set(`block:${hash}`, block)
  }

  async getBlock(hash: string): Promise<Bytes | null> {
    return this.storage.get(`block:${hash}`) || null
  }

  async storeWorkPackage(hash: string, workPackage: Bytes): Promise<void> {
    this.storage.set(`workpackage:${hash}`, workPackage)
  }

  async getWorkPackage(hash: string): Promise<Bytes | null> {
    return this.storage.get(`workpackage:${hash}`) || null
  }

  async storeWorkReport(hash: string, workReport: Bytes): Promise<void> {
    this.storage.set(`workreport:${hash}`, workReport)
  }

  async getWorkReport(hash: string): Promise<Bytes | null> {
    return this.storage.get(`workreport:${hash}`) || null
  }

  async storePreimage(hash: string, preimage: Bytes): Promise<void> {
    this.storage.set(`preimage:${hash}`, preimage)
  }

  async getPreimage(hash: string): Promise<Bytes | null> {
    return this.storage.get(`preimage:${hash}`) || null
  }

  async storeStateNode(key: string, value: Bytes): Promise<void> {
    this.storage.set(`state:${key}`, value)
  }

  async getStateNode(key: string): Promise<Bytes | null> {
    return this.storage.get(`state:${key}`) || null
  }

  async storeAuditData(hash: string, auditData: Bytes): Promise<void> {
    this.storage.set(`audit:${hash}`, auditData)
  }

  async getAuditData(hash: string): Promise<Bytes | null> {
    return this.storage.get(`audit:${hash}`) || null
  }

  async storeJustification(hash: string, justification: Bytes): Promise<void> {
    this.storage.set(`justification:${hash}`, justification)
  }

  async getJustification(hash: string): Promise<Bytes | null> {
    return this.storage.get(`justification:${hash}`) || null
  }

  async storeTicket(hash: string, ticket: Bytes): Promise<void> {
    this.storage.set(`ticket:${hash}`, ticket)
  }

  async getTicket(hash: string): Promise<Bytes | null> {
    return this.storage.get(`ticket:${hash}`) || null
  }

  async storeAssurance(hash: string, assurance: Bytes): Promise<void> {
    this.storage.set(`assurance:${hash}`, assurance)
  }

  async getAssurance(hash: string): Promise<Bytes | null> {
    return this.storage.get(`assurance:${hash}`) || null
  }

  async storeJudgment(hash: string, judgment: Bytes): Promise<void> {
    this.storage.set(`judgment:${hash}`, judgment)
  }

  async getJudgment(hash: string): Promise<Bytes | null> {
    return this.storage.get(`judgment:${hash}`) || null
  }

  async setServiceStorage(key: string, value: Bytes): Promise<void> {
    this.storage.set(`service:${key}`, value)
  }

  async getServiceStorage(key: string): Promise<Bytes | null> {
    return this.storage.get(`service:${key}`) || null
  }

  async getServiceAccountStore(): Promise<Map<string, Bytes>> {
    const accountMap = new Map<string, Bytes>()
    for (const [key, value] of this.storage.entries()) {
      if (key.startsWith('account:')) {
        accountMap.set(key.substring(8), value)
      }
    }
    return accountMap
  }

  async getFinalizedBlock(): Promise<{ hash: Bytes; slot: number } | null> {
    const data = this.storage.get('finalized_block')
    if (!data) return null

    // Simple mock implementation
    return {
      hash: data.slice(0, 32),
      slot: new DataView(data.buffer).getUint32(32, true),
    }
  }

  async storeFinalizedBlock(hash: Bytes, slot: number): Promise<void> {
    const buffer = new ArrayBuffer(36)
    const view = new DataView(buffer)
    new Uint8Array(buffer).set(hash, 0)
    view.setUint32(32, slot, true)
    this.storage.set('finalized_block', new Uint8Array(buffer))
  }

  async getKnownLeaves(): Promise<Map<string, { hash: Bytes; slot: number }>> {
    const leavesMap = new Map<string, { hash: Bytes; slot: number }>()
    for (const [key, value] of this.storage.entries()) {
      if (key.startsWith('leaf:')) {
        const hash = value.slice(0, 32)
        const slot = new DataView(value.buffer).getUint32(32, true)
        leavesMap.set(key.substring(5), { hash, slot })
      }
    }
    return leavesMap
  }

  async storeKnownLeaf(hash: Bytes, slot: number): Promise<void> {
    const buffer = new ArrayBuffer(36)
    const view = new DataView(buffer)
    new Uint8Array(buffer).set(hash, 0)
    view.setUint32(32, slot, true)
    const hashStr = Buffer.from(hash).toString('hex')
    this.storage.set(`leaf:${hashStr}`, new Uint8Array(buffer))
  }

  async removeKnownLeaf(hash: Bytes): Promise<void> {
    const hashStr = Buffer.from(hash).toString('hex')
    this.storage.delete(`leaf:${hashStr}`)
  }

  async getPendingWorkPackages(): Promise<Bytes[]> {
    const packages: Bytes[] = []
    for (const [key, value] of this.storage.entries()) {
      if (key.startsWith('pending_workpackage:')) {
        packages.push(value)
      }
    }
    return packages
  }

  async markWorkPackageProcessed(hash: Bytes): Promise<void> {
    const hashStr = Buffer.from(hash).toString('hex')
    this.storage.delete(`pending_workpackage:${hashStr}`)
    this.storage.set(`processed_workpackage:${hashStr}`, hash)
  }
}

/**
 * Real database integration using @pbnj/state package
 * This implementation uses the JAM state database with proper service accounts
 */
export class StateBasedNetworkingDatabaseIntegration
  implements NetworkingDatabaseIntegration
{
  private serviceAccountStore: ServiceAccountStore
  private readonly NETWORKING_SERVICE_ID = 1000 // Reserved service ID for networking

  constructor(databaseManager: DatabaseManager) {
    this.serviceAccountStore = new ServiceAccountStore(
      databaseManager.getDatabase(),
    )
  }

  // Helper method to create storage keys
  private createKey(prefix: string, identifier: string): Bytes {
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
          codeHash: '0x' + '00'.repeat(32), // Empty code hash for networking service
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
  async storeBlock(hash: string, block: Bytes): Promise<void> {
    const key = this.createKey('block', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      block,
    )
  }

  async getBlock(hash: string): Promise<Bytes | null> {
    const key = this.createKey('block', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Work package methods
  async storeWorkPackage(hash: string, workPackage: Bytes): Promise<void> {
    const key = this.createKey('workpackage', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      workPackage,
    )
  }

  async getWorkPackage(hash: string): Promise<Bytes | null> {
    const key = this.createKey('workpackage', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Work report methods
  async storeWorkReport(hash: string, workReport: Bytes): Promise<void> {
    const key = this.createKey('workreport', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      workReport,
    )
  }

  async getWorkReport(hash: string): Promise<Bytes | null> {
    const key = this.createKey('workreport', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Preimage methods
  async storePreimage(hash: string, preimage: Bytes): Promise<void> {
    await this.serviceAccountStore.setPreimage(
      this.NETWORKING_SERVICE_ID,
      hash,
      preimage,
    )
  }

  async getPreimage(hash: string): Promise<Bytes | null> {
    return await this.serviceAccountStore.getPreimage(
      this.NETWORKING_SERVICE_ID,
      hash,
    )
  }

  // State trie methods
  async storeStateNode(key: string, value: Bytes): Promise<void> {
    const keyBytes = this.createKey('state', key)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      keyBytes,
      value,
    )
  }

  async getStateNode(key: string): Promise<Bytes | null> {
    const keyBytes = this.createKey('state', key)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      keyBytes,
    )
  }

  // Audit data methods
  async storeAuditData(hash: string, auditData: Bytes): Promise<void> {
    const key = this.createKey('audit', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      auditData,
    )
  }

  async getAuditData(hash: string): Promise<Bytes | null> {
    const key = this.createKey('audit', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Justification methods
  async storeJustification(hash: string, justification: Bytes): Promise<void> {
    const key = this.createKey('justification', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      justification,
    )
  }

  async getJustification(hash: string): Promise<Bytes | null> {
    const key = this.createKey('justification', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Ticket methods
  async storeTicket(hash: string, ticket: Bytes): Promise<void> {
    const key = this.createKey('ticket', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      ticket,
    )
  }

  async getTicket(hash: string): Promise<Bytes | null> {
    const key = this.createKey('ticket', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Assurance methods
  async storeAssurance(hash: string, assurance: Bytes): Promise<void> {
    const key = this.createKey('assurance', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      assurance,
    )
  }

  async getAssurance(hash: string): Promise<Bytes | null> {
    const key = this.createKey('assurance', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Judgment methods
  async storeJudgment(hash: string, judgment: Bytes): Promise<void> {
    const key = this.createKey('judgment', hash)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
      judgment,
    )
  }

  async getJudgment(hash: string): Promise<Bytes | null> {
    const key = this.createKey('judgment', hash)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      key,
    )
  }

  // Generic service storage methods
  async setServiceStorage(key: string, value: Bytes): Promise<void> {
    const keyBytes = new TextEncoder().encode(key)
    await this.serviceAccountStore.setStorageItem(
      this.NETWORKING_SERVICE_ID,
      keyBytes,
      value,
    )
  }

  async getServiceStorage(key: string): Promise<Bytes | null> {
    const keyBytes = new TextEncoder().encode(key)
    return await this.serviceAccountStore.getStorageItem(
      this.NETWORKING_SERVICE_ID,
      keyBytes,
    )
  }

  // Service account store methods
  async getServiceAccountStore(): Promise<Map<string, Bytes>> {
    const storage = await this.serviceAccountStore.getServiceStorage(
      this.NETWORKING_SERVICE_ID,
    )
    const map = new Map<string, Bytes>()

    for (const item of storage) {
      const hexValue = item.storageValue.startsWith('0x')
        ? item.storageValue
        : `0x${item.storageValue}`
      map.set(item.storageKey, hexToBytes(hexValue as `0x${string}`))
    }

    return map
  }

  // Finalized block methods (using special keys)
  async getFinalizedBlock(): Promise<{ hash: Bytes; slot: number } | null> {
    const data = await this.getServiceStorage('finalized_block')
    if (!data || data.length < 36) return null

    return {
      hash: data.slice(0, 32),
      slot: new DataView(data.buffer).getUint32(32, true),
    }
  }

  async storeFinalizedBlock(hash: Bytes, slot: number): Promise<void> {
    const buffer = new ArrayBuffer(36)
    const view = new DataView(buffer)
    new Uint8Array(buffer).set(hash, 0)
    view.setUint32(32, slot, true)
    await this.setServiceStorage('finalized_block', new Uint8Array(buffer))
  }

  // Known leaves methods
  async getKnownLeaves(): Promise<Map<string, { hash: Bytes; slot: number }>> {
    const storage = await this.getServiceAccountStore()
    const leavesMap = new Map<string, { hash: Bytes; slot: number }>()

    for (const [key, value] of storage) {
      if (key.startsWith('leaf_') && value.length >= 36) {
        const hash = value.slice(0, 32)
        const slot = new DataView(value.buffer).getUint32(32, true)
        leavesMap.set(key.substring(5), { hash, slot })
      }
    }

    return leavesMap
  }

  async storeKnownLeaf(hash: Bytes, slot: number): Promise<void> {
    const buffer = new ArrayBuffer(36)
    const view = new DataView(buffer)
    new Uint8Array(buffer).set(hash, 0)
    view.setUint32(32, slot, true)
    const hashStr = bytesToHex(hash)
    await this.setServiceStorage(`leaf_${hashStr}`, new Uint8Array(buffer))
  }

  async removeKnownLeaf(hash: Bytes): Promise<void> {
    const hashStr = bytesToHex(hash)
    // Mark as removed (we don't have a delete operation)
    await this.setServiceStorage(`leaf_${hashStr}`, new Uint8Array([0]))
  }

  // Work package methods
  async getPendingWorkPackages(): Promise<Bytes[]> {
    const storage = await this.getServiceAccountStore()
    const packages: Bytes[] = []

    for (const [key, value] of storage) {
      if (key.startsWith('pending_workpackage_')) {
        packages.push(value)
      }
    }

    return packages
  }

  async markWorkPackageProcessed(hash: Bytes): Promise<void> {
    const hashStr = bytesToHex(hash)
    // Remove from pending and add to processed
    await this.setServiceStorage(`processed_workpackage_${hashStr}`, hash)
  }
}
