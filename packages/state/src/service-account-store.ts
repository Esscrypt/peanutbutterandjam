import { eq, and, desc, sql } from 'drizzle-orm'
import type { Bytes } from '@pbnj/types'
import {
  serviceAccounts,
  serviceStorage,
  servicePreimages,
  servicePreimageRequests,
  servicePrivileges,
  stateTrieNodes,
  stateTrieRoot,
  type ServiceAccount,
  type NewServiceAccount,
  type ServiceStorage,
  type NewServiceStorage,
  type ServicePreimage,
  type NewServicePreimage,
  type ServicePreimageRequest,
  type NewServicePreimageRequest,
  type ServicePrivilege,
  type NewServicePrivilege,
  type StateTrieNode,
  type NewStateTrieNode,
  type StateTrieRoot,
  type NewStateTrieRoot
} from './schema'

/**
 * Service account store for managing JAM state trie components
 * Based on Gray Paper accounts.tex and merklization.tex
 */
export class ServiceAccountStore {
  private db: ReturnType<typeof import('./database').DatabaseManager.prototype.getDatabase>

  constructor(db: ReturnType<typeof import('./database').DatabaseManager.prototype.getDatabase>) {
    this.db = db
  }

  // ============================================================================
  // Service Account Management
  // ============================================================================

  /**
   * Create or update a service account
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
    const accountData: NewServiceAccount = {
      serviceId: account.serviceId,
      storage: {},
      preimages: {},
      requests: {},
      codeHash: account.codeHash,
      balance: account.balance,
      gratis: account.gratis,
      minAccGas: account.minAccGas,
      minMemoGas: account.minMemoGas,
      created: account.created,
      lastAcc: account.lastAcc,
      parent: account.parent,
      items: 0,
      octets: 0n,
      minBalance: 0n
    }

    await this.db
      .insert(serviceAccounts)
      .values(accountData)
      .onConflictDoUpdate({
        target: serviceAccounts.serviceId,
        set: {
          codeHash: accountData.codeHash,
          balance: accountData.balance,
          gratis: accountData.gratis,
          minAccGas: accountData.minAccGas,
          minMemoGas: accountData.minMemoGas,
          lastAcc: accountData.lastAcc,
          parent: accountData.parent,
          updatedAt: new Date()
        }
      })
  }

  /**
   * Get service account by ID
   */
  async getServiceAccount(serviceId: number): Promise<ServiceAccount | null> {
    const result = await this.db
      .select()
      .from(serviceAccounts)
      .where(eq(serviceAccounts.serviceId, serviceId))
      .limit(1)

    return result[0] || null
  }

  /**
   * Get all service accounts
   */
  async getAllServiceAccounts(): Promise<ServiceAccount[]> {
    return await this.db
      .select()
      .from(serviceAccounts)
      .orderBy(serviceAccounts.serviceId)
  }

  /**
   * Update service account balance
   */
  async updateBalance(serviceId: number, balance: bigint): Promise<void> {
    await this.db
      .update(serviceAccounts)
      .set({ balance, updatedAt: new Date() })
      .where(eq(serviceAccounts.serviceId, serviceId))
  }

  /**
   * Update service account last accumulation time
   */
  async updateLastAccumulation(serviceId: number, timeSlot: number): Promise<void> {
    await this.db
      .update(serviceAccounts)
      .set({ lastAcc: timeSlot, updatedAt: new Date() })
      .where(eq(serviceAccounts.serviceId, serviceId))
  }

  // ============================================================================
  // Storage Management
  // ============================================================================

  /**
   * Store a key-value pair in service storage
   */
  async setStorageItem(serviceId: number, key: Bytes, value: Bytes): Promise<void> {
    const keyHex = Buffer.from(key).toString('hex')
    const valueHex = Buffer.from(value).toString('hex')
    const keyHash = Buffer.from(key).toString('hex') // In practice, this would be Blake2b hash
    
    const storageData: NewServiceStorage = {
      id: `${serviceId}:${keyHash}`,
      serviceId,
      storageKey: keyHex,
      storageValue: valueHex,
      keyHash
    }

    await this.db
      .insert(serviceStorage)
      .values(storageData)
      .onConflictDoUpdate({
        target: serviceStorage.id,
        set: {
          storageValue: valueHex,
          updatedAt: new Date()
        }
      })

    // Update the JSON storage in service account
    await this.updateServiceAccountStorage(serviceId, keyHex, valueHex)
  }

  /**
   * Get a storage item by key
   */
  async getStorageItem(serviceId: number, key: Bytes): Promise<Bytes | null> {
    const keyHex = Buffer.from(key).toString('hex')
    const keyHash = Buffer.from(key).toString('hex') // In practice, this would be Blake2b hash
    
    const result = await this.db
      .select()
      .from(serviceStorage)
      .where(and(
        eq(serviceStorage.serviceId, serviceId),
        eq(serviceStorage.keyHash, keyHash)
      ))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    return Buffer.from(result[0].storageValue, 'hex')
  }

