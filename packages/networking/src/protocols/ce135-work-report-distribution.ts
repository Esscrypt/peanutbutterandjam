/**
 * CE 135: Work Report Distribution Protocol
 *
 * Implements the work report distribution protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for distributing guaranteed work reports.
 */

// import { validateGuaranteeSignatures } from '@pbnjam/guarantor'
import {
  decodeFixedLength,
  decodeNatural,
  decodeWorkReport,
  encodeFixedLength,
  encodeNatural,
  encodeWorkReport,
} from '@pbnjam/codec'
import {
  blake2bHash,
  bytesToHex,
  concatBytes,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
} from '@pbnjam/core'
import type {
  GuaranteedWorkReport,
  GuaranteeOutline,
  Safe,
  SafePromise,
  // ValidatorPublicKeys,
  WorkReport,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

// IWorkReportService interface for dependency injection
export interface IWorkReportService {
  storeGuaranteedWorkReport(
    workReport: WorkReport,
    state: string,
  ): Promise<[Error | null, string | null]>
}

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
  // private readonly workReports: Map<string, GuaranteedWorkReport> = new Map()
  // private readonly workReportService: IWorkReportService
  // private readonly validatorKeys: Map<number, ValidatorPublicKeys>
  // private readonly coreAssignments: Map<number, number>
  private readonly eventBusService: EventBusService

  constructor(eventBusService: EventBusService) {
    super()
    this.eventBusService = eventBusService
    // this.validatorKeys = validatorKeys
    // this.coreAssignments = coreAssignments

    // Initialize event handlers using the base class method
    this.initializeEventHandlers()
  }

  /**
   * Process work report distribution
   *
   * Gray Paper: reporting_assurance.tex (Equations 260-268)
   *
   * Steps:
   * 1. Calculate work report hash
   * 2. Validate guarantee signatures (2-3 signatures, correct validators, valid crypto)
   * 3. Store work report in both WorkStore and WorkReportHolderService
   * 4. Associate work report with slot
   */
  async processRequest(
    request: GuaranteedWorkReport,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    logger.info('[CE135] Processing work report distribution request', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      slot: request.slot.toString(),
      signaturesCount: request.signatures.length,
    })

    // Emit JIP-3 receiving guarantee event (JIP-3: 110)
    // This should be emitted by the recipient when a guarantor begins sending a work-report guarantee
    const eventId = await this.eventBusService.emitReceivingGuarantee(
      hexToBytes(peerPublicKey),
    )

    // Create GuaranteeOutline from GuaranteedWorkReport
    // Calculate work report hash
    const [encodeError, encodedWorkReport] = encodeWorkReport(
      request.workReport,
    )
    if (encodeError) {
      // If encoding fails, skip JIP-3 event but still process the request
      this.eventBusService.emitWorkReportDistributionRequest(
        request,
        peerPublicKey,
      )
      return safeResult(undefined)
    }

    const [hashError, workReportHash] = blake2bHash(encodedWorkReport)
    if (hashError) {
      // If hashing fails, skip JIP-3 event but still process the request
      this.eventBusService.emitWorkReportDistributionRequest(
        request,
        peerPublicKey,
      )
      return safeResult(undefined)
    }

    // Extract guarantor indices from signatures
    const guarantors = request.signatures.map((sig) => sig.validatorIndex)

    // Create guarantee outline
    const guaranteeOutline: GuaranteeOutline = {
      workReportHash: hexToBytes(workReportHash),
      slot: request.slot,
      guarantors,
    }

    // Emit JIP-3 guarantee received event (JIP-3: 112)
    await this.eventBusService.emitGuaranteeReceived(eventId, guaranteeOutline)

    // Legacy event for backwards compatibility
    this.eventBusService.emitWorkReportDistributionRequest(
      request,
      peerPublicKey,
    )

    return safeResult(undefined)
  }

  async processResponse(
    _response: undefined,
    _peerPublicKey: Hex,
  ): SafePromise<void> {
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
}
