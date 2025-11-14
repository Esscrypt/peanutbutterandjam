# JAM Simple Networking Protocol (JAMNP-S) Implementation Plan

## Overview

This document outlines the step-by-step implementation of the JAM Simple Networking Protocol (JAMNP-S) using `@infisical/quic` for QUIC transport and TLS 1.3 for encryption.

## Phase 1: Core Infrastructure Setup

### 1.1 Create Networking Package
- [ ] Create `packages/networking` directory structure
- [ ] Initialize package.json with dependencies
- [ ] Set up TypeScript configuration
- [ ] Add @infisical/quic dependency

### 1.2 Update Types Package
- [ ] Extend network types with JAMNP-S specific interfaces
- [ ] Add certificate types and stream kinds
- [ ] Add protocol message types
- [ ] Add validator set and grid structure types

### 1.3 Core Dependencies
```json
{
  "dependencies": {
    "@pbnj/types": "workspace:*",
    "@pbnj/core": "workspace:*",
    "@pbnj/codec": "workspace:*",
    "@infisical/quic": "^1.0.0",
    "@stablelib/ed25519": "^2.0.1",
    "blakejs": "^1.2.1",
    "zod": "^3.25.76"
  }
}
```

## Phase 2: Cryptographic Infrastructure

### 2.1 Certificate Management
- [ ] Implement X.509 certificate generation with Ed25519 keys
- [ ] Implement alternative name computation from Ed25519 public key
- [ ] Implement certificate validation and verification
- [ ] Implement self-signed certificate creation

### 2.2 TLS 1.3 Integration
- [ ] Integrate TLS 1.3 handshake with certificate authentication
- [ ] Implement Ed25519 signature verification
- [ ] Implement Diffie-Hellman key exchange
- [ ] Implement handshake transcript signing

### 2.3 Key Management
- [ ] Implement Ed25519 key pair generation
- [ ] Implement public key serialization/deserialization
- [ ] Implement key validation and verification

## Phase 3: QUIC Transport Layer

### 3.1 QUIC Connection Management
- [ ] Implement QUIC connection establishment using @infisical/quic
- [ ] Integrate TLS 1.3 with QUIC
- [ ] Implement connection lifecycle management
- [ ] Implement ALPN negotiation (`jamnp-s/0/H` or `jamnp-s/0/H/builder`)

### 3.2 Stream Management
- [ ] Implement bidirectional QUIC stream creation
- [ ] Implement stream kind identification (0-127 for UP, 128+ for CE)
- [ ] Implement stream lifecycle management
- [ ] Implement message framing (32-bit length + content)

### 3.3 Transport Layer
- [ ] Implement IPv6 endpoint handling
- [ ] Implement port management
- [ ] Implement connection multiplexing
- [ ] Implement error handling and recovery

## Phase 4: Protocol Implementations

### 4.1 UP 0: Block Announcement
- [ ] Implement grid-based neighbor detection
- [ ] Implement handshake with known leaves
- [ ] Implement block announcement logic
- [ ] Implement finalized block tracking

### 4.2 CE 128: Block Request
- [ ] Implement ascending/descending block requests
- [ ] Implement block sequence validation
- [ ] Implement finalization checks
- [ ] Implement response formatting

### 4.3 CE 129: State Request
- [ ] Implement state trie range queries
- [ ] Implement boundary node computation
- [ ] Implement key/value pair retrieval
- [ ] Implement size limit enforcement

### 4.4 CE 131/132: Ticket Distribution
- [ ] Implement Safrole ticket generation
- [ ] Implement proxy validator selection
- [ ] Implement ticket verification
- [ ] Implement distribution timing

### 4.5 CE 133: Work Package Submission
- [ ] Implement builder to guarantor communication
- [ ] Implement work package validation
- [ ] Implement extrinsic data handling
- [ ] Implement submission acknowledgment

### 4.6 CE 134: Work Package Sharing
- [ ] Implement guarantor to guarantor communication
- [ ] Implement work package bundle sharing
- [ ] Implement refinement logic
- [ ] Implement signature generation

### 4.7 CE 135: Work Report Distribution
- [ ] Implement guaranteed work report creation
- [ ] Implement validator set distribution
- [ ] Implement timing coordination
- [ ] Implement block inclusion optimization

### 4.8 CE 136: Work Report Request
- [ ] Implement auditor to auditor communication
- [ ] Implement missing report detection
- [ ] Implement report retrieval
- [ ] Implement negative judgment handling

### 4.9 CE 137: Shard Distribution
- [ ] Implement erasure coding shard assignment
- [ ] Implement shard request handling
- [ ] Implement justification generation
- [ ] Implement co-path computation

