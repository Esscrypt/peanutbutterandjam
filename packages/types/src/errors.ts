/**
 * JAM Protocol Error Constants
 *
 * Centralized definitions of all error strings used in the JAM protocol implementation.
 * These error strings are based on the test vector specifications in jam-test-vectors.
 *
 * Reference:
 * - Reports STF: submodules/jam-test-vectors/stf/reports/reports.asn
 * - Disputes STF: submodules/jam-test-vectors/stf/disputes/disputes.asn
 * - Safrole STF: submodules/jam-test-vectors/stf/safrole/safrole.asn
 *
 * Note: Error codes are NOT specified in the Gray Paper. These are implementation-specific
 * error strings used for testing and debugging.
 */

/**
 * Reports/Guarantees STF Error Codes
 * Reference: submodules/jam-test-vectors/stf/reports/reports.asn (lines 95-122)
 */
export const REPORTS_ERRORS = {
  BAD_CORE_INDEX: 'bad_core_index',
  FUTURE_REPORT_SLOT: 'future_report_slot',
  REPORT_EPOCH_BEFORE_LAST: 'report_epoch_before_last',
  INSUFFICIENT_GUARANTEES: 'insufficient_guarantees',
  OUT_OF_ORDER_GUARANTEE: 'out_of_order_guarantee',
  NOT_SORTED_OR_UNIQUE_GUARANTORS: 'not_sorted_or_unique_guarantors',
  WRONG_ASSIGNMENT: 'wrong_assignment',
  CORE_ENGAGED: 'core_engaged',
  ANCHOR_NOT_RECENT: 'anchor_not_recent',
  BAD_SERVICE_ID: 'bad_service_id',
  BAD_CODE_HASH: 'bad_code_hash',
  DEPENDENCY_MISSING: 'dependency_missing',
  DUPLICATE_PACKAGE: 'duplicate_package',
  BAD_STATE_ROOT: 'bad_state_root',
  BAD_BEEFY_MMR_ROOT: 'bad_beefy_mmr_root',
  CORE_UNAUTHORIZED: 'core_unauthorized',
  BAD_VALIDATOR_INDEX: 'bad_validator_index',
  WORK_REPORT_GAS_TOO_HIGH: 'work_report_gas_too_high',
  SERVICE_ITEM_GAS_TOO_LOW: 'service_item_gas_too_low',
  TOO_MANY_DEPENDENCIES: 'too_many_dependencies',
  SEGMENT_ROOT_LOOKUP_INVALID: 'segment_root_lookup_invalid',
  BAD_SIGNATURE: 'bad_signature',
  WORK_REPORT_TOO_BIG: 'work_report_too_big',
  BANNED_VALIDATOR: 'banned_validator',
  LOOKUP_ANCHOR_NOT_RECENT: 'lookup_anchor_not_recent',
  MISSING_WORK_RESULTS: 'missing_work_results',
} as const

/**
 * Disputes STF Error Codes
 * Reference: submodules/jam-test-vectors/stf/disputes/disputes.asn (lines 37-54)
 */
export const DISPUTES_ERRORS = {
  ALREADY_JUDGED: 'already_judged',
  BAD_VOTE_SPLIT: 'bad_vote_split',
  VERDICTS_NOT_SORTED_UNIQUE: 'verdicts_not_sorted_unique',
  JUDGEMENTS_NOT_SORTED_UNIQUE: 'judgements_not_sorted_unique',
  CULPRITS_NOT_SORTED_UNIQUE: 'culprits_not_sorted_unique',
  FAULTS_NOT_SORTED_UNIQUE: 'faults_not_sorted_unique',
  NOT_ENOUGH_CULPRITS: 'not_enough_culprits',
  NOT_ENOUGH_FAULTS: 'not_enough_faults',
  CULPRITS_VERDICT_NOT_BAD: 'culprits_verdict_not_bad',
  FAULT_VERDICT_WRONG: 'fault_verdict_wrong',
  OFFENDER_ALREADY_REPORTED: 'offender_already_reported',
  BAD_JUDGEMENT_AGE: 'bad_judgement_age',
  BAD_VALIDATOR_INDEX: 'bad_validator_index',
  BAD_SIGNATURE: 'bad_signature',
  BAD_GUARANTOR_KEY: 'bad_guarantor_key',
  BAD_AUDITOR_KEY: 'bad_auditor_key',
  BAD_OFFENDERS_MARK: 'bad_offenders_mark',
} as const

