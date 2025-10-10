/**
 * Gray Paper Constants
 *
 * *** DO NOT REMOVE - GRAY PAPER CONSTANTS ***
 *
 * This file contains all C_ prefixed constants from the Gray Paper.
 * These constants define the core parameters of the JAM protocol.
 *
 * Source: Gray Paper definitions.tex section
 * Reference: https://github.com/gavofyork/graypaper
 */

/**
 * Core System Constants
 */
export const CORE_CONSTANTS = {
  /** The total number of cores */
  C_CORECOUNT: 341,

  /** The total number of validators */
  C_VALCOUNT: 1023,

  /** The length of an epoch in timeslots */
  C_EPOCHLEN: 600,

  /** The slot period, in seconds */
  C_SLOTSECONDS: 6,
} as const

/**
 * Work Package Constants
 */
export const WORK_PACKAGE_CONSTANTS = {
  /** The maximum amount of work items in a package */
  C_MAXPACKAGEITEMS: 16,

  /** The maximum number of exports in a work-package */
  C_MAXPACKAGEEXPORTS: 3072,

  /** The maximum number of imports in a work-package */
  C_MAXPACKAGEIMPORTS: 3072,

  /** The maximum number of extrinsics in a work-package */
  C_MAXPACKAGEXTS: 128,

  /** The maximum size of the concatenated variable-size blobs, extrinsics and imported segments of a work-package, in octets */
  C_MAXBUNDLESIZE: 13791360,
} as const

/**
 * Work Report Constants
 */
export const WORK_REPORT_CONSTANTS = {
  /** The maximum sum of dependency items in a work-report */
  C_MAXREPORTDEPS: 8,

  /** The maximum total size of all unbounded blobs in a work-report, in octets */
  C_MAXREPORTVARSIZE: 48 * 1024, // 48 * 2^10

  /** The gas allocated to invoke a work-report's Accumulation logic */
  C_REPORTACCGAS: 10000000,
} as const

/**
 * Authorization Constants
 */
export const AUTHORIZATION_CONSTANTS = {
  /** The maximum number of items in the authorizations pool */
  C_AUTHPOOLSIZE: 8,

  /** The number of items in the authorizations queue */
  C_AUTHQUEUESIZE: 80,

  /** The gas allocated to invoke a work-package's Is-Authorized logic */
  C_PACKAGEAUTHGAS: 50000000,

  /** The maximum size of is-authorized code in octets */
  C_MAXAUTHCODESIZE: 64000,
} as const

/**
 * Gas Constants
 */
export const GAS_CONSTANTS = {
  /** The gas allocated to invoke a work-package's Refine logic */
  C_PACKAGEREFGAS: 5000000000,

  /** The total gas allocated across for all Accumulation */
  C_BLOCKACCGAS: 3500000000,
} as const

/**
 * Segment and Erasure Coding Constants
 */
export const SEGMENT_CONSTANTS = {
  /** The basic size of erasure-coded pieces in octets */
  C_ECPIECESIZE: 684,

  /** The number of erasure-coded pieces in a segment */
  C_SEGMENTECPIECES: 6,

  /** The size of a segment in octets */
  C_SEGMENTSIZE: 4104, // C_SEGMENTECPIECES * C_ECPIECESIZE
} as const

/**
 * Service Constants
 */
export const SERVICE_CONSTANTS = {
  /** The maximum size of service code in octets */
  C_MAXSERVICECODESIZE: 4000000,

  /** The minimum public service index */
  C_MINPUBLICINDEX: 65536, // 2^16
} as const

/**
 * Ticket Constants
 */
export const TICKET_CONSTANTS = {
  /** The maximum number of tickets which may be submitted in a single extrinsic */
  C_MAXBLOCKTICKETS: 16,

  /** The number of ticket entries per validator */
  C_TICKETENTRIES: 2,

  /** The number of slots into an epoch at which ticket-submission ends */
  C_EPOCHTAILSTART: 500,
} as const

