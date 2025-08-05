# Safrole Network Protocol Specification

## Overview

This document defines the network protocol for the Safrole consensus mechanism. Since the Gray Paper intentionally leaves the networking protocol undefined, this specification follows established blockchain networking patterns while adhering to the Gray Paper's formal requirements.

## 1. Protocol Architecture

### 1.1 Transport Layer
- **Protocol**: TCP/IP with WebSocket support
- **Port**: 30333 (configurable)
- **Connection**: Persistent bidirectional connections
- **Authentication**: Node ID + validator key verification

### 1.2 Message Format
```typescript
interface NetworkMessage {
  id: string;           // Unique message ID
  type: MessageType;    // Message type enum
  payload: Uint8Array;  // Serialized payload
  timestamp: number;    // Unix timestamp
  signature?: string;   // Optional signature for authenticated messages
}
```

### 1.3 Message Types
```typescript
enum MessageType {
  // Block propagation
  BLOCK_ANNOUNCE = 0x01,
  BLOCK_REQUEST = 0x02,
  BLOCK_RESPONSE = 0x03,
  
  // State synchronization
  STATE_REQUEST = 0x04,
  STATE_RESPONSE = 0x05,
  
  // Consensus messages
  GRANDPA_VOTE = 0x06,
  GRANDPA_COMMIT = 0x07,
  BEEFY_COMMITMENT = 0x08,
  
  // Work package distribution
  WORK_PACKAGE_ANNOUNCE = 0x09,
  WORK_PACKAGE_REQUEST = 0x0A,
  WORK_PACKAGE_RESPONSE = 0x0B,
  
  // Availability assurances
  AVAILABILITY_ANNOUNCE = 0x0C,
  AVAILABILITY_REQUEST = 0x0D,
  AVAILABILITY_RESPONSE = 0x0E,
  
  // Peer management
  PEER_HANDSHAKE = 0x0F,
  PEER_DISCONNECT = 0x10,
  
  // Heartbeat
  PING = 0x11,
  PONG = 0x12,
}
```

## 2. Block Propagation Protocol

### 2.1 Block Announcement
```typescript
interface BlockAnnounce {
  header: BlockHeader;      // Block header
  hash: string;            // Block hash
  parentHash: string;      // Parent block hash
  slot: number;            // Slot number
  author: string;          // Author validator ID
  isTicketed: boolean;     // Whether block uses ticket seal
}
```

### 2.2 Block Request/Response
```typescript
interface BlockRequest {
  hash: string;            // Requested block hash
  includeExtrinsics: boolean; // Whether to include extrinsics
  includeState: boolean;   // Whether to include state
}

interface BlockResponse {
  block: Block;            // Full block data
  state?: State;           // Optional state data
}
```

## 3. State Synchronization Protocol

### 3.1 State Request/Response
```typescript
interface StateRequest {
  blockHash: string;       // Block hash to sync from
  components: StateComponent[]; // Which state components to request
}

interface StateResponse {
  blockHash: string;       // Block hash
  state: Partial<State>;   // Requested state components
  proof?: string;          // Optional Merkle proof
}

enum StateComponent {
  SAFROLE = 0x01,         // Safrole consensus state
  VALIDATORS = 0x02,      // Validator sets
  ENTROPY = 0x03,         // Entropy accumulator
  TICKETS = 0x04,         // Ticket accumulator
  ACCOUNTS = 0x05,        // Account state
  REPORTS = 0x06,         // Work reports
}
```

## 4. Consensus Protocol Messages

### 4.1 Grandpa Protocol
```typescript
interface GrandpaVote {
  targetHash: string;      // Target block hash
  targetNumber: number;    // Target block number
  stateRoot: string;       // Posterior state root
  signature: string;       // Validator signature
  validatorIndex: number;  // Validator index
}

interface GrandpaCommit {
  targetHash: string;      // Committed block hash
  targetNumber: number;    // Committed block number
  stateRoot: string;       // Posterior state root
  signatures: GrandpaVote[]; // Aggregated signatures
}
```

### 4.2 Beefy Protocol
```typescript
interface BeefyCommitment {
  blockNumber: number;     // Block number
  mmrRoot: string;         // MMR root
  validatorSetId: number;  // Validator set ID
  signatures: string[];    // BLS aggregated signatures
}
```

## 5. Work Package Distribution