### 4.10 CE 138: Audit Shard Request
- [ ] Implement auditor to assurer communication
- [ ] Implement bundle shard requests
- [ ] Implement justification verification
- [ ] Implement audit support

### 4.11 CE 139/140: Segment Shard Request
- [ ] Implement guarantor to assurer communication
- [ ] Implement import segment retrieval
- [ ] Implement justification variants
- [ ] Implement error recovery

### 4.12 CE 141: Assurance Distribution
- [ ] Implement availability assurance creation
- [ ] Implement block author targeting
- [ ] Implement timing coordination
- [ ] Implement epoch transition handling

### 4.13 CE 142: Preimage Announcement
- [ ] Implement preimage possession announcement
- [ ] Implement service ID handling
- [ ] Implement grid-based propagation
- [ ] Implement connection management

### 4.14 CE 143: Preimage Request
- [ ] Implement preimage retrieval
- [ ] Implement hash validation
- [ ] Implement database integration
- [ ] Implement response handling

### 4.15 CE 144: Audit Announcement
- [ ] Implement audit intent broadcasting
- [ ] Implement tranche management
- [ ] Implement evidence collection
- [ ] Implement no-show tracking

### 4.16 CE 145: Judgment Publication
- [ ] Implement judgment broadcasting
- [ ] Implement validity declaration
- [ ] Implement signature verification
- [ ] Implement dispute resolution

## Phase 5: Peer Management

### 5.1 Validator Set Management
- [ ] Implement current/previous/next epoch validator tracking
- [ ] Implement IPv6 endpoint extraction
- [ ] Implement port management
- [ ] Implement validator metadata handling

### 5.2 Peer Discovery
- [ ] Implement validator discovery
- [ ] Implement connection establishment
- [ ] Implement preferred initiator logic
- [ ] Implement builder slot management

### 5.3 Peer Manager
- [ ] Implement connection lifecycle management
- [ ] Implement peer state tracking
- [ ] Implement connection limits
- [ ] Implement health monitoring

## Phase 6: Node Implementation

### 6.1 Network Server
- [ ] Implement QUIC server setup
- [ ] Implement connection acceptance
- [ ] Implement stream handling
- [ ] Implement protocol routing

### 6.2 Network Client
- [ ] Implement QUIC client setup
- [ ] Implement connection initiation
- [ ] Implement stream creation
- [ ] Implement protocol invocation

### 6.3 Grid Structure
- [ ] Implement validator grid computation
- [ ] Implement neighbor detection
- [ ] Implement row/column calculations
- [ ] Implement cross-epoch connections

## Phase 7: Utilities and Helpers

### 7.1 ALPN Utilities
- [ ] Implement protocol identifier generation
- [ ] Implement version handling
- [ ] Implement chain hash integration
- [ ] Implement builder suffix support

### 7.2 Alternative Name Computation
- [ ] Implement Ed25519 key to name conversion
- [ ] Implement base32 encoding
- [ ] Implement mathematical formula implementation
- [ ] Implement validation

### 7.3 Connectivity Management
- [ ] Implement epoch transition handling
- [ ] Implement connection timing
- [ ] Implement preferred initiator logic
- [ ] Implement builder slot management

## Phase 8: Integration Points

### 8.1 Core Package Integration
- [ ] Update packages/core to use networking package
- [ ] Add networking service registration
- [ ] Integrate with existing services

### 8.2 CLI Integration
- [ ] Update packages/cli to support networking commands
- [ ] Add network status commands
- [ ] Add peer management commands

### 8.3 Block Authoring Integration
- [ ] Update infra/block-authoring to use networking
- [ ] Integrate block announcement
- [ ] Add work package submission

## Phase 9: Testing Strategy

### 9.1 Unit Tests
- [ ] Crypto functionality tests
- [ ] Protocol message tests
- [ ] Stream management tests
- [ ] Peer management tests

### 9.2 Integration Tests
- [ ] End-to-end protocol tests
- [ ] Multi-node communication tests
- [ ] Epoch transition tests
- [ ] Error handling tests

### 9.3 Performance Tests
- [ ] Connection scalability tests
- [ ] Message throughput tests
- [ ] Memory usage tests
- [ ] Latency measurements

## Implementation Priority

### High Priority (Core Infrastructure)
1. QUIC transport layer with @infisical/quic
2. TLS 1.3 integration
3. Certificate management
4. Basic peer management

### Medium Priority (Essential Protocols)
1. UP 0: Block announcement
2. CE 128: Block request
3. CE 129: State request
4. CE 133: Work package submission

