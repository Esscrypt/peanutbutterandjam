/**
 * CE 136: Work Report Request Protocol
 *
 * Implements the work report request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting missing work reports.
 */

import { decodeWorkReport, encodeWorkReport } from '@pbnjam/codec'
import {
  bytesToHex,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
} from '@pbnjam/core'
import type {
  Safe,
  SafePromise,
  WorkReportRequest,
  WorkReportResponse,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * Work report request protocol handler
 */
export class WorkReportRequestProtocol extends NetworkingProtocol<
  WorkReportRequest,
  WorkReportResponse
> {
  private readonly eventBus: EventBusService
  constructor(eventBus: EventBusService) {
    super()
    this.eventBus = eventBus

    // Initialize event handlers using the base class method
    this.initializeEventHandlers()
  }

  /**
   * Process work report request and generate response
   */
  async processRequest(
    request: WorkReportRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    logger.info('[CE136] Processing work report request', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      workReportHash: request.workReportHash,
    })

    this.eventBus.emitWorkReportRequest(request, peerPublicKey)
    return safeResult(undefined)
  }

  async processResponse(
    response: WorkReportResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    this.eventBus.emitWorkReportResponse(response, peerPublicKey)
    return safeResult(undefined)
  }

  /**
   * Serialize work report request message
   */
  serializeRequest(request: WorkReportRequest): Safe<Uint8Array> {
    return safeResult(hexToBytes(request.workReportHash))
  }

  /**
   * Deserialize work report request message
   */
  deserializeRequest(data: Uint8Array): Safe<WorkReportRequest> {
    return safeResult({
      workReportHash: bytesToHex(data),
    })
  }

  /**
   * Serialize work report response message
   */
  serializeResponse(response: WorkReportResponse): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const [error, encoded] = encodeWorkReport(response.workReport)
    if (error) {
      return safeError(error)
    }
    return safeResult(encoded)
  }

  /**
   * Deserialize work report response message
   */
  deserializeResponse(data: Uint8Array): Safe<WorkReportResponse> {
    const [error, workReport] = decodeWorkReport(data)
    if (error) {
      return safeError(error)
    }
    return safeResult({
      workReport: workReport.value,
    })
  }
}
