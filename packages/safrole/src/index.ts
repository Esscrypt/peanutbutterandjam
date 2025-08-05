/**
 * Safrole Consensus Protocol Package
 *
 * Implements the Safrole consensus protocol as specified in the Gray Paper
 * Reference: graypaper/text/safrole.tex
 */

// Re-export specific types from centralized types package to avoid conflicts
export type {
  BlockHeader as CoreBlockHeader,
  Bytes,
  Extrinsic,
  GRAY_PAPER_CONSTANTS,
  Hash,
  Natural,
  Result,
  SAFROLE_CONSTANTS,
  SafroleError,
  SafroleErrorCode,
  SafroleInput,
  SafroleOutput,
  SafroleState,
  SerializationResult,
  Ticket,
  TicketProof,
  ValidatorKey,
} from '@pbnj/types'
export * from './network/serialization'

// Network protocol exports
export * from './network/types'
export * from './state-transitions'
// Main export for easy importing
export { executeSafroleSTF } from './state-transitions'
