/**
 * Guarantor Signature Operations
 *
 * Gray Paper Reference: guaranteeing.tex (Equations 22-25)
 *
 * Implements signature creation and validation for work-report guarantees.
 *
 * Signature Process:
 * 1. Serialize work-report: encode(r)
 * 2. Hash serialized report: l = blake(encode(r))
 * 3. Sign hash with Ed25519: s = sign(l, edkey)
 *
 * Verification Process:
 * 1. Serialize work-report: encode(r)
 * 2. Hash serialized report: l = blake(encode(r))
 * 3. Verify signature: verify(s, l, public_key)
 */

import {
  blake2bHash,
  bytesToHex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
  signEd25519,
  verifySignature,
} from '@pbnj/core'
import { encodeWorkReport } from '@pbnj/serialization'
import type {
  Guarantee,
  GuaranteeSignature,
  IValidatorSetManager,
  WorkReport,
} from '@pbnj/types'

/**
 * Create signature for work-report
 *
 * Gray Paper Reference: guaranteeing.tex (Equations 22-25)
 *
 * Formula:
 * l = blake(encode(r))
 * s = Ed25519_sign(l, validator_edkey)
 *
 * @param workReport - Work-report to sign
 * @param validatorIndex - Index of this validator
 * @param edPrivateKey - Ed25519 private key (32 bytes)
 * @returns Safe<GuaranteeSignature> - Signature tuple (validatorIndex, signature)
 */
export function createGuaranteeSignature(
  workReport: WorkReport,
  validatorIndex: number,
  edPrivateKey: Uint8Array,
): Safe<GuaranteeSignature> {
  try {
    // Step 1: Serialize work-report
    const [encodeError, encoded] = encodeWorkReport(workReport)
    if (encodeError) {
      return safeError(
        new Error(`Failed to encode work-report: ${encodeError.message}`),
      )
    }

    // Step 2: Hash serialized report with BLAKE2b
    const [hashError, reportHash] = blake2bHash(encoded)
    if (hashError) {
      return safeError(
        new Error(`Failed to hash work-report: ${hashError.message}`),
      )
    }

    // Step 3: Sign hash with Ed25519
    const messageBytes = hexToBytes(reportHash)
    const [signatureError, signature] = signEd25519(messageBytes, edPrivateKey)
    if (signatureError) {
      return safeError(signatureError)
    }

    // Step 4: Create signature tuple
    const guaranteeSignature: GuaranteeSignature = {
      validator_index: validatorIndex,
      signature: bytesToHex(signature),
    }

    return safeResult(guaranteeSignature)
  } catch (error) {
    return safeError(
      new Error(
        `Failed to create guarantee signature: ${(error as Error).message}`,
      ),
    )
  }
}

/**
 * Verify a single guarantee signature
 *
 * Gray Paper Reference: reporting_assurance.tex (Equation 267)
 *
 * Verifies that:
 * 1. Signature is valid for the work-report hash
 * 2. Public key matches the validator's registered Ed25519 key
 *
 * @param workReport - Work-report that was signed
 * @param signature - Signature to verify
 * @param validatorPublicKey - Validator's Ed25519 public key
 * @returns Safe<boolean> - True if signature is valid
 */
/**
 * Verify a work report distribution signature
 *
 * Gray Paper Reference: guaranteeing.tex (Equation 24-25)
 *
 * Used for peer-to-peer work report distribution verification
 * Verifies signature on the Blake2b hash of the encoded work report
 *
 * @param workReport - Work-report that was signed
 * @param signature - Signature to verify
 * @param validatorPublicKey - Validator's Ed25519 public key
 * @returns Safe<boolean> - True if signature is valid
 */
export function verifyWorkReportDistributionSignature(
  workReport: WorkReport,
  signature: GuaranteeSignature,
  validatorPublicKey: Uint8Array,
): Safe<boolean> {
  // Step 1: Serialize work-report
  const [encodeError, encoded] = encodeWorkReport(workReport)
  if (encodeError) {
    return safeError(
      new Error(`Failed to encode work-report: ${encodeError.message}`),
    )
  }

  // Step 2: Hash serialized report with BLAKE2b
  const [hashError, reportHash] = blake2bHash(encoded)
  if (hashError) {
    return safeError(
      new Error(`Failed to hash work-report: ${hashError.message}`),
    )
  }

  // Step 3: Verify signature
  const messageBytes = hexToBytes(reportHash)
  const signatureBytes = hexToBytes(signature.signature)

  const isValid = verifySignature(
    validatorPublicKey,
    messageBytes,
    signatureBytes,
  )

  return safeResult(isValid)
}

