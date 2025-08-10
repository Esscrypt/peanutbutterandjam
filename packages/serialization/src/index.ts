/**
 * Gray Paper Serialization Package
 *
 * Implements Gray Paper-compliant serialization functions from Appendix D
 * Reference: Gray Paper serialization specifications
 */

// Import local types to avoid circular dependencies
// Types are imported directly from @pbnj/types

export * from './block/body'
// Block serialization
export * from './block/header'
export * from './core/compact-number'
export * from './core/discriminator'
export * from './core/fixed-length'
// Core serialization functions
export * from './core/natural-number'
export * from './core/sequence'
export * from './core/simple-number'
// State serialization
export * from './state/state-serialization'
// Work package serialization
export * from './work-package/context'
export * from './work-package/package'
export * from './work-package/work-digest'
export * from './work-package/work-report'
