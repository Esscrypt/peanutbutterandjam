import { logger } from '@pbnj/core'
import type { SubscriptionManager } from './subscription-manager'
import type {
  Blob,
  CoreIndex,
  Hash,
  Parameters,
  RpcParams,
  RpcResult,
  ServiceId,
  Slot,
  WebSocket,
} from './types'

export class RpcHandler {
  constructor(private subscriptionManager: SubscriptionManager) {}

  async handleMethod(
    method: string,
    params: RpcParams,
    ws?: WebSocket,
  ): Promise<RpcResult> {
    logger.debug('Handling RPC method', { method, params })

    switch (method) {
      // Chain information methods
      case 'parameters':
        return this.parameters()

      case 'bestBlock':
        return this.bestBlock()

      case 'subscribeBestBlock':
        return this.subscribeBestBlock(ws!)

      case 'finalizedBlock':
        return this.finalizedBlock()

      case 'subscribeFinalizedBlock':
        return this.subscribeFinalizedBlock(ws!)

      case 'parent':
        return this.parent(params[0])

      case 'stateRoot':
        return this.stateRoot(params[0])

      // Statistics methods
      case 'statistics':
        return this.statistics(params[0])

      case 'subscribeStatistics':
        return this.subscribeStatistics(params[0], ws!)

      // Service data methods
      case 'serviceData':
        return this.serviceData(params[0], params[1])

      case 'subscribeServiceData':
        return this.subscribeServiceData(params[0], params[1], ws!)

      case 'serviceValue':
        return this.serviceValue(params[0], params[1], params[2])

      case 'subscribeServiceValue':
        return this.subscribeServiceValue(params[0], params[1], params[2], ws!)

      case 'servicePreimage':
        return this.servicePreimage(params[0], params[1], params[2])

      case 'subscribeServicePreimage':
        return this.subscribeServicePreimage(
          params[0],
          params[1],
          params[2],
          ws!,
        )

      case 'serviceRequest':
        return this.serviceRequest(params[0], params[1], params[2], params[3])

      case 'subscribeServiceRequest':
        return this.subscribeServiceRequest(
          params[0],
          params[1],
          params[2],
          params[3],
          ws!,
        )

      // BEEFY methods
      case 'beefyRoot':
        return this.beefyRoot(params[0])

      // Submission methods
      case 'submitWorkPackage':
        return this.submitWorkPackage(params[0], params[1], params[2])

      case 'submitPreimage':
        return this.submitPreimage(params[0], params[1], params[2])

      // Service listing
      case 'listServices':
        return this.listServices(params[0])

      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }

  // Chain information methods
  private parameters(): Parameters {
    // Mock implementation - replace with actual implementation
    return {
      deposit_per_account: BigInt(1000000),
      deposit_per_item: BigInt(100000),
      deposit_per_byte: BigInt(1000),
      min_turnaround_period: 10,
      epoch_period: 100,
      rotation_period: 50,
      availability_timeout: 30,
      max_accumulate_gas: 1000000,
      max_is_authorized_gas: 500000,
      max_refine_gas: 2000000,
      block_gas_limit: 5000000,
      recent_block_count: 100,
      auth_window: 20,
      auth_queue_len: 1000,
      max_lookup_anchor_age: 50,
      max_work_items: 100,
      max_dependencies: 10,
      max_tickets_per_block: 50,
      tickets_attempts_number: 3,
      max_extrinsics: 1000,
      val_count: 100,
      max_input: 1024 * 1024,
      max_refine_code_size: 1024 * 1024,
      basic_piece_len: 1024,
      max_imports: 100,
      max_is_authorized_code_size: 512 * 1024,
      max_exports: 100,
      max_refine_memory: 1024 * 1024,
      max_is_authorized_memory: 512 * 1024,
    }
  }

  private bestBlock(): { hash: Hash; slot: Slot } {
    // Mock implementation - replace with actual implementation
    return {
      hash: this.generateMockHash(),
      slot: BigInt(12345),
    }
  }

  private subscribeBestBlock(ws: WebSocket): string {
    const subscriptionId = this.subscriptionManager.addSubscription(
      ws,
      'bestBlock',
      [],
    )
    return subscriptionId
  }

  private finalizedBlock(): { hash: Hash; slot: Slot } {
    // Mock implementation - replace with actual implementation
    return {
      hash: this.generateMockHash(),
      slot: BigInt(12340),
    }
  }

  private subscribeFinalizedBlock(ws: WebSocket): string {
    const subscriptionId = this.subscriptionManager.addSubscription(
      ws,
      'finalizedBlock',
      [],
    )
    return subscriptionId
  }

  private parent(_childHash: Hash): { hash: Hash; slot: Slot } | null {
    // Mock implementation - replace with actual implementation
    return {
      hash: this.generateMockHash(),
      slot: BigInt(12344),
    }
  }

  private stateRoot(_blockHash: Hash): Hash | null {
    // Mock implementation - replace with actual implementation
    return this.generateMockHash()
  }

  private statistics(_blockHash: Hash): Blob | null {
    // Mock implementation - replace with actual implementation
    return new Uint8Array([1, 2, 3, 4, 5])
  }

  private subscribeStatistics(finalized: boolean, ws: WebSocket): string {
    const subscriptionId = this.subscriptionManager.addSubscription(
      ws,
      'statistics',
      [finalized],
    )
    return subscriptionId
  }

  private serviceData(_blockHash: Hash, _serviceId: ServiceId): Blob | null {
    // Mock implementation - replace with actual implementation
    return new Uint8Array([1, 2, 3, 4, 5])
  }

  private subscribeServiceData(
    serviceId: ServiceId,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    const subscriptionId = this.subscriptionManager.addSubscription(
      ws,
      'serviceData',
      [serviceId, finalized],
    )
    return subscriptionId
  }

  private serviceValue(
    _blockHash: Hash,
    _serviceId: ServiceId,
    _key: Blob,
  ): Blob | null {
    // Mock implementation - replace with actual implementation
    return new Uint8Array([1, 2, 3, 4, 5])
  }

  private subscribeServiceValue(
    serviceId: ServiceId,
    key: Blob,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    const subscriptionId = this.subscriptionManager.addSubscription(
      ws,
      'serviceValue',
      [serviceId, key, finalized],
    )
    return subscriptionId
  }

  private servicePreimage(
    _blockHash: Hash,
    _serviceId: ServiceId,
    _hash: Hash,
  ): Blob | null {
    // Mock implementation - replace with actual implementation
    return new Uint8Array([1, 2, 3, 4, 5])
  }

  private subscribeServicePreimage(
    serviceId: ServiceId,
    hash: Hash,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    const subscriptionId = this.subscriptionManager.addSubscription(
      ws,
      'servicePreimage',
      [serviceId, hash, finalized],
    )
    return subscriptionId
  }

  private serviceRequest(
    _blockHash: Hash,
    _serviceId: ServiceId,
    _hash: Hash,
    _len: number,
  ): Slot[] | null {
    // Mock implementation - replace with actual implementation
    return [BigInt(12345), BigInt(12346)]
  }

  private subscribeServiceRequest(
    serviceId: ServiceId,
    hash: Hash,
    len: number,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    const subscriptionId = this.subscriptionManager.addSubscription(
      ws,
      'serviceRequest',
      [serviceId, hash, len, finalized],
    )
    return subscriptionId
  }

  private beefyRoot(_blockHash: Hash): Hash | null {
    // Mock implementation - replace with actual implementation
    return this.generateMockHash()
  }

  private submitWorkPackage(
    coreIndex: CoreIndex,
    workPackage: Blob,
    extrinsics: Blob[],
  ): void {
    // Mock implementation - replace with actual implementation
    logger.info('Submitting work package', {
      coreIndex,
      workPackageSize: workPackage.length,
      extrinsicsCount: extrinsics.length,
    })
  }

  private submitPreimage(
    serviceId: ServiceId,
    preimage: Blob,
    blockHash: Hash,
  ): void {
    // Mock implementation - replace with actual implementation
    logger.info('Submitting preimage', {
      serviceId,
      preimageSize: preimage.length,
      blockHash: Array.from(blockHash),
    })
  }

  private listServices(_blockHash: Hash): ServiceId[] {
    // Mock implementation - replace with actual implementation
    return [1, 2, 3, 4, 5]
  }

  private generateMockHash(): Hash {
    // Generate a mock 32-byte hash
    const hash = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      hash[i] = Math.floor(Math.random() * 256)
    }
    return hash
  }
}
