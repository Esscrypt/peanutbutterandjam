/**
 * CE 145: Judgment Publication Protocol
 *
 * Implements the judgment publication protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for publishing audit judgments.
 */

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnj/core'
import {
  decodeFixedLength,
  decodeNatural,
  encodeFixedLength,
  encodeNatural,
} from '@pbnj/serialization'
import type {
  IJudgmentHolderService,
  JudgmentPublicationRequest,
  Safe,
  SafePromise,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'
/**
 * Judgment publication protocol handler
 */
export class JudgmentPublicationProtocol extends NetworkingProtocol<
  JudgmentPublicationRequest,
  void
> {
  private readonly judgmentHolderService: IJudgmentHolderService
  constructor(judgmentHolderService: IJudgmentHolderService) {
    super()
    this.judgmentHolderService = judgmentHolderService

    // Initialize event handlers using the base class method
    this.initializeEventHandlers()
  }

  /**
   * Process judgment publication
   */
  async processRequest(
    judgmentPublication: JudgmentPublicationRequest,
    _peerPublicKey: Hex,
  ): SafePromise<void> {
    const [error, _result] = await this.judgmentHolderService.addJudgement(
      {
        vote: judgmentPublication.validity !== 0,
        index: judgmentPublication.validatorIndex,
        signature: judgmentPublication.signature,
      },
      judgmentPublication.epochIndex,
      judgmentPublication.workReportHash,
    )
    if (error) {
      return safeError(error)
    }
    return safeResult(undefined)
  }

  /**
   * Serialize judgment publication message
   */
  serializeRequest(judgment: JudgmentPublicationRequest): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const parts: Uint8Array[] = []

    const [error, encodedEpochIndex] = encodeFixedLength(
      judgment.epochIndex,
      4n,
    )
    if (error) {
      return safeError(error)
    }
    parts.push(encodedEpochIndex)

    const [error2, encodedValidatorIndex] = encodeFixedLength(
      judgment.validatorIndex,
      4n,
    )
    if (error2) {
      return safeError(error2)
    }
    parts.push(encodedValidatorIndex)

    const [error3, encodedValidity] = encodeNatural(BigInt(judgment.validity))
    if (error3) {
      return safeError(error3)
    }
    parts.push(encodedValidity)

    parts.push(hexToBytes(judgment.workReportHash))
    parts.push(hexToBytes(judgment.signature))

    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize judgment publication message
   */
  deserializeRequest(data: Uint8Array): Safe<JudgmentPublicationRequest> {
    let currentData = data
    const [error, epochIndexResult] = decodeFixedLength(currentData, 4n)
    if (error) {
      return safeError(error)
    }
    currentData = epochIndexResult.remaining
    const epochIndex = epochIndexResult.value
    const [error2, validatorIndexResult] = decodeFixedLength(currentData, 4n)
    if (error2) {
      return safeError(error2)
    }
    currentData = validatorIndexResult.remaining
    const validatorIndex = validatorIndexResult.value
    const [error3, validityResult] = decodeNatural(currentData)
    if (error3) {
      return safeError(error3)
    }
    currentData = validityResult.remaining
    const validity = validityResult.value
    const workReportHash = bytesToHex(currentData.slice(0, 32))
    currentData = currentData.slice(32)
    const signature = bytesToHex(currentData.slice(0, 32))
    return safeResult({
      epochIndex: epochIndex,
      validatorIndex: validatorIndex,
      validity: validity === 0n ? 0 : 1,
      workReportHash: workReportHash,
      signature: signature,
    })
  }

  serializeResponse(_judgment: undefined): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  deserializeResponse(_data: Uint8Array): Safe<void> {
    return safeResult(undefined)
  }

  async processResponse(_response: undefined): SafePromise<void> {
    return safeResult(undefined)
  }
}
