/**
 * Audit Signature Generation and Verification
 *
 * Implements Gray Paper auditing.tex equations for audit evidence generation:
 *
 * For Initial Tranche (n=0):
 * s_0 ∈ bssignature{activeset[v]_bs}{Xaudit ∥ banderout{H_vrfsig}}{∅}
 *
 * For Subsequent Tranches (n>0):
 * s_n(w) ∈ bssignature{activeset[v]_bs}{Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n}{∅}
 *
 * ============================================================================
 * GRAY PAPER SPECIFICATION:
 * ============================================================================
 *
 * Gray Paper auditing.tex equations 54-62 (tranche 0):
 * s_0 ∈ bssignature{activeset[v]_vk_bs}{Xaudit ∥ banderout{H_vrfsig}}{[]}
 * where Xaudit = token("$jam_audit")
 *
 * Gray Paper auditing.tex equation 105 (tranche N > 0):
 * s_n(w) ∈ bssignature{activeset[v]_vk_bs}{Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n}{[]}
 *
 * Gray Paper bandersnatch.tex line 5:
 * The singly-contextualized Bandersnatch Schnorr-like signatures bssignature{k}{c}{m}
 * are defined as a formulation under the IETF VRF template
 *
 * Gray Paper bandersnatch.tex line 8:
 * bssignature{k ∈ bskey}{c ∈ hash}{m ∈ blob} ⊂ blob[96]
 * banderout{s ∈ bssignature{k}{c}{m}} ∈ hash ≡ text{output}(x | x ∈ bssignature{k}{c}{m})[:32]
 *
 * ============================================================================
 * IMPLEMENTATION NOTES:
 * ============================================================================
 *
 * 1. IETF VRF provides deterministic, verifiable randomness for audit selection
 * 2. Context varies by tranche:
 *    - Tranche 0: Xaudit ∥ banderout{H_vrfsig}
 *    - Tranche N: Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n
 * 3. Message: [] (empty blob - no message data)
 * 4. Output: 96-byte IETF VRF signature
 * 5. VRF output: 32-byte hash for audit selection
 *
 * @fileoverview Audit signature generation and verification using IETF VRF on Bandersnatch curve
 */