/**
 * Verify a block extrinsic guarantee signature
 *
 * Gray Paper Reference: reporting_assurance.tex (Equation 267)
 *
 * Verifies that:
 * 1. Signature is valid for the work-report hash
 * 2. Public key matches the validator's registered Ed25519 key
 *
 * @param guarantee - Guarantee to verify
 * @param validatorSetManagerService - Validator set manager service
 * @returns Safe<void> - True if signature is valid
 */
export function verifyBlockExtrinsicGuaranteeSignature(
  guarantee: Guarantee,
  validatorSetManagerService: IValidatorSetManager,
): Safe<void> {
  if (guarantee.signatures.length < 2) {
    return safeError(new Error('guarantee signatures are less than 2'))
  }

  // Construct the correct message according to Gray Paper:
  // s ∈ edsignature{(k_v)_vk_ed}{X_guarantee ∥ blake{xg_workreport}}
  // Where X_guarantee = "$jam_guarantee"

  // Step 1: Serialize the work report
  const [workReportBytesError, workReportBytes] = encodeWorkReport(
    guarantee.report,
  )
  if (workReportBytesError) {
    return safeError(new Error('failed to encode work report'))
  }

  // Step 2: Compute Blake2b hash of the work report
  const [hashError, workReportHash] = blake2bHash(workReportBytes)
  if (hashError) {
    return safeError(new Error('failed to hash work report'))
  }

  // Step 3: Construct the message: "$jam_guarantee" + Blake2b(work_report)
  const contextString = 'jam_guarantee'
  const contextBytes = new TextEncoder().encode(contextString)
  const hashBytes = hexToBytes(workReportHash)
  const message = new Uint8Array(contextBytes.length + hashBytes.length)
  message.set(contextBytes, 0)
  message.set(hashBytes, contextBytes.length)

  // Validate each signature according to Gray Paper equation (274)
  for (const signature of guarantee.signatures) {
    const [publicKeyError, publicKeys] =
      validatorSetManagerService.getValidatorAtIndex(
        Number(signature.validator_index),
      )
    if (publicKeyError) {
      return safeError(
        new Error(
          `failed to get validator at index ${signature.validator_index}`,
        ),
      )
    }

    // Step 4: Verify the Ed25519 signature
    const publicKey = publicKeys.ed25519
    const signatureBytes = hexToBytes(signature.signature)
    const isValid = verifySignature(
      hexToBytes(publicKey),
      message,
      signatureBytes,
    )

    if (!isValid) {
      return safeError(new Error('guarantee signature is invalid'))
    }
  }
  return safeResult(undefined)
}

export function sortGuaranteeSignatures(
  signatures: GuaranteeSignature[],
): GuaranteeSignature[] {
  return [...signatures].sort((a, b) => {
    const aIndex = Number(a.validator_index)
    const bIndex = Number(b.validator_index)
    return aIndex - bIndex
  })
}

/**
 * Record that a validator signed a work-report
 *
 * Updates signature history for anti-spam tracking
 *
 * @param validatorIndex - Index of validator
 * @param timeslot - Current timeslot
 * @param signatureHistory - Map of timeslot to set of validator indices who signed
 */
export function recordSignature(
  validatorIndex: number,
  timeslot: bigint,
  signatureHistory: Map<bigint, Set<number>>,
): void {
  let signedInSlot = signatureHistory.get(timeslot)
  if (!signedInSlot) {
    signedInSlot = new Set()
    signatureHistory.set(timeslot, signedInSlot)
  }
  signedInSlot.add(validatorIndex)

  // Clean up old timeslots (keep only last 100)
  if (signatureHistory.size > 100) {
    const oldestTimeslot = Array.from(signatureHistory.keys()).sort((a, b) =>
      Number(a - b),
    )[0]
    signatureHistory.delete(oldestTimeslot)
  }
}
