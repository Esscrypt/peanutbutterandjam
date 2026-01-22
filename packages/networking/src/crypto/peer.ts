/**
 * Peer interface for QUIC networking
 * Represents a connected peer with connection, stream, and metadata
 */

import type { QUICConnection } from '@infisical/quic'
import type QUICStream from '@infisical/quic/dist/QUICStream'
import type { Hex } from '@pbnjam/core'
import type { ConnectionEndpoint } from '@pbnjam/types'

/**
 * Reader interface for QUIC stream readable
 * Matches the interface returned by stream.readable.getReader()
 */
export interface StreamReader {
  read(): Promise<{ value?: Uint8Array; done: boolean }>
  releaseLock(): void
}

/**
 * Peer class - represents a connected peer with multiple streams per connection
 */
export class Peer {
  /** Connection ID (unique per QUIC connection) */
  connectionId: string
  /** Peer's Ed25519 public key (Hex) */
  publicKey: Hex
  /** QUIC connection object */
  connection: QUICConnection
  /** Connection endpoint (host, port, publicKey) */
  endpoint: ConnectionEndpoint
  /** Set of streams for this peer (multiple streams per connection allowed) */
  streams: Set<QUICStream> = new Set()
  /** Primary stream for sending (first stream created/received) */
  primaryStream: QUICStream | null = null
  /** Stream readers per stream */
  readers: Map<QUICStream, StreamReader> = new Map()
  /** Whether we initiated this connection (client side) */
  isInitiator = false

  constructor(
    connectionId: string,
    publicKey: Hex,
    connection: QUICConnection,
    endpoint: ConnectionEndpoint,
    isInitiator = false,
  ) {
    this.connectionId = connectionId
    this.publicKey = publicKey
    this.connection = connection
    this.endpoint = endpoint
    this.isInitiator = isInitiator
  }

  /**
   * Add a stream to this peer
   */
  addStream(stream: QUICStream): void {
    this.streams.add(stream)
    if (!this.primaryStream) {
      this.primaryStream = stream
    }
  }

  /**
   * Remove a stream from this peer
   */
  removeStream(stream: QUICStream): void {
    this.streams.delete(stream)
    const reader = this.readers.get(stream)
    if (reader) {
      reader.releaseLock()
      this.readers.delete(stream)
    }
    if (this.primaryStream === stream) {
      // Set a new primary stream if available
      this.primaryStream =
        this.streams.size > 0 ? Array.from(this.streams)[0] : null
    }
  }
}
