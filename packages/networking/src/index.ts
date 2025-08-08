/**
 * JAM Simple Networking Protocol (JAMNP-S)
 * 
 * Main exports for the networking package
 */

// Core networking components
export { QuicTransport } from './quic/transport'
export { QuicConnectionManager } from './quic/connection'
export { QuicStreamManager } from './quic/stream'

// Peer management
export { ConnectionManager } from './peer/connection-manager'
export { ValidatorSetManager } from './peer/validator-set'
export { PeerDiscoveryManager } from './peer/peer-discovery'
export { GridStructureManager } from './peer/grid-structure'
export { BuilderSlotsManager } from './peer/builder-slots'

// Crypto utilities
export { generateALPNProtocol, parseALPNProtocol } from './crypto/tls'
export { deriveSecretSeeds } from './crypto/certificates'

// Protocol handlers
export { BlockAnnouncementProtocol } from './protocols/up0-block-announcement'
export { WorkPackageSubmissionProtocol } from './protocols/ce133-work-package-submission'

// Database integration
export { NetworkingDatabaseIntegration } from './db-integration'

// Types
export type { TransportConfig, TransportEvents } from './types' 