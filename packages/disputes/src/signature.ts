import { type Hex, hexToBytes, verifySignature } from '@pbnjam/core'
import type {
  Culprit,
  IConfigService,
  IValidatorSetManager,
  Judgment,
  Safe,
  Verdict,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'

/**
 * Validate verdicts according to Gray Paper specifications
 *
 * Gray Paper equation (47-51):
 * k = activeset when epochindex = thetime/Cepochlen, otherwise previousset
 *
 * @param verdicts Array of verdicts to validate
 * @param validatorSetManagerService Validator set manager service
 * @param configService Configuration service
 * @param currentTimeslot Current timeslot (tau) - required for age validation
 * @returns Validation result
 */
export function validateVerdicts(
  verdicts: Verdict[],
  validatorSetManagerService: IValidatorSetManager,
  configService: IConfigService,
  currentTimeslot: bigint,
): Safe<void> {
  // Calculate current epoch from timeslot
  // Gray Paper: epoch = floor(tau / Cepochlen)
  const currentEpoch = currentTimeslot / BigInt(configService.epochDuration)

  for (const verdict of verdicts) {
    // Validate that verdict has at least 2/3 + 1 judgments
    const requiredJudgments =
      Math.floor((2 * configService.numValidators) / 3) + 1
    if (verdict.votes.length < requiredJudgments) {
      return safeError(
        new Error(
          `verdict has insufficient judgments: ${verdict.votes.length} < ${requiredJudgments}`,
        ),
      )
    }

    // Validate verdict age according to Gray Paper
    // Gray Paper line 44: verdict age must be either the epoch index of the prior state
    // or one less (currentEpoch or currentEpoch - 1)
    const verdictAge = BigInt(verdict.age)
    const allowedAges = [currentEpoch, currentEpoch - 1n]
    if (!allowedAges.includes(verdictAge)) {
      return safeError(new Error('bad_judgement_age'))
    }

    // Determine which validator set to use based on verdict age
    // Gray Paper: k = activeset when epochindex = thetime/Cepochlen, otherwise previousset
    const useActiveSet = verdictAge === currentEpoch

    // Validate each judgment in the verdict
    for (const judgment of verdict.votes) {
      const [error] = validateJudgmentSignature(
        judgment,
        verdict.target,
        validatorSetManagerService,
        useActiveSet,
      )
      if (error) {
        return safeError(error)
      }
    }
  }

  return safeResult(undefined)
}

/**
 * Validate judgment signature according to Gray Paper specifications
 *
 * Gray Paper equation (47-51):
 * XVJ_signature ∈ edsignature{𝐤[XVJ_judgeindex]_vk_ed}{𝖷_v || XV_reporthash}
 * where 𝖷_valid ≡ "$jam_valid", 𝖷_invalid ≡ "$jam_invalid"
 * and k = activeset when epochindex = thetime/Cepochlen, otherwise previousset
 *
 * @param judgment The judgment to validate
 * @param reportHash The work report hash being judged
 * @param validatorSetManagerService Validator set manager service
 * @param useActiveSet Whether to use active set (true) or previous set (false)
 * @returns Validation result
 */
export function validateJudgmentSignature(
  judgment: Judgment,
  reportHash: Hex,
  validatorSetManagerService: IValidatorSetManager,
  useActiveSet: boolean,
): Safe<void> {
  // Step 1: Get validator's Ed25519 public key from the correct set
  // Gray Paper: k = activeset when epochindex = thetime/Cepochlen, otherwise previousset
  let validatorFound = false
  let publicKeys: { ed25519: Hex } | null = null

  if (useActiveSet) {
    // Check active set (kappa) only
    const activeValidators = validatorSetManagerService.getActiveValidators()
    const validatorFromActive = activeValidators.get(Number(judgment.index))
    if (validatorFromActive) {
      validatorFound = true
      publicKeys = validatorFromActive
    }
  } else {
    // Check previous set (lambda) only
    const previousValidators =
      validatorSetManagerService.getPreviousValidators()
    const validatorFromPrevious = previousValidators.get(Number(judgment.index))
    if (validatorFromPrevious) {
      validatorFound = true
      publicKeys = validatorFromPrevious
    }
  }

  if (!validatorFound || !publicKeys) {
    return safeError(
      new Error(`failed to get validator at index ${judgment.index}`),
    )
  }

  // Step 2: Construct the message according to Gray Paper
  // Message = "$jam_valid" || report_hash OR "$jam_invalid" || report_hash
  const contextString = judgment.vote ? 'jam_valid' : 'jam_invalid'
  const contextBytes = new TextEncoder().encode(contextString)
  const reportHashBytes = hexToBytes(reportHash)
  const message = new Uint8Array(contextBytes.length + reportHashBytes.length)
  message.set(contextBytes, 0)
  message.set(reportHashBytes, contextBytes.length)

  // Step 3: Verify the Ed25519 signature
  const publicKey = publicKeys.ed25519
  const signatureBytes = hexToBytes(judgment.signature)
  const isValid = verifySignature(
    hexToBytes(publicKey),
    message,
    signatureBytes,
  )

  if (!isValid) {
    return safeError(new Error(`bad_signature`))
  }

  return safeResult(undefined)
}

/**
 * Validate fault signature according to Gray Paper specifications
 *
 * Gray Paper equation (63-66):
 * s ∈ edsignature{xf_offenderindex}{X_v || xf_reporthash}
 * where X_valid ≡ "$jam_valid", X_invalid ≡ "$jam_invalid"
 *
 * The fault key must be in the validator set (current or previous epoch, excluding offenders)
 *
 * @param fault The fault to validate
 * @param validatorSetManagerService Validator set manager service
 * @returns Validation result
 */
export function validateFaultSignature(
  fault: { target: Hex; vote: boolean; key: Hex; signature: Hex },
  validatorSetManagerService: IValidatorSetManager,
): Safe<void> {
  // Step 1: Check if fault.key is in validator set (current or previous epoch, excluding offenders)
  // Gray Paper: k ∈ k where k = {i_vk_ed | i ∈ previousset ∪ activeset} \ offenders
  // We need to check both activeSet and previousSet (kappa and lambda)
  // Try active set first, then previous set
  let keyFound = false
  let validatorIndex: number | null = null

  // Check active set (kappa)
  const activeValidators = validatorSetManagerService.getActiveValidators()
  for (const [index, validator] of activeValidators) {
    if (validator.ed25519 === fault.key) {
      keyFound = true
      validatorIndex = index
      break
    }
  }

  // If not found in active set, check previous set (lambda)
  if (!keyFound) {
    const previousValidators =
      validatorSetManagerService.getPreviousValidators()
    for (const [index, validator] of previousValidators) {
      if (validator.ed25519 === fault.key) {
        keyFound = true
        validatorIndex = index
        break
      }
    }
  }

  if (!keyFound || validatorIndex === null) {
    // Key not found in validator set - return bad_auditor_key error
    return safeError(new Error('bad_auditor_key'))
  }

  // Note: Excluding offenders check should be done by the caller
  // when checking if the key should be marked as offender

  // Step 2: Construct the message according to Gray Paper
  // Message = "$jam_valid" || reprothash OR "$jam_invalid" || reprothash
  // Based on fault.vote (validity) - X_v
  const contextString = fault.vote ? 'jam_valid' : 'jam_invalid'
  const contextBytes = new TextEncoder().encode(contextString)
  const reportHashBytes = hexToBytes(fault.target)
  const message = new Uint8Array(contextBytes.length + reportHashBytes.length)
  message.set(contextBytes, 0)
  message.set(reportHashBytes, contextBytes.length)

  // Step 3: Verify the Ed25519 signature using fault.key as public key
  // Gray Paper: s ∈ edsignature{offenderindex}{X_v || reprothash}
  const signatureBytes = hexToBytes(fault.signature)
  const isValid = verifySignature(
    hexToBytes(fault.key),
    message,
    signatureBytes,
  )

  if (!isValid) {
    return safeError(new Error(`bad_signature`))
  }

  return safeResult(undefined)
}

/**
 * Validate culprit signature according to Gray Paper specifications
 *
 * Gray Paper equation (58-61):
 * signature ∈ edsignature{offenderindex}{Xguarantee || reprothash}
 * where Xguarantee ≡ "$jam_guarantee"
 *
 * The culprit key must be in the validator set (current or previous epoch, excluding offenders)
 *
 * @param culprit The culprit to validate
 * @param validatorSetManagerService Validator set manager service
 * @returns Validation result
 */
export function validateCulpritSignature(
  culprit: Culprit,
  validatorSetManagerService: IValidatorSetManager,
): Safe<void> {
  // Step 1: Check if culprit.key is in validator set (current or previous epoch, excluding offenders)
  // Gray Paper: offenderindex ∈ k where k = {i_vk_ed | i ∈ previousset ∪ activeset} \ offenders
  // We need to check both activeSet and previousSet (kappa and lambda)
  // Try active set first, then previous set
  let keyFound = false
  let validatorIndex: number | null = null

  // Check active set (kappa)
  const activeValidators = validatorSetManagerService.getActiveValidators()
  for (const [index, validator] of activeValidators) {
    if (validator.ed25519 === culprit.key) {
      keyFound = true
      validatorIndex = index
      break
    }
  }

  // If not found in active set, check previous set (lambda)
  if (!keyFound) {
    const previousValidators =
      validatorSetManagerService.getPreviousValidators()
    for (const [index, validator] of previousValidators) {
      if (validator.ed25519 === culprit.key) {
        keyFound = true
        validatorIndex = index
        break
      }
    }
  }

  if (!keyFound || validatorIndex === null) {
    // Key not found in validator set - return bad_guarantor_key error
    return safeError(new Error('bad_guarantor_key'))
  }

  // Step 2: Construct the message according to Gray Paper
  // Message = "$jam_guarantee" || reprothash
  // Note: For culprits, we use reprothash directly (not BLAKE2b hashed)
  const contextString = 'jam_guarantee'
  const contextBytes = new TextEncoder().encode(contextString)
  const reportHashBytes = hexToBytes(culprit.target)
  const message = new Uint8Array(contextBytes.length + reportHashBytes.length)
  message.set(contextBytes, 0)
  message.set(reportHashBytes, contextBytes.length)

  // Step 3: Verify the Ed25519 signature using culprit.key as public key
  // Gray Paper: signature ∈ edsignature{offenderindex}{Xguarantee || reprothash}
  const signatureBytes = hexToBytes(culprit.signature)
  const isValid = verifySignature(
    hexToBytes(culprit.key),
    message,
    signatureBytes,
  )

  if (!isValid) {
    // Signature is invalid - return bad_signature error
    return safeError(new Error('bad_signature'))
  }

  return safeResult(undefined)
}
