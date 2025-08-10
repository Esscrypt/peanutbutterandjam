/**
 * CE 129: State Request Protocol
 *
 * Implements the state request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting ranges of state trie data.
 */

import type {
  Bytes,
  StateRequest,
  StateResponse,
  StreamInfo,
} from '@pbnj/types'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * State trie node interface
 */
interface StateTrieNode {
  /** Node hash */
  hash: Bytes
  /** Node type: 'branch', 'leaf', or 'extension' */
  type: 'branch' | 'leaf' | 'extension'
  /** Children (for branch nodes) */
  children?: Bytes[]
  /** Key (for leaf nodes) */
  key?: Bytes
  /** Value (for leaf nodes) */
  value?: Bytes
  /** Next node (for extension nodes) */
  next?: Bytes
}

/**
 * State request protocol handler
 */
export class StateRequestProtocol {
  private stateStore: Map<string, StateTrieNode> = new Map()
  private keyValueStore: Map<string, Bytes> = new Map()
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
      // Load state trie nodes from database (service ID 3 for state trie)
      // We'll need to implement a method to get all storage for a service
      // For now, we'll load individual items as needed
      console.log('State loading from database - will load items as needed')
    } catch (error) {
      console.error('Failed to load state from database:', error)
    }
  }

  /**
   * Add state trie node to local store and persist to database
   */
  async addStateNode(hash: Bytes, node: StateTrieNode): Promise<void> {
    const hashString = hash.toString()
    this.stateStore.set(hashString, node)

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        const nodeData = {
          hash: Buffer.from(node.hash).toString('hex'),
          type: node.type,
          children: node.children?.map((child) =>
            Buffer.from(child).toString('hex'),
          ),
          key: node.key ? Buffer.from(node.key).toString('hex') : undefined,
          value: node.value
            ? Buffer.from(node.value).toString('hex')
            : undefined,
          next: node.next ? Buffer.from(node.next).toString('hex') : undefined,
        }

        await this.dbIntegration.setServiceStorage(
          3, // Service ID 3 for state trie
          Buffer.from(`state_node_${hashString}`),
          Buffer.from(JSON.stringify(nodeData), 'utf8'),
        )
      } catch (error) {
        console.error('Failed to persist state node to database:', error)
      }
    }
  }

  /**
   * Add key-value pair to local store and persist to database
   */
  async addKeyValue(key: Bytes, value: Bytes): Promise<void> {
    const keyString = key.toString()
    this.keyValueStore.set(keyString, value)

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          3, // Service ID 3 for state trie
          Buffer.from(`kv_${keyString}`),
          value,
        )
      } catch (error) {
        console.error('Failed to persist key-value pair to database:', error)
      }
    }
  }

  /**
   * Get state trie node from local store
   */
  getStateNode(hash: Bytes): StateTrieNode | undefined {
    return this.stateStore.get(hash.toString())
  }

  /**
   * Get key-value pair from local store
   */
  getKeyValue(key: Bytes): Bytes | undefined {
    return this.keyValueStore.get(key.toString())
  }

  /**
   * Get state trie node from database if not in local store
   */
  async getStateNodeFromDatabase(hash: Bytes): Promise<StateTrieNode | null> {
    if (this.getStateNode(hash)) {
      return this.getStateNode(hash) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = hash.toString()
      const nodeData = await this.dbIntegration.getServiceStorage(
        3,
        Buffer.from(`state_node_${hashString}`),
      )

      if (nodeData) {
        const parsedData = JSON.parse(nodeData.toString())
        const node: StateTrieNode = {
          hash: Buffer.from(parsedData.hash, 'hex'),
          type: parsedData.type,
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
        this.stateStore.set(hashString, node)
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
  async getKeyValueFromDatabase(key: Bytes): Promise<Bytes | null> {
    if (this.getKeyValue(key)) {
      return this.getKeyValue(key) || null
    }

    if (!this.dbIntegration) return null

    try {
      const keyString = key.toString()
      const value = await this.dbIntegration.getServiceStorage(
        3,
        Buffer.from(`kv_${keyString}`),
      )

      if (value) {
        // Cache in local store
        this.keyValueStore.set(keyString, value)
        return value
      }

      return null
    } catch (error) {
      console.error('Failed to get key-value pair from database:', error)
      return null
    }
  }

  /**
   * Create state request message
   */
  createStateRequest(
    headerHash: Bytes,
    startKey: Bytes,
    endKey: Bytes,
    maximumSize: number,
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
  async processStateRequest(
    request: StateRequest,
  ): Promise<StateResponse | null> {
    try {
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

      return {
        boundaryNodes,
        keyValuePairs,
      }
    } catch (error) {
      console.error('Failed to process state request:', error)
      return null
    }
  }

  /**
   * Get boundary nodes for the requested range
   */
  private async getBoundaryNodes(
    startKey: Bytes,
    endKey: Bytes,
  ): Promise<Bytes[]> {
    const boundaryNodes: Bytes[] = []

    // Get path to start key
    const startPath = await this.getPathToKey(startKey)
    boundaryNodes.push(...startPath)

    // Get path to end key
    const endPath = await this.getPathToKey(endKey)
    boundaryNodes.push(...endPath)

    // Remove duplicates
    const uniqueNodes = new Set<string>()
    const result: Bytes[] = []

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
    startKey: Bytes,
    endKey: Bytes,
    maximumSize: number,
  ): Promise<Array<{ key: Bytes; value: Bytes }>> {
    const pairs: Array<{ key: Bytes; value: Bytes }> = []

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

    // If we need more data, check database
    if (pairs.length < maximumSize && this.dbIntegration) {
      try {
        const storage = await this.dbIntegration
          .getServiceAccountStore()
          .getServiceStorage(3)

        for (const item of storage) {
          if (item.storageKey.startsWith('kv_')) {
            const keyStr = item.storageKey.replace('kv_', '')
            const key = Buffer.from(keyStr, 'hex')
            const value = Buffer.from(item.storageValue, 'hex')

            // Check if we already have this pair
            const exists = pairs.some((pair) => pair.key.toString() === keyStr)
            if (!exists && this.isKeyInRange(key, startKey, endKey)) {
              pairs.push({ key, value })

              if (pairs.length >= maximumSize) {
                break
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to get key-value pairs from database:', error)
      }
    }

    // Sort by key
    return pairs.sort((a, b) => this.compareKeys(a.key, b.key))
  }

  /**
   * Get path from root to a specific key
   */
  private async getPathToKey(key: Bytes): Promise<Bytes[]> {
    const path: Bytes[] = []
    const _currentKey = key

    // This is a simplified implementation
    // In practice, you would traverse the state trie to find the path
    // For now, we'll return an empty path
    return path
  }

  /**
   * Check if a key is in the specified range
   */
  private isKeyInRange(key: Bytes, startKey: Bytes, endKey: Bytes): boolean {
    const keyStr = key.toString()
    const startStr = startKey.toString()
    const endStr = endKey.toString()

    return keyStr >= startStr && keyStr <= endStr
  }

  /**
   * Compare two keys lexicographically
   */
  private compareKeys(keyA: Bytes, keyB: Bytes): number {
    const strA = keyA.toString()
    const strB = keyB.toString()

    if (strA < strB) return -1
    if (strA > strB) return 1
    return 0
  }

  /**
   * Serialize state request message
   */
  serializeStateRequest(request: StateRequest): Bytes {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(32 + 32 + 32 + 4)
    const view = new DataView(buffer)
    let offset = 0

    // Write header hash (32 bytes)
    new Uint8Array(buffer).set(request.headerHash, offset)
    offset += 32

    // Write start key (32 bytes)
    new Uint8Array(buffer).set(request.startKey, offset)
    offset += 32

    // Write end key (32 bytes)
    new Uint8Array(buffer).set(request.endKey, offset)
    offset += 32

    // Write maximum size (4 bytes, little-endian)
    view.setUint32(offset, request.maximumSize, true)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize state request message
   */
  deserializeStateRequest(data: Bytes): StateRequest {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read header hash (32 bytes)
    const headerHash = data.slice(offset, offset + 32)
    offset += 32

    // Read start key (32 bytes)
    const startKey = data.slice(offset, offset + 32)
    offset += 32

    // Read end key (32 bytes)
    const endKey = data.slice(offset, offset + 32)
    offset += 32

    // Read maximum size (4 bytes, little-endian)
    const maximumSize = view.getUint32(offset, true)

    return {
      headerHash,
      startKey,
      endKey,
      maximumSize,
    }
  }

  /**
   * Serialize state response message
   */
  serializeStateResponse(response: StateResponse): Bytes {
    // Calculate total size
    let totalSize = 4 + 4 // number of boundary nodes + number of key-value pairs

    // Size for boundary nodes
    totalSize += response.boundaryNodes.length * 32

    // Size for key-value pairs
    for (const pair of response.keyValuePairs) {
      totalSize += 4 + pair.key.length + 4 + pair.value.length // key length + key + value length + value
    }

    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)
    let offset = 0

    // Write number of boundary nodes (4 bytes, little-endian)
    view.setUint32(offset, response.boundaryNodes.length, true)
    offset += 4

    // Write boundary nodes
    for (const node of response.boundaryNodes) {
      new Uint8Array(buffer).set(node, offset)
      offset += 32
    }

    // Write number of key-value pairs (4 bytes, little-endian)
    view.setUint32(offset, response.keyValuePairs.length, true)
    offset += 4

    // Write key-value pairs
    for (const pair of response.keyValuePairs) {
      // Write key length (4 bytes, little-endian)
      view.setUint32(offset, pair.key.length, true)
      offset += 4

      // Write key
      new Uint8Array(buffer).set(pair.key, offset)
      offset += pair.key.length

      // Write value length (4 bytes, little-endian)
      view.setUint32(offset, pair.value.length, true)
      offset += 4

      // Write value
      new Uint8Array(buffer).set(pair.value, offset)
      offset += pair.value.length
    }

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize state response message
   */
  deserializeStateResponse(data: Bytes): StateResponse {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read number of boundary nodes (4 bytes, little-endian)
    const numBoundaryNodes = view.getUint32(offset, true)
    offset += 4

    // Read boundary nodes
    const boundaryNodes: Bytes[] = []
    for (let i = 0; i < numBoundaryNodes; i++) {
      const node = data.slice(offset, offset + 32)
      offset += 32
      boundaryNodes.push(node)
    }

    // Read number of key-value pairs (4 bytes, little-endian)
    const numKeyValuePairs = view.getUint32(offset, true)
    offset += 4

    // Read key-value pairs
    const keyValuePairs: Array<{ key: Bytes; value: Bytes }> = []
    for (let i = 0; i < numKeyValuePairs; i++) {
      // Read key length (4 bytes, little-endian)
      const keyLength = view.getUint32(offset, true)
      offset += 4

      // Read key
      const key = data.slice(offset, offset + keyLength)
      offset += keyLength

      // Read value length (4 bytes, little-endian)
      const valueLength = view.getUint32(offset, true)
      offset += 4

      // Read value
      const value = data.slice(offset, offset + valueLength)
      offset += valueLength

      keyValuePairs.push({ key, value })
    }

    return {
      boundaryNodes,
      keyValuePairs,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(
    _stream: StreamInfo,
    data: Bytes,
  ): Promise<StateResponse | null> {
    try {
      const request = this.deserializeStateRequest(data)
      return await this.processStateRequest(request)
    } catch (error) {
      console.error('Failed to handle stream data:', error)
      return null
    }
  }
}
