/**
 * CE 135: Work Report Distribution Protocol
 *
 * Implements the work report distribution protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for distributing guaranteed work reports.
 */

import {
  bytesToHex,
  concatBytes,
  type Hex,
  hexToBytes,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  calculateWorkReportHash,
  decodeFixedLength,
  decodeNatural,
  decodeWorkReport,
  encodeFixedLength,
  encodeNatural,
  encodeWorkReport,
} from '@pbnj/serialization'
import type { WorkStore } from '@pbnj/state'
import type { GuaranteedWorkReport } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Work report distribution protocol handler
 */
// Guaranteed Work-Report = Work-Report ++ Slot ++ len++[Validator Index ++ Ed25519 Signature] (As in GP)

// Guarantor -> Validator

// --> Guaranteed Work-Report
// --> FIN
// <-- FIN
export class WorkReportDistributionProtocol extends NetworkingProtocol<
  GuaranteedWorkReport,
  void
> {
  private workReports: Map<string, GuaranteedWorkReport> = new Map()
  private workStore: WorkStore

  constructor(workStore: WorkStore) {
    super()
    this.workStore = workStore
  }

  /**
   * Process work report distribution
   */
  async processRequest(
    request: GuaranteedWorkReport,
    _peerPublicKey: Hex,
  ): SafePromise<void> {
    const { workReport } = request
    const [error, workReportHash] = calculateWorkReportHash(workReport)
    if (error) {
      return safeError(error)
    }
    this.workReports.set(workReportHash, request)

    // TODO: validate the signatures
    // TODO: associate the work report with the slot
    // Store the work report
    await this.workStore.storeWorkReport(workReport)

    return safeResult(undefined)
  }

  /**
   * Serialize work report distribution message
   */
  serializeRequest(request: GuaranteedWorkReport): Safe<Uint8Array> {
    const parts: Uint8Array[] = []
    const [error, encoded] = encodeWorkReport(request.workReport)
    if (error) {
      return safeError(error)
    }
    parts.push(encoded)

    const [error2, encodedSlot] = encodeFixedLength(request.slot, 4n)
    if (error2) {
      return safeError(error2)
    }
    parts.push(encodedSlot)

    const bytesLength = request.signatures.length
    const [error3, encodedSignaturesLength] = encodeNatural(BigInt(bytesLength))
    if (error3) {
      return safeError(error3)
    }
    parts.push(encodedSignaturesLength)
    for (const signature of request.signatures) {
      const [error3, encodedValidatorIndex] = encodeFixedLength(
        signature.validatorIndex,
        2n,
      )
      if (error3) {
        return safeError(error3)
      }
      parts.push(encodedValidatorIndex)
      parts.push(hexToBytes(signature.signature))
    }
    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize work report distribution message
   */
  deserializeRequest(data: Uint8Array): Safe<GuaranteedWorkReport> {
    const [error, workReportResult] = decodeWorkReport(data)
    if (error) {
      return safeError(error)
    }
    const workReport = workReportResult.value
    data = workReportResult.remaining
    const [error2, slotResult] = decodeFixedLength(data, 4n)
    if (error2) {
      return safeError(error2)
    }
    const slot = slotResult.value
    data = slotResult.remaining
    const [error3, signaturesLengthResult] = decodeNatural(data)
    if (error3) {
      return safeError(error3)
    }
    const signaturesLength = signaturesLengthResult.value
    data = signaturesLengthResult.remaining
    const signatures: Array<{ validatorIndex: bigint; signature: Hex }> = []
    for (let i = 0; i < Number(signaturesLength); i++) {
      const [error4, validatorIndexResult] = decodeFixedLength(data, 2n)
      if (error4) {
        return safeError(error4)
      }
      const validatorIndex = validatorIndexResult.value
      data = validatorIndexResult.remaining
      const signature = bytesToHex(data.slice(0, 32))
      data = data.slice(32)
      signatures.push({ validatorIndex: validatorIndex, signature: signature })
    }
    return safeResult({
      workReport: workReport,
      slot: slot,
      signatures,
    })
  }

  /**
   * Serialize work report distribution response
   */
  serializeResponse(_response: undefined): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  /**
   * Deserialize work report distribution response
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
