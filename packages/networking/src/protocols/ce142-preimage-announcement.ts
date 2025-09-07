/**
 * CE 142: Preimage Announcement Protocol
 *
 * Implements the preimage announcement protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for announcing possession of preimages.
 */

import type { Hex, Safe, SafePromise } from '@pbnj/core'
import { bytesToHex, hexToBytes, safeResult } from '@pbnj/core'
import type { PreimageAnnouncement } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Preimage announcement protocol handler
 */
export class PreimageAnnouncementProtocol extends NetworkingProtocol<
  PreimageAnnouncement,
  void
> {
  private preimageAnnouncements: Map<
    Hex,
    {
      serviceIndex: bigint
      hash: Hex
      preimageLength: bigint
      timestamp: bigint
    }
  > = new Map()
  constructor() {
    super()
  }

  /**
   * Store preimage announcement in local store and persist to database
   */
  async storePreimageAnnouncement(
    serviceId: bigint,
    hash: Hex,
    preimageLength: bigint,
  ): Promise<void> {
    this.preimageAnnouncements.set(hash, {
      serviceIndex: serviceId,
      hash,
      preimageLength,
      timestamp: BigInt(Date.now()),
    })
  }

  /**
   * Get preimage announcement from local store
   */
  getPreimageAnnouncement(hash: Hex):
    | {
        serviceIndex: bigint
        hash: Hex
        preimageLength: bigint
        timestamp: bigint
      }
    | undefined {
    return this.preimageAnnouncements.get(hash)
  }

  /**
   * Process preimage announcement
   */
  async processRequest(announcement: PreimageAnnouncement): SafePromise<void> {
    // Store the preimage
    await this.storePreimageAnnouncement(
      announcement.serviceId,
      announcement.hash,
      announcement.preimageLength,
    )

    return safeResult(undefined)
  }

  /**
   * Create preimage announcement message
   */
  // createPreimageAnnouncement(
  //   serviceId: bigint,
  //   hash: Uint8Array,
  //   preimageLength: bigint,
  // ): PreimageAnnouncement {
  //   return {
  //     serviceId,
  //     hash,
  //     preimageLength,
  //   }
  // }

  /**
   * Serialize preimage announcement message
   */
  serializeRequest(announcement: PreimageAnnouncement): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(4 + 32 + 4) // serviceId + hash + preimageLength
    const view = new DataView(buffer)
    let offset = 0

    // Write service ID (4 bytes, little-endian)
    view.setUint32(offset, Number(announcement.serviceId), true)
    offset += 4

    // Write hash (32 bytes)
    new Uint8Array(buffer).set(hexToBytes(announcement.hash), offset)
    offset += 32

    // Write preimage length (4 bytes, little-endian)
    view.setUint32(offset, Number(announcement.preimageLength), true)

    return safeResult(new Uint8Array(buffer))
  }

  /**
   * Deserialize preimage announcement message
   */
  deserializeRequest(data: Uint8Array): Safe<PreimageAnnouncement> {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read service ID (4 bytes, little-endian)
    const serviceId = view.getUint32(offset, true)
    offset += 4

    // Read hash (32 bytes)
    const hash = data.slice(offset, offset + 32)
    offset += 32

    // Read preimage length (4 bytes, little-endian)
    const preimageLength = view.getUint32(offset, true)

    return safeResult({
      serviceId: BigInt(serviceId),
      hash: bytesToHex(hash),
      preimageLength: BigInt(preimageLength),
    })
  }

  //TODO: double check if this is correct
  serializeResponse(_response: void): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  //TODO: double check if this is correct
  deserializeResponse(_data: Uint8Array): Safe<void> {
    return safeResult(undefined)
  }

  async processResponse(_response: void): SafePromise<void> {
    return safeResult(undefined)
  }
}