/**
 * Safrole/Tickets STF Error Codes
 * Reference: submodules/jam-test-vectors/stf/safrole/safrole.asn (lines 54-69)
 */
export const SAFROLE_ERRORS = {
  BAD_SLOT: 'bad_slot',
  UNEXPECTED_TICKET: 'unexpected_ticket',
  BAD_TICKET_ORDER: 'bad_ticket_order',
  BAD_TICKET_PROOF: 'bad_ticket_proof',
  BAD_TICKET_ATTEMPT: 'bad_ticket_attempt',
  RESERVED: 'reserved',
  DUPLICATE_TICKET: 'duplicate_ticket',
} as const

/**
 * Assurances STF Error Codes
 * Reference: submodules/jam-test-vectors/stf/assurances/assurances.asn (lines 34-40)
 */
export const ASSURANCES_ERRORS = {
  BAD_ATTESTATION_PARENT: 'bad_attestation_parent',
  BAD_VALIDATOR_INDEX: 'bad_validator_index',
  CORE_NOT_ENGAGED: 'core_not_engaged',
  BAD_SIGNATURE: 'bad_signature',
  NOT_SORTED_OR_UNIQUE_ASSURERS: 'not_sorted_or_unique_assurers',
} as const

/**
 * Preimages STF Error Codes
 * Reference: submodules/jam-test-vectors/stf/preimages/preimages.asn (lines 57-60)
 */
export const PREIMAGES_ERRORS = {
  PREIMAGE_UNNEEDED: 'preimage_unneeded',
  PREIMAGES_NOT_SORTED_UNIQUE: 'preimages_not_sorted_unique',
} as const

/**
 * Block Header Verification Error Codes
 * These errors occur during block header validation before block execution
 */
export const BLOCK_HEADER_ERRORS = {
  INVALID_EPOCH_MARK: 'InvalidEpochMark',
  INVALID_TICKETS_MARK: 'InvalidTicketsMark',
  INVALID_AUTHOR_INDEX: 'InvalidAuthorIndex',
  UNEXPECTED_AUTHOR: 'UnexpectedAuthor',
  BAD_SEAL_SIGNATURE: 'BadSealSignature',
  INVALID_EXTRINSIC_HASH: 'InvalidExtrinsicHash',
  SAFROLE_INITIALIZATION_FAILED: 'SafroleInitializationFailed',
} as const

/**
 * Additional error strings used in the codebase (not in test vectors)
 */
export const ADDITIONAL_ERRORS = {
  // Ticket validation errors
  INVALID_SLOT_PROGRESSION: 'invalid_slot_progression',
  TOO_MANY_EXTRINSICS: 'too_many_extrinsics',
  INVALID_TICKET_ENTRY_INDEX: 'invalid_ticket_entry_index',
  // Block header errors
  BLOCK_SLOT_IN_FUTURE: 'Block slot is in the future',
  VRF_SIGNATURE_INVALID: 'VRF signature is invalid',
  SEAL_SIGNATURE_INVALID: 'Seal signature is invalid',
  // State errors
  INVALID_STATE_KEY_LENGTH: 'Invalid state key length',
  NO_DECODER_FOUND: 'No decoder found for chapter index',
  FAILED_TO_DECODE_STATE_VALUE: 'Failed to decode state value',
  // Work report errors
  WORK_REPORT_FUTURE_TIMESTAMP: 'Work report with future timestamp detected',
  // Generic batch signature errors (used without category prefix)
  BAD_SIGNATURE_BATCH: 'bad signature batch',
} as const

/**
 * All error strings as a flat object for easy lookup
 */
export const ALL_ERRORS = {
  ...REPORTS_ERRORS,
  ...DISPUTES_ERRORS,
  ...SAFROLE_ERRORS,
  ...ASSURANCES_ERRORS,
  ...PREIMAGES_ERRORS,
  ...BLOCK_HEADER_ERRORS,
  ...ADDITIONAL_ERRORS,
} as const