import {
  getBanderoutFromGamma,
  IETFVRFProver,
  IETFVRFVerifier,
} from '@pbnj/bandersnatch-vrf'
import {
  blake2bHash,
  logger,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import { encodeWorkReport } from '@pbnj/serialization'
import type { WorkReport } from '@pbnj/types'

/**
 * Gray Paper hardcoded context string for audit VRF
 * Gray Paper auditing.tex: Xaudit = token("$jam_audit")
 */
const XAUDIT = new TextEncoder().encode('$jam_audit')

/**
 * Audit signature result
 */
export interface AuditSignatureResult {
  /** 96-byte IETF VRF signature */
  signature: Uint8Array
  /** 32-byte VRF output hash */
  banderoutResult: Uint8Array
}

/**
 * Generate audit signature for tranche 0 according to Gray Paper equations 54-62
 *
 * Implements Gray Paper auditing.tex equations 54-62:
 * s_0 ∈ bssignature{activeset[v]_vk_bs}{Xaudit ∥ banderout{H_vrfsig}}{[]}
 *
 * This generates a deterministic, verifiable signature that provides:
 * 1. Proof of validator's right to audit work-reports in tranche 0
 * 2. Verifiable random selection based on block header VRF output
 * 3. Unbiasable randomness derived from the block header
 *
 * @param validatorSecretKey - Validator's Bandersnatch secret key (32 bytes)
 * @param blockHeaderVrfOutput - VRF output from block header (32 bytes from banderout{H_vrfsig})
 * @returns IETF VRF signature (96 bytes) and VRF output hash (32 bytes)
 */
export function generateTranche0AuditSignature(
  validatorSecretKey: Uint8Array,
  blockHeaderVrfOutput: Uint8Array,
): Safe<AuditSignatureResult> {
  // Validate inputs
  if (validatorSecretKey.length !== 32) {
    return safeError(new Error('Validator secret key must be 32 bytes'))
  }

  if (blockHeaderVrfOutput.length !== 32) {
    return safeError(new Error('Block header VRF output must be 32 bytes'))
  }

  // Build VRF context according to Gray Paper equations 54-62:
  // context = Xaudit ∥ banderout{H_vrfsig}
  const context = new Uint8Array(XAUDIT.length + blockHeaderVrfOutput.length)
  let offset = 0
  context.set(XAUDIT, offset)
  offset += XAUDIT.length
  context.set(blockHeaderVrfOutput, offset)

  // Generate IETF VRF signature using IETFVRFProver
  // Gray Paper equations 54-62: bssignature{k}{c}{m} where:
  // k = validatorSecretKey, c = context, m = [] (empty message)
  // NOTE: IETFVRFProver.prove parameter order is (secretKey, input, auxData)
  // where input = message and auxData = context per IETF VRF specification
  const vrfResult = IETFVRFProver.prove(
    validatorSecretKey,
    context, // Xaudit ∥ banderout{H_vrfsig} (input)
    new Uint8Array(0), // [] (empty auxData)
  )

  // Verify the signature is the correct length (96 bytes per Gray Paper)
  if (vrfResult.proof.length !== 96) {
    logger.warn('IETF VRF signature has unexpected length', {
      expected: 96,
      actual: vrfResult.proof.length,
    })
  }

  // Extract banderout result: first 32 bytes of VRF output hash
  // Gray Paper: banderout{s ∈ bssignature{k}{c}{m}} ∈ hash ≡ text{output}(x | x ∈ bssignature{k}{c}{m})[:32]
  const banderoutResult = getBanderoutFromGamma(vrfResult.gamma)

  return safeResult({
    signature: vrfResult.proof,
    banderoutResult,
  })
}

/**
 * Generate audit signature for tranche N according to Gray Paper equation 105
 *
 * Implements Gray Paper auditing.tex equation 105:
 * s_n(w) ∈ bssignature{activeset[v]_vk_bs}{Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n}{[]}
 *
 * This generates a deterministic, verifiable signature that provides:
 * 1. Proof of validator's right to audit specific work-reports in tranche N
 * 2. Verifiable random selection based on block header VRF output and work-report hash
 * 3. Unbiasable randomness derived from multiple sources
 *
 * @param validatorSecretKey - Validator's Bandersnatch secret key (32 bytes)
 * @param blockHeaderVrfOutput - VRF output from block header (32 bytes from banderout{H_vrfsig})
 * @param workReport - Work report to audit
 * @param trancheNumber - Tranche number (n)
 * @returns IETF VRF signature (96 bytes) and VRF output hash (32 bytes)
 */
export function generateTrancheNAuditSignature(
  validatorSecretKey: Uint8Array,
  blockHeaderVrfOutput: Uint8Array,
  workReport: WorkReport,
  trancheNumber: bigint,
): Safe<AuditSignatureResult> {
  // Validate inputs
  if (validatorSecretKey.length !== 32) {
    return safeError(new Error('Validator secret key must be 32 bytes'))
  }

  if (blockHeaderVrfOutput.length !== 32) {
    return safeError(new Error('Block header VRF output must be 32 bytes'))
  }

  // Calculate Blake2b hash of work report (blake{w})
  const [encodeError, encodedWorkReport] = encodeWorkReport(workReport)
  if (encodeError) {
    return safeError(encodeError)
  }

  const [hashError, workReportHash] = blake2bHash(encodedWorkReport)
  if (hashError) {
    return safeError(hashError)
  }

  // Convert hex hash to bytes
  const workReportHashBytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    workReportHashBytes[i] = Number.parseInt(
      workReportHash.slice(2 + i * 2, 4 + i * 2),
      16,
    )
  }

  // Convert tranche number to bytes (8 bytes, little-endian)
  const trancheBytes = new Uint8Array(8)
  new DataView(trancheBytes.buffer).setBigUint64(0, trancheNumber, true)

  // Build VRF context according to Gray Paper equation 105:
  // context = Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n
  const context = new Uint8Array(
    XAUDIT.length +
      blockHeaderVrfOutput.length +
      workReportHashBytes.length +
      trancheBytes.length,
  )
  let offset = 0
  context.set(XAUDIT, offset)
  offset += XAUDIT.length
  context.set(blockHeaderVrfOutput, offset)
  offset += blockHeaderVrfOutput.length
  context.set(workReportHashBytes, offset)
  offset += workReportHashBytes.length
  context.set(trancheBytes, offset)

  // Generate IETF VRF signature using IETFVRFProver
  // Gray Paper equation 105: bssignature{k}{c}{m} where:
  // k = validatorSecretKey, c = context, m = [] (empty message)
  const vrfResult = IETFVRFProver.prove(
    validatorSecretKey,
    context, // Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n (input)
    new Uint8Array(0), // [] (empty auxData)
  )

  // Verify the signature is the correct length (96 bytes per Gray Paper)
  if (vrfResult.proof.length !== 96) {
    logger.warn('IETF VRF signature has unexpected length', {
      expected: 96,
      actual: vrfResult.proof.length,
    })
  }

  // Extract banderout result: first 32 bytes of VRF output hash
  const banderoutResult = getBanderoutFromGamma(vrfResult.gamma)

  return safeResult({
    signature: vrfResult.proof,
    banderoutResult,
  })
}

