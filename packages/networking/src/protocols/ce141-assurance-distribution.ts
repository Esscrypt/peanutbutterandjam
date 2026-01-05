/**
 * CE 141: Assurance Distribution Protocol
 *
 * Implements the assurance distribution protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for distributing availability assurances.
 *
 * 
 *  Bitfield = [u8; ceil(C / 8)] (One bit per core; C is the total number of cores)
Assurance = Header Hash (Anchor) ++ Bitfield ++ Ed25519 Signature

Assurer -> Validator

--> Assurance
--> FIN
<-- FIN
 */

import {
  bytesToHex,
  concatBytes,
  type EventBusService,
  type Hex,
  hexToBytes,
} from '@pbnjam/core'
import type {
  AssuranceDistributionRequest,
  IConfigService,
  Safe,
  SafePromise,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * Assurance distribution protocol handler
 */
export class AssuranceDistributionProtocol extends NetworkingProtocol<
  AssuranceDistributionRequest,
  void
> {
  constructor(
    private readonly eventBusService: EventBusService,
    private readonly configService: IConfigService,
  ) {
    super()

    this.configService = configService
    this.eventBusService = eventBusService
    // Initialize event handlers using the base class method
    this.initializeEventHandlers()
  }

  /**
   * Process assurance distribution
   */
  async processRequest(
    assurance: AssuranceDistributionRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    this.eventBusService.emitAssuranceReceived(assurance, peerPublicKey)

    return safeResult(undefined)
  }

  /**
   * Serialize assurance distribution message
   */
  serializeRequest(assurance: AssuranceDistributionRequest): Safe<Uint8Array> {
    // Calculate total size
    const parts: Uint8Array[] = []

    // Add anchor hash (32 bytes)
    parts.push(hexToBytes(assurance.anchorHash))

    // 2. XA_bitfield (fixed-length bitfield, no length prefix)
    // Note: jamtestvectors encode bitfield without length prefix despite variable sizes
    // Bitfield size = ceil(numCores / 8) bytes
    const bitfieldBytes = hexToBytes(assurance.bitfield)

    // Add bitfield data
    parts.push(bitfieldBytes)

    // Add signature (64 bytes for Ed25519)
    parts.push(hexToBytes(assurance.signature))

    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize assurance distribution message
   */
  deserializeRequest(data: Uint8Array): Safe<AssuranceDistributionRequest> {
    let offset = 0

    // Read anchor hash (32 bytes)
    const anchorHash = data.slice(offset, offset + 32)
    offset += 32

    // 2. XA_bitfield (fixed-length bitfield, no length prefix)
    // Note: jamtestvectors encode bitfield without length prefix despite variable sizes
    // Bitfield size = ceil(numCores / 8) bytes
    const BITFIELD_SIZE = Math.ceil(this.configService.numCores / 8)
    if (data.length < BITFIELD_SIZE) {
      return safeError(new Error('Insufficient data for bitfield'))
    }
    const bitfield = data.slice(0, BITFIELD_SIZE)
    data = data.slice(BITFIELD_SIZE)
    offset += BITFIELD_SIZE

    // Read signature (64 bytes for Ed25519)
    const signature = data.slice(offset, offset + 64)

    return safeResult({
      anchorHash: bytesToHex(anchorHash),
      bitfield: bytesToHex(bitfield),
      signature: bytesToHex(signature),
    })
  }

  /**
   * Serialize response (void)
   */
  serializeResponse(_response: undefined): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  /**
   * Deserialize response (void)
   */
  deserializeResponse(_data: Uint8Array): Safe<void> {
    return safeResult(undefined)
  }

  /**
   * Process response (void)
   */
  async processResponse(
    _response: undefined,
    _peerPublicKey: Hex,
  ): SafePromise<void> {
    return safeResult(undefined)
  }
}
