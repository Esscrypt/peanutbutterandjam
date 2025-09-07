//TODO: move this to a separate package

import {
  blake2bHash,
  bytesToHex,
  type Hex,
  hexToBytes,
  type SafePromise,
  safeError,
  safeResult,
  safeTry,
} from '@pbnj/core'
import { and, eq, sql } from 'drizzle-orm'
import type { CoreDb, DbServicePreimage, DbServicePreimageRequest } from '.'
import {
  type DbNewServiceAccount,
  type DbNewServicePreimage,
  type DbNewServicePreimageRequest,
  type DbNewServicePrivilege,
  type DbNewServiceStorage,
  type DbNewStateTrieNode,
  type DbNewStateTrieRoot,
  type DbServiceAccount,
  type DbServicePrivilege,
  type DbServiceStorage,
  type DbStateTrieNode,
  type DbStateTrieRoot,
  serviceAccounts,
  servicePreimageRequests,
  servicePreimages,
  servicePreimageTimeslots,
  servicePrivileges,
  serviceStorage,
  stateTrieNodes,
  stateTrieRoot,
} from './schema/core-schema'

/**
 * Service account store for managing JAM state trie components
 * Based on Gray Paper accounts.tex and merklization.tex
 */
export class ServiceAccountStore {
  private db: CoreDb

