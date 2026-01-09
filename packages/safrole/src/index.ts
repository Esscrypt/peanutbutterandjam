/**
 * Safrole Consensus Protocol Package
 *
 * Implements the Safrole consensus protocol as specified in Gray Paper Section 3
 * Reference: graypaper/text/safrole.tex
 */

// Extrinsic hash moved to @pbnjam/codec
export { calculateExtrinsicHash } from '@pbnjam/codec'
// Re-export getTicketIdFromProof from core for backward compatibility
export { getTicketIdFromProof } from '@pbnjam/core'
// Re-export isSafroleTicket from types for backward compatibility
export { isSafroleTicket } from '@pbnjam/types'
export * from './epoch-marker'
export * from './fallback-sealing'
export * from './phase'
// Network protocol implementation
// Safrole implementation
export * from './ticket-generation'
export * from './ticket-sealing'
export * from './winners-marker'
