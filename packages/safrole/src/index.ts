/**
 * Safrole Consensus Protocol Package
 *
 * Implements the Safrole consensus protocol as specified in Gray Paper Section 3
 * Reference: graypaper/text/safrole.tex
 */

// Re-export specific types from centralized types package to avoid conflicts
export type {
  SAFROLE_CONSTANTS,
  SafroleError,
  SafroleErrorCode,
  SafroleInput,
  SafroleOutput,
  SafroleState,
  Ticket,
  TicketProof,
} from '@pbnj/types'

// Re-export values (enums and constants) from centralized types package
export {
  SAFROLE_CONSTANTS,
  SafroleErrorCode,
} from '@pbnj/types'
// Network protocol implementation
export * from './network/serialization'
// Safrole implementation
export * from './state-transitions'