  constructor(db: CoreDb) {
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
    codeHash: Hex
    balance: bigint
    gratis: bigint
    minAccGas: bigint
    minMemoGas: bigint
    created: number
    lastAcc: number
    parent?: number | undefined
  }): Promise<void> {
    const accountData: DbNewServiceAccount = {
      serviceId: account.serviceId,
      codeHash: account.codeHash,
      balance: account.balance,
      gratis: account.gratis,
      minAccGas: account.minAccGas,
      minMemoGas: account.minMemoGas,
      created: account.created,
      lastAcc: account.lastAcc,
      parent: account.parent || 0,
      items: 0,
      octets: 0n,
      minBalance: 0n,
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
          updatedAt: new Date(),
        },
      })
  }

  /**
   * Get service account by ID
   */
  async getServiceAccount(
    serviceId: number,
  ): SafePromise<DbServiceAccount | null> {
    const [err, result] = await safeTry(
      this.db
        .select()
        .from(serviceAccounts)
        .where(eq(serviceAccounts.serviceId, serviceId))
        .limit(1),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result[0] || null)
  }

  /**
   * Get all service accounts
   */
  async getAllServiceAccounts(): SafePromise<DbServiceAccount[]> {
    const [err, result] = await safeTry(
      this.db.select().from(serviceAccounts).orderBy(serviceAccounts.serviceId),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result)
  }

  /**
   * Update service account balance
   */
  async updateBalance(
    serviceId: number,
    balance: bigint,
  ): SafePromise<DbServiceAccount> {
    const [err, result] = await safeTry(
      this.db
        .update(serviceAccounts)
        .set({ balance, updatedAt: new Date() })
        .where(eq(serviceAccounts.serviceId, serviceId))
        .returning(),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result[0])
  }

  /**
   * Update service account last accumulation time
   */
  async updateLastAccumulation(
    serviceId: number,
    timeSlot: number,
  ): SafePromise<DbServiceAccount> {
    const [err, result] = await safeTry(
      this.db
        .update(serviceAccounts)
        .set({ lastAcc: timeSlot, updatedAt: new Date() })
        .where(eq(serviceAccounts.serviceId, serviceId))
        .returning(),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result[0])
  }

  // ============================================================================
  // Storage Management
  // ============================================================================

  /**
   * Store a key-value pair in service storage
   */
  async setStorageItem(
    serviceId: number,
    key: Uint8Array,
    value: Uint8Array,
  ): SafePromise<DbServiceStorage> {
    const valueHex = bytesToHex(value)
    const [err1, keyHash] = blake2bHash(key)
    if (err1) {
      return safeError(err1)
    }

    const storageData: DbNewServiceStorage = {
      serviceId,
      storageKey: keyHash,
      storageValue: valueHex,
      keyHash,
    }

    const [err2, result] = await safeTry(
      this.db
        .insert(serviceStorage)
        .values(storageData)
        .onConflictDoUpdate({
          target: serviceStorage.id,
          set: {
            storageValue: valueHex,
            updatedAt: new Date(),
          },
        })
        .returning(),
    )

    if (err2) {
      return safeError(err2)
    }

    return safeResult(result[0])
    // Update the JSON storage in service account
    // await this.updateServiceAccountStorage(serviceId, bytesToHex(key), valueHex)
  }

  /**
   * Get a storage item by key
   */
  async getStorageItem(
    serviceId: number,
    key: Uint8Array,
  ): SafePromise<Uint8Array | null> {
    const keyHash = bytesToHex(key) // In practice, this would be Blake2b hash

    const [err, result] = await safeTry(
      this.db
        .select()
        .from(serviceStorage)
        .where(
          and(
            eq(serviceStorage.serviceId, serviceId),
            eq(serviceStorage.keyHash, keyHash),
          ),
        )
        .limit(1),
    )

    if (err) {
      return safeError(err)
    }

    if (result.length === 0) {
      return safeError(new Error('Storage item not found'))
    }

    return safeResult(hexToBytes(result[0].storageValue))
  }

  /**
   * Get all storage items for a service
   */
  async getServiceStorage(serviceId: number): SafePromise<DbServiceStorage[]> {
    const [err, result] = await safeTry(
      this.db
        .select()
        .from(serviceStorage)
        .where(eq(serviceStorage.serviceId, serviceId)),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result)
  }

  /**
   * Update the JSON storage field in service account
   */
  // private async updateServiceAccountStorage(
  //   serviceId: number,
  //   key: string,
  //   value: string,
  // ): Promise<void> {
  //   const account = await this.getServiceAccount(serviceId)
  //   if (!account) {
  //     throw new Error(`Service account ${serviceId} not found`)
  //   }

  //   const storage = account.storage as Record<string, string>
  //   storage[key] = value

  //   await this.db
  //     .update(serviceAccounts)
  //     .set({ storage, updatedAt: new Date() })
  //     .where(eq(serviceAccounts.serviceId, serviceId))
  // }

  // ============================================================================
  // Preimage Management
  // ============================================================================

  /**
   * Store a preimage for a service
   */
  async setPreimage(
    serviceId: number,
    preimage: Uint8Array,
  ): SafePromise<DbServicePreimage> {
    const [err, preimageHash] = blake2bHash(preimage)
    if (err) {
      return safeError(err)
    }
    const preimageData: DbNewServicePreimage = {
      serviceId,
      hash: preimageHash,
      preimage: bytesToHex(preimage),
    }

    const [err2, result] = await safeTry(
      this.db
        .insert(servicePreimages)
        .values(preimageData)
        .onConflictDoUpdate({
          target: servicePreimages.id,
          set: {
            preimage: bytesToHex(preimage),
          },
        })
        .returning(),
    )

    if (err2) {
      return safeError(err2)
    }

    return safeResult(result[0])
  }

  /**
   * Get a preimage by hash
   */
  async getPreimage(
    serviceId: number,
    hash: Hex,
  ): SafePromise<Uint8Array | null> {
    const [err, result] = await safeTry(
      this.db
        .select()
        .from(servicePreimages)
        .where(
          and(
            eq(servicePreimages.serviceId, serviceId),
            eq(servicePreimages.hash, hash),
          ),
        )
        .limit(1),
    )

    if (err) {
      return safeError(err)
    }

    if (result.length === 0) {
      return safeError(new Error('Preimage not found'))
    }

    return safeResult(hexToBytes(result[0].preimage))
  }

  /**
   * Request a preimage for a service
   */
  async requestPreimage(
    serviceId: number,
    hash: Hex,
    length: number,
  ): SafePromise<DbServicePreimageRequest> {
    const requestData: DbNewServicePreimageRequest = {
      serviceId,
      hash,
      length,
      status: 'requested',
    }

    const [err, result] = await safeTry(
      this.db
        .insert(servicePreimageRequests)
        .values(requestData)
        .onConflictDoUpdate({
          target: servicePreimageRequests.id,
          set: {
            status: 'requested',
            updatedAt: new Date(),
          },
        })
        .returning(),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result[0])
  }

  /**
   * Mark preimage as available
   */
  //TODO: optimize this to not make so many queries
  async markPreimageAvailable(
    serviceId: number,
    hash: Hex,
    length: number,
    timeSlot: bigint,
  ): SafePromise<DbServicePreimageRequest> {
    // First, get the request and existing time slots
    const [err, requestResult] = await safeTry(
      this.db
        .select({
          id: servicePreimageRequests.id,
          status: servicePreimageRequests.status,
        })
        .from(servicePreimageRequests)
        .where(
          and(
            eq(servicePreimageRequests.serviceId, serviceId),
            eq(servicePreimageRequests.hash, hash),
            eq(servicePreimageRequests.length, length),
          ),
        )
        .limit(1),
    )

    if (err) {
      return safeError(err)
    }

    if (requestResult.length === 0) {
      return safeError(
        new Error(`Preimage request not found: ${serviceId}:${hash}:${length}`),
      )
    }

    const requestId = requestResult[0].id

    // Get existing time slots for this request
    const [err2, existingSlots] = await safeTry(
      this.db
        .select({
          sequenceIndex: servicePreimageTimeslots.sequenceIndex,
          timeSlot: servicePreimageTimeslots.timeSlot,
        })
        .from(servicePreimageTimeslots)
        .where(eq(servicePreimageTimeslots.requestId, requestId))
        .orderBy(servicePreimageTimeslots.sequenceIndex),
    )

    if (err2) {
      return safeError(err2)
    }

    // Determine the next sequence index (0, 1, or 2)
    const nextSequenceIndex = existingSlots.length as 0 | 1 | 2

    // If we already have 3 time slots, we need to remove the oldest one
    if (existingSlots.length >= 3) {
      // Delete the oldest time slot (sequence index 0)
      const [err3] = await safeTry(
        this.db
          .delete(servicePreimageTimeslots)
          .where(
            and(
              eq(servicePreimageTimeslots.requestId, requestId),
              eq(servicePreimageTimeslots.sequenceIndex, 0),
            ),
          ),
      )

      if (err3) {
        return safeError(err3)
      }

      // Shift existing time slots down by 1
      const [err4] = await safeTry(
        this.db
          .update(servicePreimageTimeslots)
          .set({
            sequenceIndex: sql`${servicePreimageTimeslots.sequenceIndex} - 1`,
          })
          .where(
            and(
              eq(servicePreimageTimeslots.requestId, requestId),
              sql`${servicePreimageTimeslots.sequenceIndex} > 0`,
            ),
          ),
      )

      if (err4) {
        return safeError(err4)
      }
    }

    // Insert the new time slot
    const [err5] = await safeTry(
      this.db.insert(servicePreimageTimeslots).values({
        requestId,
        timeSlot,
        sequenceIndex: nextSequenceIndex,
      }),
    )

    if (err5) {
      return safeError(err5)
    }

    // Update the request status based on the number of time slots
    const totalSlots = Math.min(existingSlots.length + 1, 3)
    let status: 'requested' | 'available' | 'unavailable' | 'reavailable'

    if (totalSlots === 0) {
      status = 'requested'
    } else if (totalSlots === 1) {
      status = 'available'
    } else if (totalSlots === 2) {
      status = 'unavailable'
    } else {
      status = 'reavailable'
    }

    const [err6, result] = await safeTry(
      this.db
        .update(servicePreimageRequests)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(servicePreimageRequests.id, requestId))
        .returning(),
    )

    if (err6) {
      return safeError(err6)
    }

    return safeResult(result[0])
  }

  /**
   * Get time slots for a preimage request
   */
  async getPreimageTimeSlots(
    requestId: number,
  ): SafePromise<Array<{ timeSlot: bigint; sequenceIndex: 0 | 1 | 2 }>> {
    const [err, result] = await safeTry(
      this.db
        .select({
          timeSlot: servicePreimageTimeslots.timeSlot,
          sequenceIndex: servicePreimageTimeslots.sequenceIndex,
        })
        .from(servicePreimageTimeslots)
        .where(eq(servicePreimageTimeslots.requestId, requestId))
        .orderBy(servicePreimageTimeslots.sequenceIndex),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result)
  }

  /**
   * Update the JSON preimages field in service account
   */

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: <explanation>
  // private  async updateServiceAccountPreimages(
  //     serviceId: number,
  //     hash: Hex,
  //     preimage: Hex,
  //   ): SafePromise<DbServicePreimage> {
  //     const [err, result] = await safeTry(
  //       this.db
  //         .update(servicePreimages)
  //         .set({ preimage, hash: hash })
  //         .where(eq(servicePreimages.serviceId, serviceId))
  //         .returning(),
  //     )

  //     if (err) {
  //       return safeError(err)
  //     }

  //     return safeResult(result[0])
  //   }

  // ============================================================================
  // Privileges Management
  // ============================================================================

  /**
   * Grant a privilege to a service
   */
  async grantPrivilege(privilege: {
    privilegeType:
      | 'manager'
      | 'delegator'
      | 'registrar'
      | 'assigner'
      | 'always_accers'
    serviceId: number
    coreIndex?: bigint
    gasLimit?: bigint
  }): SafePromise<DbServicePrivilege> {
    const privilegeData: DbNewServicePrivilege = {
      id: `${privilege.privilegeType}:${privilege.serviceId}`,
      privilegeType: privilege.privilegeType,
      serviceId: privilege.serviceId,
      coreIndex: privilege.coreIndex,
      gasLimit: privilege.gasLimit,
    }

    const [err, result] = await safeTry(
      this.db
        .insert(servicePrivileges)
        .values(privilegeData)
        .onConflictDoUpdate({
          target: servicePrivileges.id,
          set: {
            coreIndex: privilege.coreIndex,
            gasLimit: privilege.gasLimit,
          },
        })
        .returning(),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result[0])
  }

  /**
   * Get all privileges for a service
   */
  async getServicePrivileges(serviceId: number): Promise<DbServicePrivilege[]> {
    return await this.db
      .select()
      .from(servicePrivileges)
      .where(eq(servicePrivileges.serviceId, serviceId))
  }

  /**
   * Get all services with a specific privilege
   */
  async getServicesWithPrivilege(
    privilegeType:
      | 'manager'
      | 'delegator'
      | 'registrar'
      | 'assigner'
      | 'always_accers',
  ): Promise<DbServicePrivilege[]> {
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
    nodeHash: Hex
    nodeType: 'branch' | 'leaf' | 'embedded_leaf'
    nodeData: Hex
    leftChild?: Hex
    rightChild?: Hex
    stateKey?: Hex
    valueHash?: Hex
    embeddedValue?: Hex
  }): Promise<void> {
    const nodeData: DbNewStateTrieNode = {
      nodeHash: node.nodeHash,
      nodeType: node.nodeType,
      nodeData: node.nodeData,
      leftChild: node.leftChild,
      rightChild: node.rightChild,
      stateKey: node.stateKey,
      valueHash: node.valueHash,
      embeddedValue: node.embeddedValue,
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
          embeddedValue: node.embeddedValue,
        },
      })
  }

  /**
   * Get a state trie node by hash
   */
  async getTrieNode(nodeHash: Hex): Promise<DbStateTrieNode | null> {
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
    rootHash: Hex
    blockNumber: bigint
    timeSlot: bigint
  }): Promise<void> {
    const rootData: DbNewStateTrieRoot = {
      id: 1,
      rootHash: root.rootHash,
      blockNumber: root.blockNumber,
      timeSlot: root.timeSlot,
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
          updatedAt: new Date(),
        },
      })
  }

  /**
   * Get the current state trie root
   */
  async getStateTrieRoot(): Promise<DbStateTrieRoot | null> {
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
  async calculateAccountFootprint(serviceId: number): SafePromise<{
    items: number
    octets: bigint
    minBalance: bigint
  }> {
    const [err, storage] = await this.getServiceStorage(serviceId)
    if (err) {
      return safeError(err)
    }
    const [err2, requests] = await safeTry(
      this.db
        .select()
        .from(servicePreimageRequests)
        .where(eq(servicePreimageRequests.serviceId, serviceId)),
    )
    if (err2) {
      return safeError(err2)
    }
    // Calculate items: 2 * len(requests) + len(storage)
    const items = 2 * requests.length + storage.length

    // Calculate octets: sum of storage sizes + request overhead
    let octets = 0n
    for (const req of requests) {
      octets += 81n + BigInt(req.length) // 81 Uint8Array overhead per request
    }
    for (const item of storage) {
      const keyLength = hexToBytes(item.storageKey).length
      const valueLength = hexToBytes(item.storageValue).length
      octets += 34n + BigInt(keyLength) + BigInt(valueLength) // 34 Uint8Array overhead per storage item
    }

    // Calculate minimum balance (simplified - would need actual constants from Gray Paper)
    const baseDeposit = 1000n // TODO: Example constant
    const itemDeposit = 100n // TODO: Example constant
    const byteDeposit = 1n // TODO: Example constant

    const [err3, account] = await this.getServiceAccount(serviceId)
    if (err3) {
      return safeError(err3)
    }
    if (!account) {
      return safeError(new Error('Service account not found'))
    }
    const gratis = account.gratis || 0n

    const minBalance =
      baseDeposit + itemDeposit * BigInt(items) + byteDeposit * octets - gratis

    return safeResult({
      items,
      octets,
      minBalance: minBalance > 0n ? minBalance : 0n,
    })
  }

  /**
   * Update account footprint in database
   */
  async updateAccountFootprint(
    serviceId: number,
  ): SafePromise<DbServiceAccount> {
    const [err, footprint] = await this.calculateAccountFootprint(serviceId)
    if (err) {
      return safeError(err)
    }

    const [err2, result] = await safeTry(
      this.db
        .update(serviceAccounts)
        .set({
          items: footprint.items,
          octets: footprint.octets,
          minBalance: footprint.minBalance,
          updatedAt: new Date(),
        })
        .where(eq(serviceAccounts.serviceId, serviceId))
        .returning(),
    )

    if (err2) {
      return safeError(err2)
    }

    return safeResult(result[0])
  }
}
