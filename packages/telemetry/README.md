# @pbnj/telemetry

JIP-3 telemetry implementation for JAM nodes, enabling integration with JAM Tart (Testing, Analytics and Research Telemetry).

## Overview

This package provides a complete implementation of the JIP-3 telemetry specification, allowing JAM nodes to send structured telemetry data to telemetry servers for monitoring, analytics, and research purposes.

## Features

- **JIP-3 Compliant**: Full implementation of the JIP-3 telemetry specification
- **Type-Safe Events**: Strongly typed event structures for all telemetry categories
- **Automatic Reconnection**: Robust connection management with exponential backoff
- **Event Buffering**: Intelligent buffering system to handle connection interruptions
- **JAM Serialization**: Uses proper JAM protocol serialization for all messages
- **Easy Integration**: Simple API for integrating telemetry into JAM node implementations

## Installation

```bash
bun add @pbnj/telemetry
```

## Usage

### Basic Setup

```typescript
import { createTelemetrySystem, TelemetryEventEmitter } from '@pbnj/telemetry'

// Configure telemetry
const telemetryConfig = {
  enabled: true,
  endpoint: 'localhost:9615', // JAM Tart telemetry server
  nodeInfo: {
    protocolVersion: 0,
    peerId: new Uint8Array(32), // Your node's Ed25519 public key
    peerAddress: { address: new Uint8Array(16), port: 30303 },
    nodeFlags: 1, // PVM_RECOMPILER flag
    implementationName: 'MyJamNode',
    implementationVersion: '1.0.0',
    additionalInfo: 'Custom JAM node implementation',
  },
}

// Create telemetry system
const telemetry = createTelemetrySystem(telemetryConfig)

// Start telemetry
await telemetry.start()
```

### Emitting Events

```typescript
// Status events (sent every ~2 seconds)
await telemetry.events.emitStatus({
  totalPeerCount: 15,
  validatorPeerCount: 8,
  blockAnnouncementStreamPeerCount: 12,
  guaranteesByCore: new Uint8Array([2, 1, 3, 0]), // guarantees per core
  shardCount: 1024,
  shardTotalSizeBytes: 1024n * 1024n,
  readyPreimageCount: 5,
  readyPreimageTotalSizeBytes: 2048,
})

// Block authoring events
const authoringEventId = await telemetry.events.emitAuthoring(
  12345, // slot
  headerHash // parent header hash
)

// On successful authoring
await telemetry.events.emitAuthored(authoringEventId, {
  sizeInBytes: 1024,
  headerHash,
  ticketCount: 2,
  preimageCount: 1,
  preimagesSizeInBytes: 256,
  guaranteeCount: 3,
  assuranceCount: 5,
  disputeVerdictCount: 0,
})

// Networking events
await telemetry.events.emitPeerMisbehaved(
  peerId,
  'Invalid signature in block announcement'
)

// Connection events
const connectingOutEventId = await telemetry.events.emitConnectingOut(
  peerId,
  peerAddress
)

await telemetry.events.emitConnectedOut(connectingOutEventId)
```

### Advanced Usage

```typescript
import { TelemetryClient, TelemetryEventEmitter } from '@pbnj/telemetry'

// Manual setup for more control
const client = new TelemetryClient(telemetryConfig)
const events = new TelemetryEventEmitter(client)

// Listen to client events
client.on('connected', () => console.log('Connected to telemetry server'))
client.on('error', (error) => console.error('Telemetry error:', error))
client.on('dropped', (count, reason) => console.warn(`Dropped ${count} events: ${reason}`))

// Initialize and start
await client.init()
await client.start()

// Get statistics
const stats = client.getStats()
console.log('Telemetry stats:', stats)
```

## Event Categories

The package supports all JIP-3 event categories:

### Meta Events (0-9)
- **Dropped Events**: When events are dropped due to buffer overflow

### Status Events (10-19)
- **Status**: Periodic node status reports
- **Best Block Changed**: When the node's best block changes
- **Finalized Block Changed**: When finalization advances
- **Sync Status Changed**: When sync status changes

### Networking Events (20-39)
- **Connection Management**: Connection attempts, successes, failures
- **Peer Behavior**: Misbehavior reporting
- **Protocol Events**: Various JAMNP-S protocol events

### Block Authoring/Importing Events (40-59)
- **Authoring Pipeline**: Block creation, validation, execution
- **Import Pipeline**: Block import and verification

### Block Distribution Events (60-79)
- **Announcements**: Block announcement streams
- **Requests**: Block request/response cycles
- **Transfers**: Block data transfers

### Safrole Ticket Events (80-89)
- **Generation**: Ticket generation process
- **Distribution**: Ticket sharing between nodes

### Additional Categories
- **Guaranteeing Events (90-119)**: Work package processing and guarantees
- **Availability Events (120-139)**: Shard distribution and assurances
- **Bundle Recovery Events (140-159)**: Audit-related bundle recovery
- **Segment Recovery Events (160-189)**: Segment reconstruction
- **Preimage Events (190-199)**: Preimage distribution

## Configuration

```typescript
interface TelemetryConfig {
  /** Whether telemetry is enabled */
  enabled: boolean
  
  /** Telemetry server endpoint (HOST:PORT) */
  endpoint?: string
  
  /** Node information sent on connection */
  nodeInfo: NodeInfo
  
  /** Maximum events to buffer before dropping */
  maxBufferSize?: number
  
  /** Connection retry settings */
  retrySettings?: {
    maxRetries: number
    retryDelayMs: number
    backoffMultiplier: number
  }
}
```

## Error Handling

The telemetry system is designed to be resilient:

- **Connection Failures**: Automatic reconnection with exponential backoff
- **Buffer Overflow**: Intelligent event dropping with dropped event reporting
- **Encoding Errors**: Graceful handling of malformed events
- **Non-blocking**: Telemetry failures don't affect node operation

## Performance Considerations

- Events are encoded using efficient JAM serialization
- Buffering minimizes the impact of temporary connection issues
- Async operations prevent blocking the main node execution
- Configurable buffer sizes to balance memory usage and reliability

## Testing

```bash
# Run tests
bun test

# With coverage
bun test --coverage
```

## Contributing

This package implements the JIP-3 specification. When contributing:

1. Ensure all changes maintain JIP-3 compliance
2. Add tests for new event types or features
3. Update documentation for API changes
4. Follow the existing code style and patterns

## References

- [JIP-3 Specification](https://github.com/jam-duna/jips/blob/main/text/jip-0003.md)
- [JAM Gray Paper](https://graypaper.com/)
- [JAM Tart Telemetry](https://jamcha.in/telemetry/)
