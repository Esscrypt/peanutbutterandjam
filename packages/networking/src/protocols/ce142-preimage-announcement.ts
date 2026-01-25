/**
 * CE 142: Preimage Announcement Protocol
 *
 * Implements the preimage announcement protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for announcing possession of preimages.
 * Service ID = u32
  Preimage Length = u32

  Node -> Validator

  --> Service ID ++ Hash ++ Preimage Length
  --> FIN
  <-- FIN
 */

import type { EventBusService, Hex } from '@pbnjam/core'
import { bytesToHex, hexToBytes, logger } from '@pbnjam/core'
import type { PreimageAnnouncement, Safe, SafePromise } from '@pbnjam/types'
import { safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * Preimage announcement protocol handler
 */
export class PreimageAnnouncementProtocol extends NetworkingProtocol<
  PreimageAnnouncement,
  void
> {
  constructor(private readonly eventBusService: EventBusService) {
    super()

    // Initialize event handlers using the base class method
    this.initializeEventHandlers()
  }

  /**
   * Process preimage announcement
   */
  async processRequest(
    announcement: PreimageAnnouncement,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    logger.info('[CE142] Processing preimage announcement request', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      serviceId: announcement.serviceId.toString(),
      hash: announcement.hash,
      preimageLength: announcement.preimageLength.toString(),
    })

    // Emit JIP-3 preimage announced event
    await this.eventBusService.emitPreimageAnnounced(
      hexToBytes(peerPublicKey),
      'remote', // Received from peer
      announcement.serviceId,
      hexToBytes(announcement.hash),
      announcement.preimageLength,
    )

    // The event bus will trigger handlePreimageAnnouncement which checks if we need to request
    // Preimages are added to pending state when received via handlePreimageReceived

    // Legacy event for backwards compatibility
    this.eventBusService.emitPreimageAnnouncementReceived(
      announcement,
      peerPublicKey,
    )

    return safeResult(undefined)
  }

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

  /**
   * Serialize preimage announcement response
   * JAMNP-S CE 142: Response is FIN (empty)
   */
  serializeResponse(_response: undefined): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  /**
   * Deserialize preimage announcement response
   * JAMNP-S CE 142: Response is FIN (empty)
   */
  deserializeResponse(_data: Uint8Array): Safe<void> {
    return safeResult(undefined)
  }

  async processResponse(
    _response: undefined,
    _peerPublicKey: Hex,
  ): SafePromise<void> {
    return safeResult(undefined)
  }
}