/**
 * Verify audit signature for tranche 0 according to Gray Paper equations 54-62
 *
 * @param validatorPublicKey - Validator's Bandersnatch public key (32 bytes)
 * @param signature - IETF VRF signature to verify (96 bytes)
 * @param blockHeaderVrfOutput - VRF output from block header (32 bytes from banderout{H_vrfsig})
 * @returns True if signature is valid, false otherwise
 */
export function verifyTranche0AuditSignature(
  validatorPublicKey: Uint8Array,
  signature: Uint8Array,
  blockHeaderVrfOutput: Uint8Array,
): Safe<boolean> {
  // Validate inputs
  if (validatorPublicKey.length !== 32) {
    return safeError(new Error('Validator public key must be 32 bytes'))
  }

  if (signature.length !== 96) {
    return safeError(new Error('IETF VRF signature must be 96 bytes'))
  }

  if (blockHeaderVrfOutput.length !== 32) {
    return safeError(new Error('Block header VRF output must be 32 bytes'))
  }

  // Build VRF context according to Gray Paper equations 54-62:
  // context = Xaudit ∥ banderout{H_vrfsig}
  const context = new Uint8Array(XAUDIT.length + blockHeaderVrfOutput.length)
  let offset = 0
  context.set(XAUDIT, offset)
  offset += XAUDIT.length
  context.set(blockHeaderVrfOutput, offset)

  // Verify IETF VRF signature using IETFVRFVerifier
  // Gray Paper equations 54-62: bssignature{k}{c}{m} where:
  // k = validatorPublicKey, c = context, m = [] (empty message)
  const isValid = IETFVRFVerifier.verify(
    validatorPublicKey,
    context, // Xaudit ∥ banderout{H_vrfsig} (input)
    signature,
    new Uint8Array(0), // [] (empty auxData)
  )

  return safeResult(isValid)
}

/**
 * Verify audit signature for tranche N according to Gray Paper equation 105
 *
 * @param validatorPublicKey - Validator's Bandersnatch public key (32 bytes)
 * @param signature - IETF VRF signature to verify (96 bytes)
 * @param blockHeaderVrfOutput - VRF output from block header (32 bytes from banderout{H_vrfsig})
 * @param workReport - Work report that was audited
 * @param trancheNumber - Tranche number (n)
 * @returns True if signature is valid, false otherwise
 */
