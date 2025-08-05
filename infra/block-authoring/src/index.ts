/**
 * Block Authoring Service Package
 *
 * Main entry point for the block authoring service
 * Reference: Gray Paper block authoring specifications
 */

// Re-export types from centralized types package
export * from '@pbnj/types'
// Export main service
// Default export
export {
  BlockAuthoringServiceImpl,
  BlockAuthoringServiceImpl as default,
} from './block-authoring-service'
export { BlockSubmitter } from './block-submitter'
// CLI exports
export { createCliProgram, decodeGenesisState, loadChainSpec } from './cli'
export { ExtrinsicValidator } from './extrinsic-validator'
export { GenesisManager } from './genesis-manager'
// Export individual components
export { HeaderConstructor } from './header-constructor'
export { MetricsCollector } from './metrics-collector'
export { StateManager } from './state-manager'
export { WorkPackageProcessor } from './work-package-processor'