### 5.1 Work Package Announcement
```typescript
interface WorkPackageAnnounce {
  packageHash: string;     // Work package hash
  size: number;           // Package size in bytes
  coreId: number;         // Assigned core ID
  deadline: number;       // Processing deadline
}
```

### 5.2 Availability Protocol
```typescript
interface AvailabilityAnnounce {
  packageHash: string;     // Work package hash
  validatorId: string;     // Validator ID
  available: boolean;      // Whether package is available
  proof?: string;         // Optional availability proof
}
```

## 6. Peer Management

### 6.1 Handshake Protocol
```typescript
interface PeerHandshake {
  nodeId: string;          // Node identifier
  validatorKey?: string;   // Validator key (if validator)
  supportedProtocols: string[]; // Supported protocol versions
  capabilities: string[];  // Node capabilities
}

interface HandshakeResponse {
  accepted: boolean;       // Whether handshake accepted
  reason?: string;         // Rejection reason if applicable
  supportedProtocols: string[]; // Supported protocol versions
}
```

## 7. Message Serialization

### 7.1 Gray Paper Compliance
All messages must follow the Gray Paper serialization format:

```typescript
// Header serialization (excluding seal signature)
function serializeUnsignedHeader(header: BlockHeader): Uint8Array {
  // Follow Gray Paper Section 4 (Serialization)
  // Must be deterministic and consistent
}

// Extrinsic serialization
function serializeExtrinsic(extrinsic: Extrinsic): Uint8Array {
  // Follow Gray Paper Section 4
  // Must handle variable-length sequences
}
```

### 7.2 Message Encoding
```typescript
function encodeMessage(message: NetworkMessage): Uint8Array {
  const encoder = new TextEncoder();
  
  // Message header (8 bytes)
  const header = new ArrayBuffer(8);
  const view = new DataView(header);
  view.setUint32(0, message.id.length, false);
  view.setUint8(4, message.type);
  view.setUint16(5, message.payload.length, false);
  view.setUint8(7, message.signature ? 1 : 0);
  
  // Message body
  const body = new Uint8Array([
    ...new Uint8Array(header),
    ...encoder.encode(message.id),
    ...message.payload,
    ...(message.signature ? encoder.encode(message.signature) : [])
  ]);
  
  return body;
}
```

## 8. Network Topology

### 8.1 Peer Discovery
- **Bootstrap nodes**: Hardcoded initial peers
- **DHT-based discovery**: Distributed hash table for peer discovery
- **Validator connections**: Direct connections between validators
- **Light client connections**: Limited connections for light clients

### 8.2 Connection Management
```typescript
interface ConnectionConfig {
  maxPeers: number;        // Maximum peer connections
  maxValidatorPeers: number; // Maximum validator connections
  handshakeTimeout: number; // Handshake timeout (ms)
  pingInterval: number;     // Ping interval (ms)
  pingTimeout: number;      // Ping timeout (ms)
}
```

## 9. Security Considerations

### 9.1 Message Validation
- All messages must be cryptographically validated
- Invalid messages must be rejected immediately
- Rate limiting must be applied to prevent spam

### 9.2 Peer Authentication
- Validator messages must be signed with validator keys
- Node IDs must be verified against validator sets
- Malicious peers must be blacklisted

### 9.3 DoS Protection
- Connection limits per peer
- Message size limits
- Rate limiting on message types
- Timeout handling for slow peers

## 10. Implementation Guidelines

### 10.1 Gray Paper Compliance
- All state transitions must follow Gray Paper equations
- Message validation must use Gray Paper specifications
- Cryptographic operations must use specified primitives

### 10.2 Performance Requirements
- Must handle 500 MB/s bandwidth requirements
- Must support 341 concurrent cores
- Must maintain low latency for consensus messages

### 10.3 Error Handling
- Network errors must not affect consensus safety
- Invalid messages must be logged and rejected
- Connection failures must trigger reconnection logic

## 11. Testing Strategy

### 11.1 Unit Tests
- Message serialization/deserialization
- Cryptographic validation
- State transition compliance

### 11.2 Integration Tests
- Peer discovery and handshake
- Block propagation
- State synchronization

### 11.3 Network Tests
- Multi-node network simulation
- Bandwidth and latency testing
- Fault tolerance testing

## References

- **Gray Paper**: `submodules/graypaper/text/safrole.tex`
- **Serialization**: `submodules/graypaper/text/serialization.tex`
- **Grandpa Protocol**: Stewart 2020
- **Beefy Protocol**: cryptoeprint:2022/1611 