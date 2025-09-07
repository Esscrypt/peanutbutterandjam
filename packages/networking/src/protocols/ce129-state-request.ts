/**
 * CE 129: State Request Protocol
 *
 * Implements the state request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting ranges of state trie data.
 */

import type { Hex, Safe, SafePromise } from '@pbnj/core'
import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  safeError,
  safeResult,
} from '@pbnj/core'
import { decodeFixedLength, encodeFixedLength } from '@pbnj/serialization'
import type { BlockStore, ServiceAccountStore } from '@pbnj/state'
import type { StateRequest, StateResponse } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * State trie node interface
 */
interface StateTrieNode {
  /** Node hash */
  hash: Uint8Array
  /** Node type: 'branch', 'leaf', or 'embedded_leaf' */
  type: 'branch' | 'leaf' | 'embedded_leaf'
  /** Children (for branch nodes) */
  children?: Uint8Array[]
  /** Key (for leaf nodes) */
  key?: Uint8Array
  /** Value (for leaf nodes) */
  value?: Uint8Array
  /** Next node (for embedded_leaf nodes) */
  next?: Uint8Array
}

/**
 * State request protocol handler
 */
export class StateRequestProtocol extends NetworkingProtocol<
  StateRequest,
  StateResponse
> {
  private stateStore: Map<string, StateTrieNode> = new Map()
  private keyValueStore: Map<string, Uint8Array> = new Map()
  private blockStore: BlockStore | null = null
  private serviceAccountStore: ServiceAccountStore | null = null

  constructor(
    blockStore?: BlockStore,
    serviceAccountStore?: ServiceAccountStore,
  ) {
    super()
    this.blockStore = blockStore || null
    this.serviceAccountStore = serviceAccountStore || null
  }

  /**
   * Set database integration for persistent storage
   */
  setDatabaseIntegration(
    blockStore: BlockStore,
    serviceAccountStore: ServiceAccountStore,
  ): void {
    this.blockStore = blockStore
    this.serviceAccountStore = serviceAccountStore
  }

  /**
   * Load state from database
   */
  async loadState(): Promise<void> {
    if (!this.serviceAccountStore) return

    try {
      // Load state trie root from database
      const stateRoot = await this.serviceAccountStore.getStateTrieRoot()
      if (stateRoot) {
        console.log('Loaded state trie root:', stateRoot.rootHash)
      }

      // State trie nodes will be loaded on-demand as needed
      console.log('State loading from database - will load items as needed')
    } catch (error) {
      console.error('Failed to load state from database:', error)
    }
  }

  /**
   * Add state trie node to local store and persist to database
   */
  async addStateNode(hash: Uint8Array, node: StateTrieNode): Promise<void> {
    const hashHex = bytesToHex(hash)
    this.stateStore.set(hashHex, node)

    // Persist to database if available
    if (this.serviceAccountStore) {
      try {
        await this.serviceAccountStore.storeTrieNode({
          nodeHash: hashHex,
          nodeType: node.type,
          nodeData: bytesToHex(
            hexToBytes(
              JSON.stringify({
                children: node.children?.map((child) => bytesToHex(child)),
                key: node.key ? bytesToHex(node.key) : undefined,
                value: node.value ? bytesToHex(node.value) : undefined,
                next: node.next ? bytesToHex(node.next) : undefined,
              }) as Hex,
            ),
          ),
        })
      } catch (error) {
        console.error('Failed to persist state node to database:', error)
      }
    }
  }

  /**
   * Add key-value pair to local store and persist to database
   */
  async addKeyValue(key: Uint8Array, value: Uint8Array): Promise<void> {
    const keyString = key.toString()
    this.keyValueStore.set(keyString, value)

    // Key-value pairs are typically stored within service accounts
    // For now, just maintain in memory cache
    // TODO: Implement proper state trie storage integration
  }

  /**
   * Get state trie node from local store
   */
  getStateNode(hash: Uint8Array): StateTrieNode | undefined {
    return this.stateStore.get(hash.toString())
  }

  /**
   * Get key-value pair from local store
   */
  getKeyValue(key: Uint8Array): Uint8Array | undefined {
    return this.keyValueStore.get(key.toString())
  }

  /**
   * Get state trie node from database if not in local store
   */
  async getStateNodeFromDatabase(
    hash: Uint8Array,
  ): Promise<StateTrieNode | null> {
    if (this.getStateNode(hash)) {
      return this.getStateNode(hash) || null
    }

    if (!this.serviceAccountStore) return null

    try {
      const hashHex = bytesToHex(hash)
      const nodeData = await this.serviceAccountStore.getTrieNode(hashHex)

      if (nodeData) {
        const parsedData = JSON.parse(nodeData.nodeData.toString())
        const node: StateTrieNode = {
          hash: hash,
          type: nodeData.nodeType,
          children: parsedData.children?.map((child: string) =>
            Buffer.from(child, 'hex'),
          ),
          key: parsedData.key ? Buffer.from(parsedData.key, 'hex') : undefined,
          value: parsedData.value
            ? Buffer.from(parsedData.value, 'hex')
            : undefined,
          next: parsedData.next
            ? Buffer.from(parsedData.next, 'hex')
            : undefined,
        }

        // Cache in local store
        this.stateStore.set(hashHex.slice(2), node)
        return node
      }

      return null
    } catch (error) {
      console.error('Failed to get state node from database:', error)
      return null
    }
  }

  /**
   * Get key-value pair from database if not in local store
   */
  async getKeyValueFromDatabase(key: Uint8Array): Promise<Uint8Array | null> {
    if (this.getKeyValue(key)) {
      return this.getKeyValue(key) || null
    }

    // Key-value pairs are typically stored within service accounts in the state trie
    // For now, return null and rely on in-memory cache
    // TODO: Implement proper state trie key-value retrieval from service accounts
    return null
  }

  /**
   * Create state request message
   */
  createStateRequest(
    headerHash: Uint8Array,
    startKey: Uint8Array,
    endKey: Uint8Array,
    maximumSize: bigint,
  ): StateRequest {
    return {
      headerHash,
      startKey,
      endKey,
      maximumSize,
    }
  }

  /**
   * Process state request and generate response
   */
  async processRequest(request: StateRequest): SafePromise<StateResponse> {
    try {
      // Validate that the requested block exists
      if (this.blockStore) {
        const headerHashHex = bytesToHex(request.headerHash)
        const [blockError, block] =
          await this.blockStore.getBlock(headerHashHex)
        if (blockError) {
          return safeError(new Error(`Block not found: ${headerHashHex}`))
        }
        if (!block) {
          return safeError(new Error(`Block not found: ${headerHashHex}`))
        }

        console.log(
          `Processing state request for block ${headerHashHex} at timeslot ${block.header.timeslot}`,
        )
      }

      // Get boundary nodes for the requested range
      const boundaryNodes = await this.getBoundaryNodes(
        request.startKey,
        request.endKey,
      )

      // Get key-value pairs in the requested range
      const keyValuePairs = await this.getKeyValuePairs(
        request.startKey,
        request.endKey,
        request.maximumSize,
      )

      return safeResult({
        boundaryNodes,
        keyValuePairs,
      })
    } catch (error) {
      console.error('Failed to process state request:', error)
      return safeError(new Error(`Failed to process state request: ${error}`))
    }
  }

  async processResponse(_response: StateResponse): SafePromise<void> {
    // No response processing needed for state request protocol
    return safeResult(undefined)
  }

  /**
   * Get boundary nodes for the requested range
   */
  private async getBoundaryNodes(
    startKey: Uint8Array,
    endKey: Uint8Array,
  ): Promise<Uint8Array[]> {
    const boundaryNodes: Uint8Array[] = []

    // Get path to start key
    const startPath = await this.getPathToKey(startKey)
    boundaryNodes.push(...startPath)

    // Get path to end key
    const endPath = await this.getPathToKey(endKey)
    boundaryNodes.push(...endPath)

    // Remove duplicates
    const uniqueNodes = new Set<string>()
    const result: Uint8Array[] = []

    for (const node of boundaryNodes) {
      const hash = node.toString()
      if (!uniqueNodes.has(hash)) {
        uniqueNodes.add(hash)
        result.push(node)
      }
    }

    return result
  }

  /**
   * Get key-value pairs in the requested range
   */
  private async getKeyValuePairs(
    startKey: Uint8Array,
    endKey: Uint8Array,
    maximumSize: bigint,
  ): Promise<Array<{ key: Uint8Array; value: Uint8Array }>> {
    const pairs: Array<{ key: Uint8Array; value: Uint8Array }> = []

    // Iterate through all key-value pairs in local store
    for (const [keyStr, value] of this.keyValueStore.entries()) {
      const key = Buffer.from(keyStr, 'hex')

      if (this.isKeyInRange(key, startKey, endKey)) {
        pairs.push({ key, value })

        if (pairs.length >= maximumSize) {
          break
        }
      }
    }

    // If we need more data, would check database here
    // TODO: Implement proper state trie range queries using ServiceAccountStore
    // For now, rely on in-memory cache only

    // Sort by key
    return pairs.sort((a, b) => this.compareKeys(a.key, b.key))
  }

  /**
   * Get path from root to a specific key
   */
  private async getPathToKey(_key: Uint8Array): Promise<Uint8Array[]> {
    const path: Uint8Array[] = []
    // const _currentKey = key

    // This is a simplified implementation
    // In practice, you would traverse the state trie to find the path
    // For now, we'll return an empty path
    return path
  }

  /**
   * Check if a key is in the specified range
   */
  private isKeyInRange(
    key: Uint8Array,
    startKey: Uint8Array,
    endKey: Uint8Array,
  ): boolean {
    const keyStr = key.toString()
    const startStr = startKey.toString()
    const endStr = endKey.toString()

    return keyStr >= startStr && keyStr <= endStr
  }

  /**
   * Compare two keys lexicographically
   */
  private compareKeys(keyA: Uint8Array, keyB: Uint8Array): number {
    const strA = keyA.toString()
    const strB = keyB.toString()

    if (strA < strB) return -1
    if (strA > strB) return 1
    return 0
  }

  /**
   * Serialize state request message
   */
  serializeRequest(request: StateRequest): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const parts: Uint8Array[] = []
    parts.push(request.headerHash)
    parts.push(request.startKey)
    parts.push(request.endKey)
    const [error, maximumSize] = encodeFixedLength(request.maximumSize, 4n)
    if (error) {
      return safeError(error)
    }
    parts.push(maximumSize)
    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize state request message
   */
  deserializeRequest(data: Uint8Array): Safe<StateRequest> {
    let currentData = data
    const headerHash = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)

    const startKey = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)

    const endKey = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)

    const maximumSize = bytesToHex(currentData.slice(0, 4))
    currentData = currentData.slice(4)

    return safeResult({
      headerHash: hexToBytes(headerHash),
      startKey: hexToBytes(startKey),
      endKey: hexToBytes(endKey),
      maximumSize: BigInt(maximumSize),
    })
  }

  /**
   * Serialize state response message
   */
  serializeResponse(response: StateResponse): Safe<Uint8Array> {
    // Calculate total size
    const parts: Uint8Array[] = []
    const [error, numberOfBoundaryNodes] = encodeFixedLength(
      BigInt(response.boundaryNodes.length),
      4n,
    )
    if (error) {
      return safeError(error)
    }
    parts.push(numberOfBoundaryNodes)
    for (const node of response.boundaryNodes) {
      parts.push(node)
    }
    const [error2, numberOfKeyValuePairs] = encodeFixedLength(
      BigInt(response.keyValuePairs.length),
      4n,
    )
    if (error2) {
      return safeError(error2)
    }
    parts.push(numberOfKeyValuePairs)
    for (const pair of response.keyValuePairs) {
      const [error3, key] = encodeFixedLength(BigInt(pair.key.length), 4n)
      if (error3) {
        return safeError(error3)
      }
      parts.push(key)
      const [error4, value] = encodeFixedLength(BigInt(pair.value.length), 4n)
      if (error4) {
        return safeError(error4)
      }
      parts.push(value)
    }
    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize state response message
   */
  deserializeResponse(data: Uint8Array): Safe<StateResponse> {
    let currentData = data
    const [error, numberOfBoundaryNodes] = decodeFixedLength(currentData, 4n)
    if (error) {
      return safeError(error)
    }
    currentData = currentData.slice(4)
    const boundaryNodes: Uint8Array[] = []
    for (let i = 0; i < numberOfBoundaryNodes.value; i++) {
      const node = currentData.slice(0, 32)
      currentData = currentData.slice(32)
      boundaryNodes.push(node)
    }
    const [error2, numberOfKeyValuePairs] = decodeFixedLength(currentData, 4n)
    if (error2) {
      return safeError(error2)
    }
    currentData = currentData.slice(4)
    const keyValuePairs: Array<{ key: Uint8Array; value: Uint8Array }> = []
    for (let i = 0; i < numberOfKeyValuePairs.value; i++) {
      const key = currentData.slice(0, 32)
      currentData = currentData.slice(32)
      const value = currentData.slice(0, 32)
      currentData = currentData.slice(32)
      keyValuePairs.push({ key, value })
    }

    return safeResult({
      boundaryNodes,
      keyValuePairs,
    })
  }
}
