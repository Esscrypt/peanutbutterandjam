/**
 * Safrole Consensus Protocol Package
 *
 * Implements the Safrole consensus protocol as specified in Gray Paper Section 3
 * Reference: graypaper/text/safrole.tex
 */

// Re-export specific types from centralized types package to avoid conflicts
export type {
  Ticket,
  TicketProof,
  SafroleState,
  SafroleInput,
  SafroleOutput,
  SafroleError,
  SafroleErrorCode,
  SAFROLE_CONSTANTS,
} from '@pbnj/types'

// Re-export values (enums and constants) from centralized types package
export {
  SafroleErrorCode,
  SAFROLE_CONSTANTS,
} from '@pbnj/types'

// Safrole implementation
export * from './state-transitions'

// Network protocol implementation
export * from './network/serialization'
