/**
 * CE 136: Work Report Request Protocol
 *
 * Implements the work report request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting missing work reports.
 */

import {
  bytesToHex,
  type Hex,
  hexToBytes,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  calculateWorkReportHash,
  decodeWorkReport,
  encodeWorkReport,
} from '@pbnj/serialization'
import type { WorkStore } from '@pbnj/state'
import type {
  WorkReport,
  WorkReportRequest,
  WorkReportResponse,
} from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Work report request protocol handler
 */
export class WorkReportRequestProtocol extends NetworkingProtocol<
  WorkReportRequest,
  WorkReportResponse
> {
  private workReports: Map<string, WorkReport> = new Map()
  private workStore: WorkStore

  constructor(workStore: WorkStore) {
    super()
    this.workStore = workStore
  }

  /**
   * Store work report in local store and persist to database
   */
  async storeWorkReport(workReport: WorkReport): Promise<void> {
    const [error, workReportHash] = calculateWorkReportHash(workReport)
    if (error) {
      throw error
    }
    this.workReports.set(workReportHash, workReport)

    await this.workStore.storeWorkReport(workReport)
  }

  /**
   * Process work report request and generate response
   */
  async processRequest(
    request: WorkReportRequest,
    _peerPublicKey: Hex,
  ): SafePromise<WorkReportResponse> {
    // Get work report from local store or database
    const workReportFromCache = this.workReports.get(request.workReportHash)

    if (workReportFromCache) {
      return safeResult({
        workReport: workReportFromCache,
      })
    }

    const workReportFromDatabase = await this.workStore.getWorkReport(
      request.workReportHash,
    )
    if (workReportFromDatabase) {
      return safeResult({
        workReport: workReportFromDatabase,
      })
    }
    return safeError(new Error('Work report not found'))
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

  async processResponse(
    _response: WorkReportResponse,
    _peerPublicKey: Hex,
  ): SafePromise<void> {
    return safeResult(undefined)
  }
}