/**
 * Mapping from error codes to human-readable error messages
 * Based on test vector README descriptions and fuzzer report expectations
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Reports errors
  [REPORTS_ERRORS.BAD_CORE_INDEX]: 'Core index is too big',
  [REPORTS_ERRORS.FUTURE_REPORT_SLOT]: 'report refers to slot in the future',
  [REPORTS_ERRORS.REPORT_EPOCH_BEFORE_LAST]: 'report rotation before last',
  [REPORTS_ERRORS.INSUFFICIENT_GUARANTEES]:
    'Report with no enough guarantors signatures',
  [REPORTS_ERRORS.OUT_OF_ORDER_GUARANTEE]: 'not sorted or unique guarantees',
  [REPORTS_ERRORS.NOT_SORTED_OR_UNIQUE_GUARANTORS]:
    'not sorted or unique guarantors',
  [REPORTS_ERRORS.WRONG_ASSIGNMENT]:
    'Unexpected guarantor for work report core',
  [REPORTS_ERRORS.CORE_ENGAGED]: 'A core is not available',
  [REPORTS_ERRORS.ANCHOR_NOT_RECENT]: 'Context anchor is not recent enough',
  [REPORTS_ERRORS.BAD_SERVICE_ID]:
    'Work result service identifier does not have any associated account in state',
  [REPORTS_ERRORS.BAD_CODE_HASH]:
    'Work result code hash does not match the one expected for the service',
  [REPORTS_ERRORS.DEPENDENCY_MISSING]: 'Prerequisite is missing',
  [REPORTS_ERRORS.DUPLICATE_PACKAGE]:
    'Package was already available in recent history',
  [REPORTS_ERRORS.BAD_STATE_ROOT]:
    'Context state root does not match the one at anchor',
  [REPORTS_ERRORS.BAD_BEEFY_MMR_ROOT]:
    'Context Beefy MMR root does not match the one at anchor',
  [REPORTS_ERRORS.CORE_UNAUTHORIZED]: 'Target core without any authorizer',
  [REPORTS_ERRORS.BAD_VALIDATOR_INDEX]: 'bad validator index',
  [REPORTS_ERRORS.WORK_REPORT_GAS_TOO_HIGH]:
    'Work report per core gas is too much high',
  [REPORTS_ERRORS.SERVICE_ITEM_GAS_TOO_LOW]:
    'Accumulate gas is below the service minimum',
  [REPORTS_ERRORS.TOO_MANY_DEPENDENCIES]:
    'Work report has too many dependencies',
  [REPORTS_ERRORS.SEGMENT_ROOT_LOOKUP_INVALID]:
    'Segments tree root lookup item not found in recent blocks history',
  [REPORTS_ERRORS.BAD_SIGNATURE]: 'Invalid report guarantee signature',
  [REPORTS_ERRORS.WORK_REPORT_TOO_BIG]:
    'Work report output is size is over the limit',
  [REPORTS_ERRORS.BANNED_VALIDATOR]: 'Banned validator',
  [REPORTS_ERRORS.LOOKUP_ANCHOR_NOT_RECENT]:
    'Lookup anchor is not recent enough',
  [REPORTS_ERRORS.MISSING_WORK_RESULTS]: 'Missing work results',
  // Safrole errors
  [SAFROLE_ERRORS.BAD_SLOT]: 'Bad slot',
  [SAFROLE_ERRORS.UNEXPECTED_TICKET]: 'Unexpected ticket',
  [SAFROLE_ERRORS.BAD_TICKET_ORDER]: 'Bad ticket order',
  [SAFROLE_ERRORS.BAD_TICKET_PROOF]: 'Bad ticket proof',
  [SAFROLE_ERRORS.BAD_TICKET_ATTEMPT]: 'Bad ticket attempt',
  [SAFROLE_ERRORS.DUPLICATE_TICKET]: 'Duplicate ticket',
  // Assurances errors
  [ASSURANCES_ERRORS.BAD_ATTESTATION_PARENT]: 'bad attestation parent',
  [ASSURANCES_ERRORS.CORE_NOT_ENGAGED]: 'core not engaged',
  [ASSURANCES_ERRORS.NOT_SORTED_OR_UNIQUE_ASSURERS]:
    'not sorted or unique assurers',
  // Note: BAD_VALIDATOR_INDEX and BAD_SIGNATURE are shared across categories, use reports version
  // Preimages errors
  [PREIMAGES_ERRORS.PREIMAGE_UNNEEDED]: 'preimage not required',
  [PREIMAGES_ERRORS.PREIMAGES_NOT_SORTED_UNIQUE]: 'preimages not sorted unique',
  // Block header verification errors
  [BLOCK_HEADER_ERRORS.INVALID_EPOCH_MARK]: 'InvalidEpochMark',
  [BLOCK_HEADER_ERRORS.INVALID_TICKETS_MARK]: 'InvalidTicketsMark',
  [BLOCK_HEADER_ERRORS.INVALID_AUTHOR_INDEX]: 'InvalidAuthorIndex',
  [BLOCK_HEADER_ERRORS.UNEXPECTED_AUTHOR]: 'UnexpectedAuthor',
  [BLOCK_HEADER_ERRORS.BAD_SEAL_SIGNATURE]: 'BadSealSignature',
  [BLOCK_HEADER_ERRORS.INVALID_EXTRINSIC_HASH]: 'InvalidExtrinsicHash',
  [BLOCK_HEADER_ERRORS.SAFROLE_INITIALIZATION_FAILED]:
    'SafroleInitializationFailed',
  // Additional errors - use the error code as message if no mapping exists
  [ADDITIONAL_ERRORS.WORK_REPORT_FUTURE_TIMESTAMP]:
    'report refers to slot in the future',
} as const

/**
 * Extract standardized error string from an Error message
 *
 * This function attempts to extract the standardized error string from various
 * error message formats. It handles:
 * - Direct error strings: "future_report_slot"
 * - Prefixed messages: "Block import failed: future_report_slot"
 * - Full error messages: "Chain error: block execution failure: reports error: future_report_slot"
 *
 * @param error - Error object or error message string
 * @returns Standardized error string, or null if not found
 */