/**
 * Audit Constants
 */
export const AUDIT_CONSTANTS = {
  /** The period, in seconds, between audit tranches */
  C_TRANCHESECONDS: 8,

  /** The audit bias factor, the expected number of additional validators who will audit a work-report in the following tranche for each no-show in the previous */
  C_AUDITBIASFACTOR: 2,
} as const

/**
 * Time Constants
 */
export const TIME_CONSTANTS = {
  /** The rotation period of validator-core assignments, in timeslots */
  C_ROTATIONPERIOD: 10,

  /** The period in timeslots after which reported but unavailable work may be replaced */
  C_ASSURANCETIMEOUTPERIOD: 5,

  /** The period in timeslots after which an unreferenced preimage may be expunged */
  C_EXPUNGEPERIOD: 19200,

  /** The maximum age in timeslots of the lookup anchor */
  C_MAXLOOKUPANCHORAGE: 14400,
} as const

/**
 * History Constants
 */
export const HISTORY_CONSTANTS = {
  /** The size of recent history, in blocks */
  C_RECENTHISTORYLEN: 8,
} as const

/**
 * Deposit Constants
 */
export const DEPOSIT_CONSTANTS = {
  /** The basic minimum balance which all services require */
  C_BASEDEPOSIT: 100,

  /** The additional minimum balance required per octet of elective service state */
  C_BYTEDEPOSIT: 1,

  /** The additional minimum balance required per item of elective service state */
  C_ITEMDEPOSIT: 10,
} as const

/**
 * Transfer Constants
 */
export const TRANSFER_CONSTANTS = {
  /** The size of a transfer memo in octets */
  C_MEMOSIZE: 128,
} as const

/**
 * PVM Constants
 */
export const PVM_CONSTANTS_GRAY_PAPER = {
  /** The PVM memory page size */
  C_PVMPAGESIZE: 4096, // 2^12

  /** The PVM dynamic address alignment factor */
  C_PVMDYNADDRALIGN: 2,

  /** The standard PVM program initialization zone size */
  C_PVMINITZONESIZE: 65536, // 2^16

  /** The standard PVM program initialization input data size */
  C_PVMINITINPUTSIZE: 16777216, // 2^24
} as const

/**
 * All Gray Paper Constants
 *
 * This object contains all constants for easy access and validation
 */
export const ALL_GRAY_PAPER_CONSTANTS = {
  ...CORE_CONSTANTS,
  ...WORK_PACKAGE_CONSTANTS,
  ...WORK_REPORT_CONSTANTS,
  ...AUTHORIZATION_CONSTANTS,
  ...GAS_CONSTANTS,
  ...SEGMENT_CONSTANTS,
  ...SERVICE_CONSTANTS,
  ...TICKET_CONSTANTS,
  ...AUDIT_CONSTANTS,
  ...TIME_CONSTANTS,
  ...HISTORY_CONSTANTS,
  ...DEPOSIT_CONSTANTS,
  ...TRANSFER_CONSTANTS,
  ...PVM_CONSTANTS_GRAY_PAPER,
} as const

/**
 * Type for all Gray Paper constant names
 */
export type GrayPaperConstantName = keyof typeof ALL_GRAY_PAPER_CONSTANTS

/**
 * Type for all Gray Paper constant values
 */
export type GrayPaperConstantValue =
  (typeof ALL_GRAY_PAPER_CONSTANTS)[GrayPaperConstantName]

/**
 * Utility function to get a Gray Paper constant by name
 */
export function getGrayPaperConstant(
  name: GrayPaperConstantName,
): GrayPaperConstantValue {
  return ALL_GRAY_PAPER_CONSTANTS[name]
}

/**
 * Utility function to validate that a value matches a Gray Paper constant
 */
export function validateGrayPaperConstant(
  name: GrayPaperConstantName,
  value: number,
): boolean {
  return ALL_GRAY_PAPER_CONSTANTS[name] === value
}