export function verifyTrancheNAuditSignature(
  validatorPublicKey: Uint8Array,
  signature: Uint8Array,
  blockHeaderVrfOutput: Uint8Array,
  workReport: WorkReport,
  trancheNumber: bigint,
): Safe<boolean> {
  // Validate inputs
  if (validatorPublicKey.length !== 32) {
    return safeError(new Error('Validator public key must be 32 bytes'))
  }

  if (signature.length !== 96) {
    return safeError(new Error('IETF VRF signature must be 96 bytes'))
  }

  if (blockHeaderVrfOutput.length !== 32) {
    return safeError(new Error('Block header VRF output must be 32 bytes'))
  }

  // Calculate Blake2b hash of work report (blake{w})
  const [encodeError, encodedWorkReport] = encodeWorkReport(workReport)
  if (encodeError) {
    return safeError(encodeError)
  }

  const [hashError, workReportHash] = blake2bHash(encodedWorkReport)
  if (hashError) {
    return safeError(hashError)
  }

  // Convert hex hash to bytes
  const workReportHashBytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    workReportHashBytes[i] = Number.parseInt(
      workReportHash.slice(2 + i * 2, 4 + i * 2),
      16,
    )
  }

  // Convert tranche number to bytes (8 bytes, little-endian)
  const trancheBytes = new Uint8Array(8)
  new DataView(trancheBytes.buffer).setBigUint64(0, trancheNumber, true)

  // Build VRF context according to Gray Paper equation 105:
  // context = Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n
  const context = new Uint8Array(
    XAUDIT.length +
      blockHeaderVrfOutput.length +
      workReportHashBytes.length +
      trancheBytes.length,
  )
  let offset = 0
  context.set(XAUDIT, offset)
  offset += XAUDIT.length
  context.set(blockHeaderVrfOutput, offset)
  offset += blockHeaderVrfOutput.length
  context.set(workReportHashBytes, offset)
  offset += workReportHashBytes.length
  context.set(trancheBytes, offset)

  // Verify IETF VRF signature using IETFVRFVerifier
  // Gray Paper equation 105: bssignature{k}{c}{m} where:
  // k = validatorPublicKey, c = context, m = [] (empty message)
  const isValid = IETFVRFVerifier.verify(
    validatorPublicKey,
    context, // Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n (input)
    signature,
    new Uint8Array(0), // [] (empty auxData)
  )

  return safeResult(isValid)
}

/**
 * Generate audit signature for any tranche (convenience function)
 *
 * Automatically determines whether to use tranche 0 or tranche N logic based on tranche number.
 *
 * @param validatorSecretKey - Validator's Bandersnatch secret key (32 bytes)
 * @param blockHeaderVrfOutput - VRF output from block header (32 bytes from banderout{H_vrfsig})
 * @param trancheNumber - Tranche number (0 for initial tranche, >0 for subsequent tranches)
 * @param workReport - Work report to audit (required for tranche N > 0)
 * @returns IETF VRF signature (96 bytes) and VRF output hash (32 bytes)
 */
export function generateAuditSignature(
  validatorSecretKey: Uint8Array,
  blockHeaderVrfOutput: Uint8Array,
  trancheNumber: bigint,
  workReport?: WorkReport,
): Safe<AuditSignatureResult> {
  if (trancheNumber === 0n) {
    // Use tranche 0 logic
    return generateTranche0AuditSignature(
      validatorSecretKey,
      blockHeaderVrfOutput,
    )
  } else {
    // Use tranche N logic
    if (!workReport) {
      return safeError(new Error('Work report is required for tranche N > 0'))
    }
    return generateTrancheNAuditSignature(
      validatorSecretKey,
      blockHeaderVrfOutput,
      workReport,
      trancheNumber,
    )
  }
}

/**
 * Verify audit signature for any tranche (convenience function)
 *
 * Automatically determines whether to use tranche 0 or tranche N logic based on tranche number.
 *
 * @param validatorPublicKey - Validator's Bandersnatch public key (32 bytes)
 * @param signature - IETF VRF signature to verify (96 bytes)
 * @param blockHeaderVrfOutput - VRF output from block header (32 bytes from banderout{H_vrfsig})
 * @param trancheNumber - Tranche number (0 for initial tranche, >0 for subsequent tranches)
 * @param workReport - Work report that was audited (required for tranche N > 0)
 * @returns True if signature is valid, false otherwise
 */
export function verifyAuditSignature(
  validatorPublicKey: Uint8Array,
  signature: Uint8Array,
  blockHeaderVrfOutput: Uint8Array,
  trancheNumber: bigint,
  workReport?: WorkReport,
): Safe<boolean> {
  if (trancheNumber === 0n) {
    // Use tranche 0 logic
    return verifyTranche0AuditSignature(
      validatorPublicKey,
      signature,
      blockHeaderVrfOutput,
    )
  } else {
    // Use tranche N logic
    if (!workReport) {
      return safeError(new Error('Work report is required for tranche N > 0'))
    }
    return verifyTrancheNAuditSignature(
      validatorPublicKey,
      signature,
      blockHeaderVrfOutput,
      workReport,
      trancheNumber,
    )
  }
}
