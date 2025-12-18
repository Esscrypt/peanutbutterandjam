import { bytesToHex, type Hex, logger } from '@pbnjam/core'
import type { SubscriptionManager } from './subscription-manager'
import type { Parameters, RpcParams, RpcResult, WebSocket } from './types'

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
        return this.parent(params[0] as Hex)

      case 'stateRoot':
        return this.stateRoot(params[0] as Hex)

      // Statistics methods
      case 'statistics':
        return this.statistics(params[0] as Hex)

      case 'subscribeStatistics':
        return this.subscribeStatistics(params[0] as boolean, ws!)

      // Service data methods
      case 'serviceData':
        return this.serviceData(params[0] as Hex, params[1] as number)

      case 'subscribeServiceData':
        return this.subscribeServiceData(
          params[0] as number,
          params[1] as boolean,
          ws!,
        )

      case 'serviceValue':
        return this.serviceValue(
          params[0] as Hex,
          params[1] as number,
          params[2] as unknown as Uint8Array,
        )

      case 'subscribeServiceValue':
        return this.subscribeServiceValue(
          params[0] as number,
          params[1] as unknown as Uint8Array,
          params[2] as boolean,
          ws!,
        )

      case 'servicePreimage':
        return this.servicePreimage(
          params[0] as Hex,
          params[1] as number,
          params[2] as unknown as Hex,
        )

      case 'subscribeServicePreimage':
        return this.subscribeServicePreimage(
          params[0] as number,
          params[1] as Hex,
          params[2] as boolean,
          ws!,
        )

      case 'serviceRequest':
        return this.serviceRequest(
          params[0] as Hex,
          params[1] as number,
          params[2] as Hex,
          params[3] as number,
        )

      case 'subscribeServiceRequest':
        return this.subscribeServiceRequest(
          params[0] as number,
          params[1] as Hex,
          params[2] as number,
          params[3] as boolean,
          ws!,
        )

      // BEEFY methods
      case 'beefyRoot':
        return this.beefyRoot(params[0] as Hex)

      // Submission methods
      case 'submitWorkPackage':
        this.submitWorkPackage(
          params[0] as unknown as bigint,
          params[1] as unknown as Uint8Array,
          params[2] as unknown as Uint8Array[],
        )
        return null

      case 'submitPreimage':
        this.submitPreimage(
          params[0] as unknown as bigint,
          params[1] as unknown as Uint8Array,
          params[2] as unknown as Hex,
        )
        return null

      // Service listing
      case 'listServices':
        return this.listServices(params[0] as Hex)

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

  private bestBlock(): { hash: Hex; slot: bigint } {
    // Mock implementation - replace with actual implementation
    return {
      hash: `0x${'0'.repeat(32)}` as Hex, // TODO: replace with actual hash
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

  private finalizedBlock(): { hash: Hex; slot: bigint } {
    // Mock implementation - replace with actual implementation
    return {
      hash: `0x${'0'.repeat(32)}` as Hex, // TODO: replace with actual hash
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

  private parent(_childHash: Hex): { hash: Hex; slot: bigint } | null {
    // Mock implementation - replace with actual implementation
    return {
      hash: `0x${'0'.repeat(32)}` as Hex, // TODO: replace with actual hash
      slot: BigInt(12344),
    }
  }

  private stateRoot(_blockHash: Hex): Hex | null {
    // Mock implementation - replace with actual implementation
    return `0x${'0'.repeat(32)}` as Hex // TODO: replace with actual hash
  }

  private statistics(_blockHash: Hex): Uint8Array | null {
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

  private serviceData(_blockHash: Hex, _serviceId: number): Uint8Array | null {
    // Mock implementation - replace with actual implementation
    return new Uint8Array([1, 2, 3, 4, 5])
  }

  private subscribeServiceData(
    serviceId: number,
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
    _blockHash: Hex,
    _serviceId: number,
    _key: Uint8Array,
  ): Uint8Array | null {
    // Mock implementation - replace with actual implementation
    return new Uint8Array([1, 2, 3, 4, 5])
  }

  private subscribeServiceValue(
    serviceId: number,
    key: Uint8Array,
    finalized: boolean,
    ws: WebSocket,
  ): string {
    const subscriptionId = this.subscriptionManager.addSubscription(
      ws,
      'serviceValue',
      [serviceId, bytesToHex(key), finalized],
    )
    return subscriptionId
  }

  private servicePreimage(
    _blockHash: Hex,
    _serviceId: number,
    _hash: Hex,
  ): Uint8Array | null {
    // Mock implementation - replace with actual implementation
    return new Uint8Array([1, 2, 3, 4, 5])
  }

  private subscribeServicePreimage(
    serviceId: number,
    hash: Hex,
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
    _blockHash: Hex,
    _serviceId: number,
    _hash: Hex,
    _len: number,
  ): bigint[] | null {
    // Mock implementation - replace with actual implementation
    return [BigInt(12345), BigInt(12346)]
  }

  private subscribeServiceRequest(
    serviceId: number,
    hash: Hex,
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

  private beefyRoot(_blockHash: Hex): Hex | null {
    // Mock implementation - replace with actual implementation
    return `0x${'0'.repeat(32)}` as Hex // TODO: replace with actual hash
  }

  private submitWorkPackage(
    coreIndex: bigint,
    workPackage: Uint8Array,
    extrinsics: Uint8Array[],
  ): void {
    // Mock implementation - replace with actual implementation
    logger.info('Submitting work package', {
      coreIndex,
      workPackageSize: workPackage.length,
      extrinsicsCount: extrinsics.length,
    })
  }

  private submitPreimage(
    serviceId: bigint,
    preimage: Uint8Array,
    blockHash: Hex,
  ): void {
    // Mock implementation - replace with actual implementation
    logger.info('Submitting preimage', {
      serviceId,
      preimageSize: preimage.length,
      blockHash: Array.from(blockHash),
    })
  }

  private listServices(_blockHash: Hex): bigint[] {
    // Mock implementation - replace with actual implementation
    return [1n, 2n, 3n, 4n, 5n]
  }
}
