/**
 * Core Assignment Logic for Guarantors
 *
 * Gray Paper Reference: reporting_assurance.tex (Equations 210-218)
 *
 * Implements the deterministic core assignment algorithm that assigns each validator
 * to exactly one core per timeslot. The assignment uses:
 * - Epochal entropy (entropy_2) for randomization
 * - Fisher-Yates shuffle for fair distribution
 * - Periodic rotation for security and liveness
 *
 * Each core has exactly 3 validators assigned (1023 validators / 341 cores = 3)
 */

import { bytesToHex, jamShuffle } from '@pbnj/core'
import type { IConfigService, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'

/**
 * Calculate assigned core for a validator
 *
 * Gray Paper Algorithm:
 * 1. Create initial core assignments: [floor(C_corecount × i / C_valcount) for i in valindex]
 * 2. Shuffle using Fisher-Yates with entropy_2: fyshuffle(assignments, entropy_2)
 * 3. Calculate rotation: floor((thetime % C_epochlen) / C_rotationperiod)
 * 4. Apply rotation: (core + rotation) % C_corecount
 *
 * Formula:
 * P(e, t) ≡ R(fyshuffle([floor(C_corecount × i / C_valcount) | i ∈ valindex], e),
 *            floor((t % C_epochlen) / C_rotationperiod))
 *
 * @param validatorIndex - Index of the validator in the active set (0 to C_valcount-1)
 * @param entropy2 - Epochal entropy (32 bytes)
 * @param currentSlot - Current timeslot
 * @param config - Configuration parameters
 * @returns Safe<number> - Assigned core index (0 to C_corecount-1)
 */
export function getAssignedCore(
  validatorIndex: number,
  entropy2: Uint8Array,
  currentSlot: bigint,
  configService: IConfigService,
): Safe<number> {
  // Validate inputs
  if (validatorIndex < 0 || validatorIndex >= configService.numValidators) {
    return safeError(
      new Error(
        `Invalid validator index: ${validatorIndex} (must be 0 to ${configService.numValidators - 1})`,
      ),
    )
  }

  if (entropy2.length !== 32) {
    return safeError(
      new Error(
        `Invalid entropy length: ${entropy2.length} (must be 32 bytes)`,
      ),
    )
  }

  // Step 1: Create initial core assignments
  // Gray Paper: [floor(C_corecount × i / C_valcount) for i in valindex]
  const initialAssignments: number[] = []
  for (let i = 0; i < configService.numValidators; i++) {
    const coreIndex = Math.floor(
      (configService.numCores * i) / configService.numValidators,
    )
    initialAssignments.push(coreIndex)
  }

  // Step 2: Shuffle using Fisher-Yates with entropy_2
  // Gray Paper: fyshuffle(assignments, entropy_2)
  const shuffledAssignments = jamShuffle(
    initialAssignments,
    bytesToHex(entropy2),
  )

  // Step 3: Calculate rotation number
  // Gray Paper: floor((thetime % C_epochlen) / C_rotationperiod)
  const timeInEpoch = Number(currentSlot % BigInt(configService.epochDuration))
  const rotationNumber = Math.floor(timeInEpoch / configService.rotationPeriod)

  // Step 4: Apply rotation to shuffled assignment
  // Gray Paper: R(shuffled, rotation) where R(c, n) = [(x + n) mod C_corecount for x in c]
  const assignedCoreBeforeRotation = shuffledAssignments[validatorIndex]
  const assignedCore =
    (assignedCoreBeforeRotation + rotationNumber) % configService.numCores

  return safeResult(assignedCore)
}

/**
 * Get co-guarantors for a specific core
 *
 * Returns the validator indices of all validators assigned to the same core,
 * excluding the current validator.
 *
 * Gray Paper: Each core has exactly 3 validators assigned as guarantors.
 *
 * @param coreIndex - Core index to find co-guarantors for
 * @param currentValidatorIndex - Current validator index to exclude
 * @param entropy2 - Epochal entropy (32 bytes)
 * @param currentSlot - Current timeslot
 * @param config - Configuration parameters
 * @returns Safe<number[]> - Array of co-guarantor validator indices
 */
export function getCoGuarantors(
  coreIndex: number,
  currentValidatorIndex: number,
  entropy2: Uint8Array,
  currentSlot: bigint,
  configService: IConfigService,
): Safe<number[]> {
  // Validate inputs
  if (coreIndex < 0 || coreIndex >= configService.numCores) {
    return safeError(
      new Error(
        `Invalid core index: ${coreIndex} (must be 0 to ${configService.numCores - 1})`,
      ),
    )
  }

  if (
    currentValidatorIndex < 0 ||
    currentValidatorIndex >= configService.numValidators
  ) {
    return safeError(
      new Error(
        `Invalid validator index: ${currentValidatorIndex} (must be 0 to ${configService.numValidators - 1})`,
      ),
    )
  }

  // Find all validators assigned to this core
  const coGuarantors: number[] = []

  for (
    let validatorIndex = 0;
    validatorIndex < configService.numValidators;
    validatorIndex++
  ) {
    // Skip the current validator
    if (validatorIndex === currentValidatorIndex) {
      continue
    }

    // Check if this validator is assigned to the target core
    const [assignError, assignedCore] = getAssignedCore(
      validatorIndex,
      entropy2,
      currentSlot,
      configService,
    )

    if (assignError) {
      return safeError(
        new Error(
          `Failed to get assignment for validator ${validatorIndex}: ${assignError.message}`,
        ),
      )
    }

    if (assignedCore === coreIndex) {
      coGuarantors.push(validatorIndex)
    }
  }

  return safeResult(coGuarantors)
}