  /**
   * Get all storage items for a service
   */
  async getServiceStorage(serviceId: number): Promise<ServiceStorage[]> {
    return await this.db
      .select()
      .from(serviceStorage)
      .where(eq(serviceStorage.serviceId, serviceId))
  }

  /**
   * Update the JSON storage field in service account
   */
  private async updateServiceAccountStorage(serviceId: number, key: string, value: string): Promise<void> {
    const account = await this.getServiceAccount(serviceId)
    if (!account) {
      throw new Error(`Service account ${serviceId} not found`)
    }

    const storage = account.storage as Record<string, string>
    storage[key] = value

    await this.db
      .update(serviceAccounts)
      .set({ storage, updatedAt: new Date() })
      .where(eq(serviceAccounts.serviceId, serviceId))
  }

  // ============================================================================
  // Preimage Management
  // ============================================================================

  /**
   * Store a preimage for a service
   */
  async setPreimage(serviceId: number, hash: string, preimage: Bytes): Promise<void> {
    const preimageHex = Buffer.from(preimage).toString('hex')
    
    const preimageData: NewServicePreimage = {
      id: `${serviceId}:${hash}`,
      serviceId,
      hash,
      preimage: preimageHex
    }

    await this.db
      .insert(servicePreimages)
      .values(preimageData)
      .onConflictDoUpdate({
        target: servicePreimages.id,
        set: {
          preimage: preimageHex
        }
      })

    // Update the JSON preimages in service account
    await this.updateServiceAccountPreimages(serviceId, hash, preimageHex)
  }

  /**
   * Get a preimage by hash
   */
  async getPreimage(serviceId: number, hash: string): Promise<Bytes | null> {
    const result = await this.db
      .select()
      .from(servicePreimages)
      .where(and(
        eq(servicePreimages.serviceId, serviceId),
        eq(servicePreimages.hash, hash)
      ))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    return Buffer.from(result[0].preimage, 'hex')
  }

  /**
   * Request a preimage (mark as requested)
   */
  async requestPreimage(serviceId: number, hash: string, length: number): Promise<void> {
    const requestData: NewServicePreimageRequest = {
      id: `${serviceId}:${hash}:${length}`,
      serviceId,
      hash,
      length,
      timeSlots: [],
      status: 'requested'
    }

    await this.db
      .insert(servicePreimageRequests)
      .values(requestData)
      .onConflictDoUpdate({
        target: servicePreimageRequests.id,
        set: {
          status: 'requested',
          updatedAt: new Date()
        }
      })
  }

  /**
   * Mark preimage as available
   */
  async markPreimageAvailable(serviceId: number, hash: string, length: number, timeSlot: number): Promise<void> {
    const request = await this.db
      .select()
      .from(servicePreimageRequests)
      .where(and(
        eq(servicePreimageRequests.serviceId, serviceId),
        eq(servicePreimageRequests.hash, hash),
        eq(servicePreimageRequests.length, length)
      ))
      .limit(1)

    if (request.length === 0) {
      throw new Error(`Preimage request not found: ${serviceId}:${hash}:${length}`)
    }

    const timeSlots = request[0].timeSlots as number[]
    const newTimeSlots = [...timeSlots, timeSlot].slice(-3) // Keep only last 3
    const status = newTimeSlots.length === 1 ? 'available' : 'reavailable'

    await this.db
      .update(servicePreimageRequests)
      .set({
        timeSlots: newTimeSlots,
        status,
        updatedAt: new Date()
      })
      .where(eq(servicePreimageRequests.id, request[0].id))
  }

  /**
   * Update the JSON preimages field in service account
   */
  private async updateServiceAccountPreimages(serviceId: number, hash: string, preimage: string): Promise<void> {
    const account = await this.getServiceAccount(serviceId)
    if (!account) {
      throw new Error(`Service account ${serviceId} not found`)
    }

    const preimages = account.preimages as Record<string, string>
    preimages[hash] = preimage

    await this.db
      .update(serviceAccounts)
      .set({ preimages, updatedAt: new Date() })
      .where(eq(serviceAccounts.serviceId, serviceId))
  }

  // ============================================================================
  // Privileges Management
  // ============================================================================

  /**
   * Grant a privilege to a service
   */
  async grantPrivilege(privilege: {
    privilegeType: 'manager' | 'delegator' | 'registrar' | 'assigner' | 'always_accers'
    serviceId: number
    coreIndex?: number
    gasLimit?: bigint
  }): Promise<void> {
    const privilegeData: NewServicePrivilege = {
      id: `${privilege.privilegeType}:${privilege.serviceId}`,
      privilegeType: privilege.privilegeType,
      serviceId: privilege.serviceId,
      coreIndex: privilege.coreIndex,
      gasLimit: privilege.gasLimit
    }

    await this.db
      .insert(servicePrivileges)
      .values(privilegeData)
      .onConflictDoUpdate({
        target: servicePrivileges.id,
        set: {
          coreIndex: privilege.coreIndex,
          gasLimit: privilege.gasLimit
        }
      })
  }

