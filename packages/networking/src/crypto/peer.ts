/**
 * Peer interface for QUIC networking
 * Represents a connected peer with connection, stream, and metadata
 */

import type { QUICConnection } from '@infisical/quic'
import type QUICStream from '@infisical/quic/dist/QUICStream'
import type { Hex } from '@pbnjam/core'
import type { ConnectionEndpoint, StreamKind } from '@pbnjam/types'

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
  /**
   * Unique Persistent (UP) streams: at most one active stream per StreamKind per connection.
   * When the acceptor sees multiple streams with the same kind (e.g. after packet loss),
   * the stream with the greatest ID is kept; others are reset.
   */
  streamByKind: Map<StreamKind, { stream: QUICStream; streamId: number }> =
    new Map()
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
  }

  /**
   * Remove a stream from this peer
   */
  removeStream(stream: QUICStream): void {
    this.streams.delete(stream)
    for (const [kind, entry] of this.streamByKind.entries()) {
      if (entry.stream === stream) {
        this.streamByKind.delete(kind)
        break
      }
    }
    const reader = this.readers.get(stream)
    if (reader) {
      reader.releaseLock()
      this.readers.delete(stream)
    }
  }

  /**
   * Unique Persistent (UP) stream rule: only one stream per kind per connection.
   * When the acceptor observes multiple streams with the same kind, keep the one
   * with the greatest stream ID (per QUIC spec) and reject the others.
   * Caller must have already added the stream to this peer (e.g. via addStream).
   * @returns 'keep' and optional previousStream to reset, or 'reject' (caller should reset this stream)
   */
  registerOrCompareUPStream(
    kind: StreamKind,
    stream: QUICStream,
    streamId: number,
  ): { action: 'keep'; previousStream?: QUICStream } | { action: 'reject' } {
    const existing = this.streamByKind.get(kind)
    if (!existing) {
      this.streamByKind.set(kind, { stream, streamId })
      return { action: 'keep' }
    }
    if (streamId > existing.streamId) {
      this.streams.delete(existing.stream)
      this.streamByKind.set(kind, { stream, streamId })
      return { action: 'keep', previousStream: existing.stream }
    }
    return { action: 'reject' }
  }

  /** Get the active UP stream for a kind, if any */
  getStreamForKind(kind: StreamKind): QUICStream | null {
    return this.streamByKind.get(kind)?.stream ?? null
  }
}