export function extractErrorString(error: Error | string): string | null {
  const message = error instanceof Error ? error.message : error

  // Check if message is exactly one of our known error strings
  const errorValues = Object.values(ALL_ERRORS) as readonly string[]
  if (errorValues.includes(message)) {
    return message
  }

  // Try to find a known error string within the message
  for (const errorString of errorValues) {
    if (message.includes(errorString)) {
      return errorString
    }
  }

  // Return null if no known error string found
  return null
}

/**
 * Format error for fuzzer response
 *
 * Formats errors according to the expected fuzzer protocol format:
 * "Local chain error: block execution failure: <category> error: <human-readable_message>"
 *
 * @param error - Error object or error message string
 * @param category - Error category (e.g., "reports", "safrole", "disputes")
 * @returns Formatted error string for fuzzer
 */
export function formatFuzzerError(
  error: Error | string,
  category:
    | 'reports'
    | 'safrole'
    | 'disputes'
    | 'assurances'
    | 'preimages'
    | 'block'
    | 'state' = 'block',
): string {
  const errorString = extractErrorString(error)
  const message = error instanceof Error ? error.message : error

  if (errorString) {
    // Get human-readable message from mapping, or use error code as fallback
    const humanReadableMessage = ERROR_MESSAGES[errorString] || errorString
    // Use standardized format: "Local chain error: block execution failure: <category> error: <human-readable_message>"
    return `Local chain error: block execution failure: ${category} error: ${humanReadableMessage}`
  }

  // Fallback to original message if no standardized error found
  return message
}

/**
 * Map error to category based on error string
 *
 * Determines which STF category an error belongs to based on the error string.
 *
 * @param errorString - Standardized error string
 * @returns Category name or null if unknown
 */
