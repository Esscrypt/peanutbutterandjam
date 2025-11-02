/**
 * CE 134: Work Package Sharing Protocol
 *
 * Implements the work package sharing protocol for JAMNP-S (Gray Paper)
 * This is a Common Ephemeral (CE) stream for guarantors to share work packages.
 *
 * Message Format (Guarantor -> Guarantor):
 * --> Core Index (4 bytes) ++ Segments-Root Mappings (len++[32 + 32]) ++ Work-Package Bundle ++ FIN
 * <-- Work-Report Hash (32 bytes) ++ Ed25519 Signature (64 bytes) ++ FIN
 *
 * Gray Paper Reference: guaranteeing.tex (line 31-33)
 */

import type { EventBusService } from '@pbnj/core'
import { concatBytes } from '@pbnj/core'
import {
  decodeVariableSequence,
  decodeWorkPackage,
  encodeVariableSequence,
  encodeWorkPackage,
} from '@pbnj/serialization'
import type {
  Safe,
  SafePromise,
  WorkPackageSharing,
  WorkPackageSharingResponse,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import type { Hex } from 'viem'
import { NetworkingProtocol } from './protocol'

/**
 * Work package sharing protocol handler
 */
export class CE134WorkPackageSharingProtocol extends NetworkingProtocol<
  WorkPackageSharing,
  WorkPackageSharingResponse
> {
  private readonly eventBusService: EventBusService

  constructor(eventBusService: EventBusService) {
    super()
    this.eventBusService = eventBusService

    this.initializeEventHandlers()
  }

  /**
   * Process work package sharing request
   * Gray Paper: Guarantor receives work package bundle and segments root mappings from co-guarantor
   */
  async processRequest(
    sharing: WorkPackageSharing,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    // Emit event for guarantor to act upon
    await this.eventBusService.emitWorkPackageSharing(sharing, peerPublicKey)

    return safeResult(undefined)
  }

  /**
   * Process work package sharing response
   * Gray Paper: Guarantor receives work-report signature from co-guarantor
   */
  async processResponse(
    response: WorkPackageSharingResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    // Emit event for guarantor to act upon
    await this.eventBusService.emitWorkPackageSharingResponse(
      response,
      peerPublicKey,
    )

    return safeResult(undefined)
  }

  /**
   * Serialize work package sharing request
   *
   * Format:
   * - Core Index (4 bytes, little-endian)
   * - Segments-Root Mappings = len++[Work-Package Hash (32 bytes) ++ Segments-Root (32 bytes)]
   * - Work-Package Bundle (encoded using Gray Paper serialization)
   */
  serializeRequest(sharing: WorkPackageSharing): Safe<Uint8Array> {
    const parts: Uint8Array[] = []

    // 1. Core Index (4 bytes, little-endian)
    const coreIndexBytes = new Uint8Array(4)
    new DataView(coreIndexBytes.buffer).setUint32(
      0,
      Number(sharing.coreIndex),
      true,
    )
    parts.push(coreIndexBytes)

    // 2. Segments-Root Mappings (encoded as len++[hash++root])
    const [mappingsError, encodedMappings] = encodeVariableSequence(
      sharing.segmentsRootMappings,
      (mapping) => {
        // Validate lengths
        if (mapping.workPackageHash.length !== 32) {
          return safeError(
            new Error(
              `Invalid work package hash length: ${mapping.workPackageHash.length}, expected 32`,
            ),
          )
        }
        if (mapping.segmentsRoot.length !== 32) {
          return safeError(
            new Error(
              `Invalid segments root length: ${mapping.segmentsRoot.length}, expected 32`,
            ),
          )
        }

        // Concatenate hash++root (64 bytes total)
        const mappingBytes = new Uint8Array(64)
        mappingBytes.set(mapping.workPackageHash, 0)
        mappingBytes.set(mapping.segmentsRoot, 32)
        return safeResult(mappingBytes)
      },
    )

    if (mappingsError) {
      throw new Error(
        `Failed to encode segments root mappings: ${mappingsError.message}`,
      )
    }
    parts.push(encodedMappings)

    // 3. Work-Package Bundle (use encodeWorkPackage from serialization package)
    const [encodeError, encodedBundle] = encodeWorkPackage(
      sharing.workPackageBundle,
    )
    if (encodeError) {
      throw new Error(
        `Failed to encode work package bundle: ${encodeError.message}`,
      )
    }
    parts.push(encodedBundle)

    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize work package sharing request
   */
  deserializeRequest(data: Uint8Array): Safe<WorkPackageSharing> {
    let offset = 0

    // 1. Core Index (4 bytes, little-endian)
    if (data.length < 4) {
      throw new Error('Insufficient data for core index')
    }
    const coreIndex = BigInt(
      new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true),
    )
    offset += 4

    // 2. Segments-Root Mappings (len++[hash++root])
    const [mappingsError, mappingsResult] = decodeVariableSequence<{
      workPackageHash: Uint8Array
      segmentsRoot: Uint8Array
    }>(data.slice(offset), (itemData: Uint8Array) => {
      if (itemData.length < 64) {
        return safeError(
          new Error(`Insufficient data for mapping: ${itemData.length}`),
        )
      }
      return safeResult({
        value: {
          workPackageHash: itemData.slice(0, 32),
          segmentsRoot: itemData.slice(32, 64),
        },
        remaining: itemData.slice(64),
        consumed: 64,
      })
    })

    if (mappingsError || !mappingsResult) {
      throw new Error(
        `Failed to decode segments root mappings: ${mappingsError?.message}`,
      )
    }

    const segmentsRootMappings = mappingsResult.value
    offset += mappingsResult.consumed

    // 3. Work-Package Bundle (use decodeWorkPackage from serialization package)
    const [decodeError, workPackageResult] = decodeWorkPackage(
      data.slice(offset),
    )
    if (decodeError || !workPackageResult) {
      throw new Error(
        `Failed to decode work package bundle: ${decodeError?.message}`,
      )
    }

    const workPackageBundle = workPackageResult.value

    return safeResult({
      coreIndex,
      segmentsRootMappings,
      workPackageBundle,
    })
  }

  /**
   * Serialize work package sharing response
   *
   * Format:
   * - Work-Report Hash (32 bytes)
   * - Ed25519 Signature (64 bytes)
   */
  serializeResponse(response: WorkPackageSharingResponse): Safe<Uint8Array> {
    // Validate lengths
    if (response.workReportHash.length !== 32) {
      throw new Error(
        `Invalid work report hash length: ${response.workReportHash.length}, expected 32`,
      )
    }
    if (response.signature.length !== 64) {
      throw new Error(
        `Invalid signature length: ${response.signature.length}, expected 64`,
      )
    }

    // Concatenate hash++signature (96 bytes total)
    const result = new Uint8Array(96)
    result.set(response.workReportHash, 0)
    result.set(response.signature, 32)

    return safeResult(result)
  }

  /**
   * Deserialize work package sharing response
   */
  deserializeResponse(data: Uint8Array): Safe<WorkPackageSharingResponse> {
    if (data.length !== 96) {
      throw new Error(`Invalid response length: ${data.length}, expected 96`)
    }

    return safeResult({
      workReportHash: data.slice(0, 32),
      signature: data.slice(32, 96),
    })
  }
}