  /**
   * Get all privileges for a service
   */
  async getServicePrivileges(serviceId: number): Promise<ServicePrivilege[]> {
    return await this.db
      .select()
      .from(servicePrivileges)
      .where(eq(servicePrivileges.serviceId, serviceId))
  }

  /**
   * Get all services with a specific privilege
   */
  async getServicesWithPrivilege(privilegeType: 'manager' | 'delegator' | 'registrar' | 'assigner' | 'always_accers'): Promise<ServicePrivilege[]> {
    return await this.db
      .select()
      .from(servicePrivileges)
      .where(eq(servicePrivileges.privilegeType, privilegeType))
  }

  // ============================================================================
  // State Trie Management
  // ============================================================================

  /**
   * Store a state trie node
   */
  async storeTrieNode(node: {
    nodeHash: string
    nodeType: 'branch' | 'leaf' | 'embedded_leaf'
    nodeData: string
    leftChild?: string
    rightChild?: string
    stateKey?: string
    valueHash?: string
    embeddedValue?: string
  }): Promise<void> {
    const nodeData: NewStateTrieNode = {
      nodeHash: node.nodeHash,
      nodeType: node.nodeType,
      nodeData: node.nodeData,
      leftChild: node.leftChild,
      rightChild: node.rightChild,
      stateKey: node.stateKey,
      valueHash: node.valueHash,
      embeddedValue: node.embeddedValue
    }

    await this.db
      .insert(stateTrieNodes)
      .values(nodeData)
      .onConflictDoUpdate({
        target: stateTrieNodes.nodeHash,
        set: {
          nodeData: node.nodeData,
          leftChild: node.leftChild,
          rightChild: node.rightChild,
          stateKey: node.stateKey,
          valueHash: node.valueHash,
          embeddedValue: node.embeddedValue
        }
      })
  }

  /**
   * Get a state trie node by hash
   */
  async getTrieNode(nodeHash: string): Promise<StateTrieNode | null> {
    const result = await this.db
      .select()
      .from(stateTrieNodes)
      .where(eq(stateTrieNodes.nodeHash, nodeHash))
      .limit(1)

    return result[0] || null
  }

  /**
   * Update the state trie root
   */
  async updateStateTrieRoot(root: {
    rootHash: string
    blockNumber: number
    timeSlot: number
  }): Promise<void> {
    const rootData: NewStateTrieRoot = {
      id: 1,
      rootHash: root.rootHash,
      blockNumber: root.blockNumber,
      timeSlot: root.timeSlot
    }

    await this.db
      .insert(stateTrieRoot)
      .values(rootData)
      .onConflictDoUpdate({
        target: stateTrieRoot.id,
        set: {
          rootHash: root.rootHash,
          blockNumber: root.blockNumber,
          timeSlot: root.timeSlot,
          updatedAt: new Date()
        }
      })
  }

  /**
   * Get the current state trie root
   */
  async getStateTrieRoot(): Promise<StateTrieRoot | null> {
    const result = await this.db
      .select()
      .from(stateTrieRoot)
      .where(eq(stateTrieRoot.id, 1))
      .limit(1)

    return result[0] || null
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculate account footprint (items and octets) based on Gray Paper equation
   */
  async calculateAccountFootprint(serviceId: number): Promise<{
    items: number
    octets: bigint
    minBalance: bigint
  }> {
    const storage = await this.getServiceStorage(serviceId)
    const requests = await this.db
      .select()
      .from(servicePreimageRequests)
      .where(eq(servicePreimageRequests.serviceId, serviceId))

    // Calculate items: 2 * len(requests) + len(storage)
    const items = 2 * requests.length + storage.length

    // Calculate octets: sum of storage sizes + request overhead
    let octets = 0n
    for (const req of requests) {
      octets += 81n + BigInt(req.length) // 81 bytes overhead per request
    }
    for (const item of storage) {
      const keyLength = Buffer.from(item.storageKey, 'hex').length
      const valueLength = Buffer.from(item.storageValue, 'hex').length
      octets += 34n + BigInt(keyLength) + BigInt(valueLength) // 34 bytes overhead per storage item
    }

    // Calculate minimum balance (simplified - would need actual constants from Gray Paper)
    const baseDeposit = 1000n // Example constant
    const itemDeposit = 100n // Example constant
    const byteDeposit = 1n // Example constant
    
    const account = await this.getServiceAccount(serviceId)
    const gratis = account?.gratis || 0n
    
    const minBalance = baseDeposit + (itemDeposit * BigInt(items)) + (byteDeposit * octets) - gratis

    return {
      items,
      octets,
      minBalance: minBalance > 0n ? minBalance : 0n
    }
  }

  /**
   * Update account footprint in database
   */
  async updateAccountFootprint(serviceId: number): Promise<void> {
    const footprint = await this.calculateAccountFootprint(serviceId)
    
    await this.db
      .update(serviceAccounts)
      .set({
        items: footprint.items,
        octets: footprint.octets,
        minBalance: footprint.minBalance,
        updatedAt: new Date()
      })
      .where(eq(serviceAccounts.serviceId, serviceId))
  }
} 