### Lower Priority (Advanced Protocols)
1. CE 131-132: Ticket distribution
2. CE 134-136: Work package sharing
3. CE 137-140: Shard management
4. CE 141-145: Audit and judgment

## Current Status

- [x] Implementation plan created
- [x] Phase 1: Core Infrastructure Setup (Completed)
  - [x] Create networking package structure
  - [x] Initialize package.json with dependencies
  - [x] Set up TypeScript configuration
  - [x] Add @infisical/quic dependency
  - [x] Extend network types with JAMNP-S specific interfaces
  - [x] Add certificate types and stream kinds
  - [x] Add protocol message types
  - [x] Add validator set and grid structure types
- [x] Phase 2: Cryptographic Infrastructure (Completed)
  - [x] Implement X.509 certificate generation with Ed25519 keys
  - [x] Implement alternative name computation from Ed25519 public key
  - [x] Implement certificate validation and verification
  - [x] Implement self-signed certificate creation
  - [x] Integrate TLS 1.3 handshake with certificate authentication
  - [x] Implement Ed25519 signature verification
  - [x] Implement Diffie-Hellman key exchange
  - [x] Implement handshake transcript signing
  - [x] Implement Ed25519 key pair generation
  - [x] Implement public key serialization/deserialization
  - [x] Implement key validation and verification
- [x] Phase 3: QUIC Transport Layer (Completed)
  - [x] Implement QUIC connection establishment using @infisical/quic
  - [x] Integrate TLS 1.3 with QUIC
  - [x] Implement connection lifecycle management
  - [x] Implement ALPN negotiation (`jamnp-s/0/H` or `jamnp-s/0/H/builder`)
  - [x] Implement bidirectional QUIC stream creation
  - [x] Implement stream kind identification (0-127 for UP, 128+ for CE)
  - [x] Implement stream lifecycle management
  - [x] Implement message framing (32-bit length + content)
  - [x] Implement IPv6 endpoint handling
  - [x] Implement port management
  - [x] Implement connection multiplexing
  - [x] Implement error handling and recovery
- [x] Phase 9: Testing Strategy (Completed)
  - [x] Basic unit tests for crypto functionality
  - [x] Basic unit tests for protocol message tests
  - [x] Basic unit tests for stream management tests
  - [x] All tests passing (10/10)
- [x] Phase 4: Protocol Implementations (Completed - Core Protocols)
  - [x] UP 0: Block Announcement - Grid-based neighbor detection and block propagation
  - [x] CE 128: Block Request - Ascending/descending block requests with finalization checks
  - [x] CE 129: State Request - State trie range queries with boundary node computation
  - [x] CE 133: Work Package Submission - Builder to guarantor communication
  - [x] CE 131-132: Ticket Distribution - Placeholder implementation
  - [x] CE 134: Work Package Sharing - Placeholder implementation
  - [x] CE 135: Work Report Distribution - Placeholder implementation
  - [x] CE 136: Work Report Request - Placeholder implementation
  - [x] CE 137: Shard Distribution - Placeholder implementation
  - [x] CE 138: Audit Shard Request - Placeholder implementation
  - [x] CE 139-140: Segment Shard Request - Placeholder implementation
  - [x] CE 141: Assurance Distribution - Placeholder implementation
  - [x] CE 142: Preimage Announcement - Placeholder implementation
  - [x] CE 143: Preimage Request - Placeholder implementation
  - [x] CE 144: Audit Announcement - Placeholder implementation
  - [x] CE 145: Judgment Publication - Placeholder implementation
- [x] Phase 5: Peer Management (Completed)
  - [x] Validator Set Management - Current/previous/next epoch tracking with epoch transitions
  - [x] Grid Structure Computation - Optimal grid dimensions and neighbor detection
  - [x] Peer Discovery - Connection tracking, preferred initiator logic, retry mechanisms
  - [x] Connection Manager - QUIC connection lifecycle, stream management, event handling
  - [x] Builder Slots Management - Slot assignment, load balancing, connection tracking
- [ ] Phase 6: Node Implementation (Next)
- [ ] Phase 7: Utilities and Helpers
- [ ] Phase 8: Integration Points

## Next Steps

1. Create networking package structure
2. Install @infisical/quic dependency
3. Update types package with JAMNP-S types
4. Implement basic QUIC connection management
5. Implement certificate management
6. Implement first protocol (UP 0: Block Announcement)

## Notes

- Using @infisical/quic for QUIC transport layer
- TLS 1.3 integration required for encryption
- Ed25519 keys for certificate authentication
- 15 different stream protocols to implement
- Grid-based validator connectivity
- Epoch-based connection management 