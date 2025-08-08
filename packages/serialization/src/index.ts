/**
 * Gray Paper Serialization Package
 *
 * Implements Gray Paper-compliant serialization functions from Appendix D
 * Reference: Gray Paper serialization specifications
 */

// Re-export specific types from centralized types package to avoid conflicts
export type {
  BlockHeader as CoreBlockHeader,
  Uint8Array,
  Extrinsic,
  GRAY_PAPER_CONSTANTS,
  Hash,
  Natural,
  Result,
  SerializationResult,
  ValidatorKey,
} from '@pbnj/types'

// Re-export types for compatibility
export type { 
  SerializationBlockHeader as BlockHeader, 
  SerializationWorkPackage as WorkPackage,
  SerializationWorkItem as WorkItem,
  SerializationExtrinsicReference as ExtrinsicReference,
  SerializationBlockBody as BlockBody,
  WorkContext,
  SafroleTicket,
  SafroleState,
  Dispute,
  SerializationWorkReport as WorkReport,
  Privileges,
  ActivityStats,
  ReadyItem,
  AccumulatedItem,
  LastAccountOut,
  ServiceAccount,
  SerializationGenesisState as GenesisState,
  StateTrieEntry,
  StateTrie,
  ValidatorKeyTuple,
  EpochMark,
  SafroleTicketSingle,
  SafroleTicketArray,
  isTicketsMarkArray,
  isTicketsMarkSingle
} from '@pbnj/types'

export * from './block/body'
// Block serialization
export * from './block/header'
export * from './core/discriminator'
export * from './core/fixed-length'
// Core serialization functions
export * from './core/natural-number'
export * from './core/simple-number'
export * from './core/compact-number'
export * from './core/sequence'
// Work package serialization
export * from './work-package/context'
export * from './work-package/package'
export * from './work-package/work-digest'
export * from './work-package/work-report'
// State serialization
export * from './state/state-serialization'
