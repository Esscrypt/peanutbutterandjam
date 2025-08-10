/**
 * Networking Types
 *
 * Re-export types from the main types package
 */

export * from '@pbnj/types'

// Transport types - re-export from quic transport to ensure consistency
export type { TransportConfig, TransportEvents } from '../quic/transport'
