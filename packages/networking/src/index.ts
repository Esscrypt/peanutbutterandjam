/**
 * JAM Simple Networking Protocol (JAMNP-S)
 *
 * Main exports for the networking package
 */

export {
  deriveSecretSeeds,
  generateAlternativeName,
  generateTrivialSeed,
} from '@pbnj/core'
export {
  createCertificateFromKeyPair,
  extractAlternativeNameFromCertificate,
  generateCertificate,
  generateCertificateFromSeed,
  validateCertificate,
} from './crypto/certificates'
// Crypto utilities
export { generateALPNProtocol, parseALPNProtocol } from './crypto/tls'
export { BuilderSlotsManager } from './peer/builder-slots'
// Peer management
export { ConnectionManager } from './peer/connection-manager'
export { GridStructureManager } from './peer/grid-structure'
export { PeerDiscoveryManager } from './peer/peer-discovery'
export { ValidatorSetManager } from './peer/validator-set'
export { WorkPackageSubmissionProtocol } from './protocols/ce133-work-package-submission'
// Protocol handlers
//TODO: implement
// export { BlockAnnouncementProtocol } from './protocols/up0-block-announcement'
export { QuicConnectionManager } from './quic/connection'
export { QuicStreamManager } from './quic/stream'
// Types
export type { TransportConfig, TransportEvents } from './quic/transport'
// Core networking components
export { QuicTransport } from './quic/transport'