export function getErrorCategory(
  errorString: string,
):
  | 'reports'
  | 'safrole'
  | 'disputes'
  | 'assurances'
  | 'preimages'
  | 'block'
  | 'state'
  | null {
  const reportsErrors = Object.values(REPORTS_ERRORS) as readonly string[]
  const disputesErrors = Object.values(DISPUTES_ERRORS) as readonly string[]
  const safroleErrors = Object.values(SAFROLE_ERRORS) as readonly string[]
  const assurancesErrors = Object.values(ASSURANCES_ERRORS) as readonly string[]
  const preimagesErrors = Object.values(PREIMAGES_ERRORS) as readonly string[]

  if (reportsErrors.includes(errorString)) {
    return 'reports'
  }
  if (disputesErrors.includes(errorString)) {
    return 'disputes'
  }
  if (safroleErrors.includes(errorString)) {
    return 'safrole'
  }
  if (assurancesErrors.includes(errorString)) {
    return 'assurances'
  }
  if (preimagesErrors.includes(errorString)) {
    return 'preimages'
  }
  if (
    errorString.includes('slot') ||
    errorString.includes('VRF') ||
    errorString.includes('Seal')
  ) {
    return 'block'
  }
  if (
    errorString.includes('state') ||
    errorString.includes('decoder') ||
    errorString.includes('key')
  ) {
    return 'state'
  }
  return null
}

/**
 * Format error for fuzzer with automatic category detection
 *
 * Automatically determines the error category and formats the error message
 * for the fuzzer protocol. Handles both "block execution failure" and
 * "block header verification failure" formats.
 *
 * @param error - Error object or error message string
 * @returns Formatted error string for fuzzer
 */
export function formatFuzzerErrorAuto(error: Error | string): string {
  const errorString = extractErrorString(error)
  const message = error instanceof Error ? error.message : error

  // Ensure message is always a string
  const safeMessage =
    message ?? (error instanceof Error ? String(error) : String(error))

  // Check if this is a block header verification error
  const headerErrors = Object.values(BLOCK_HEADER_ERRORS) as readonly string[]
  if (errorString && headerErrors.includes(errorString)) {
    // Format as "Local chain error: block header verification failure: <error_code>"
    return `Local chain error: block header verification failure: ${errorString}`
  }

  // Special case: "bad signature batch" should be formatted without a category prefix
  // Format: "Local chain error: block execution failure: bad signature batch"
  // This also applies to REPORTS_ERRORS.BAD_SIGNATURE ('bad_signature') which is the
  // error code for invalid guarantee signatures - jam-conformance expects "bad signature batch"
  if (
    errorString === ADDITIONAL_ERRORS.BAD_SIGNATURE_BATCH ||
    safeMessage === 'bad signature batch' ||
    errorString === REPORTS_ERRORS.BAD_SIGNATURE ||
    safeMessage === 'Invalid report guarantee signature'
  ) {
    return `Local chain error: block execution failure: bad signature batch`
  }

  // Special case: Parent state root mismatch
  // Format: "Local chain error: invalid parent state root (expected: 0x{16 chars}..., actual: 0x{16 chars}...)"
  // Match: "Prior state root mismatch: computed 0x..., expected 0x..."
  const priorStateRootMatch = safeMessage.match(
    /Prior state root mismatch: computed (0x[a-fA-F0-9]+), expected (0x[a-fA-F0-9]+)/,
  )
  if (priorStateRootMatch) {
    const actualHash = priorStateRootMatch[1] // "computed" is what we got (actual)
    const expectedHash = priorStateRootMatch[2] // "expected" is what header claimed
    const truncatedExpected = expectedHash.substring(0, 18) // 0x + 16 chars
    const truncatedActual = actualHash.substring(0, 18)
    return `Local chain error: invalid parent state root (expected: ${truncatedExpected}..., actual: ${truncatedActual}...)`
  }

  if (!errorString) {
    // Check if message already contains "block header verification failure"
    if (safeMessage.includes('block header verification failure')) {
      // Ensure it uses "Local chain error:" prefix
      if (safeMessage.startsWith('Chain error:')) {
        return safeMessage.replace('Chain error:', 'Local chain error:')
      }
      if (!safeMessage.startsWith('Local chain error:')) {
        return `Local chain error: ${safeMessage}`
      }
      return safeMessage
    }
    // Check if message contains a block header error code
    for (const headerError of headerErrors) {
      if (safeMessage.includes(headerError)) {
        return `Local chain error: block header verification failure: ${headerError}`
      }
    }
    return safeMessage
  }

  const category = getErrorCategory(errorString) || 'block'
  return formatFuzzerError(error, category)
}
