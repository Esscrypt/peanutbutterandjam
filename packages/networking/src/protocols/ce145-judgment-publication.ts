/**
 * CE 145: Judgment Publication Protocol
 *
 * Implements the judgment publication protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for publishing audit judgments.
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
  decodeFixedLength,
  decodeNatural,
  encodeFixedLength,
  encodeNatural,
} from '@pbnj/serialization'
import type { JudgmentStore } from '@pbnj/state'
import type { Judgment, JudgmentPublicationRequest } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'
/**
 * Judgment publication protocol handler
 */
export class JudgmentPublicationProtocol extends NetworkingProtocol<
  JudgmentPublicationRequest,
  void
> {
  private judgments: Map<string, JudgmentPublicationRequest> = new Map()
  private judgmentStore: JudgmentStore
  constructor(judgmentStore: JudgmentStore) {
    super()
    this.judgmentStore = judgmentStore
  }

  /**
   * Store judgment in local store and persist to database
   */
  async storeJudgment(
    epochIndex: bigint,
    validatorIndex: bigint,
    validity: 0 | 1,
    workReportHash: Hex,
    signature: Hex,
  ): Promise<void> {
    const key = `${epochIndex}_${validatorIndex}_${workReportHash.toString()}`
    this.judgments.set(key, {
      epochIndex,
      validatorIndex,
      validity,
      workReportHash,
      signature,
    })

    // Store judgment data
    const judgmentData: Judgment = {
      judgeIndex: validatorIndex,
      validity: validity !== 0,
      signature,
    }

    await this.judgmentStore.storeJudgment(
      judgmentData,
      epochIndex,
      workReportHash,
    )
  }

  /**
   * Get judgment from local store
   */
  getJudgment(
    epochIndex: bigint,
    validatorIndex: bigint,
    workReportHash: Hex,
  ): JudgmentPublicationRequest | undefined {
    const key = `${epochIndex}_${validatorIndex}_${workReportHash.toString()}`
    return this.judgments.get(key)
  }

  /**
   * Get judgment from database if not in local store
   */
  async getJudgmentFromDatabase(
    epochIndex: bigint,
    workReportHash: Hex,
  ): SafePromise<Judgment> {
    const [error, judgment] = await this.judgmentStore.getJudgment(
      epochIndex,
      workReportHash,
    )
    if (error) {
      return safeError(error)
    }
    if (!judgment) {
      return safeError(new Error('Judgment not found'))
    }
    return safeResult({
      judgeIndex: judgment.judgeIndex,
      validity: judgment.validity,
      signature: judgment.signature,
    })
  }

  /**
   * Process judgment publication
   */
  async processRequest(
    judgmentPublication: JudgmentPublicationRequest,
  ): SafePromise<void> {
    const existingJudgment = this.getJudgment(
      judgmentPublication.epochIndex,
      judgmentPublication.validatorIndex,
      judgmentPublication.workReportHash,
    )
    if (existingJudgment) {
      return safeResult(undefined)
    }

    // Store the judgment
    await this.storeJudgment(
      judgmentPublication.epochIndex,
      judgmentPublication.validatorIndex,
      judgmentPublication.validity,
      judgmentPublication.workReportHash,
      judgmentPublication.signature,
    )

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
    currentData = currentData.slice(32)
    return safeResult({
      epochIndex: epochIndex,
      validatorIndex: validatorIndex,
      validity: validity === 0n ? 0 : 1,
      workReportHash: workReportHash,
      signature: signature,
    })
  }

  //TODO: double check if this is correct
  serializeResponse(_judgment: undefined): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  //TODO: double check if this is correct
  deserializeResponse(_data: Uint8Array): Safe<void> {
    return safeResult(undefined)
  }

  async processResponse(_response: undefined): SafePromise<void> {
    return safeResult(undefined)
  }
}
