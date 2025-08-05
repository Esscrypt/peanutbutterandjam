# @pbnj/types

Centralized type definitions for the JAM Protocol implementation.

## Overview

This package serves as a single source of truth for all type definitions used across the JAM protocol implementation. It consolidates types from all packages to ensure consistency and reduce duplication.

## Structure

The package is organized into logical modules:

- **`core`** - Fundamental types used throughout the protocol
- **`consensus`** - Safrole consensus protocol types
- **`network`** - Network communication and protocol message types
- **`pvm`** - Polkadot Virtual Machine types
- **`block-authoring`** - Block creation and validation types
- **`cli`** - Command-line interface types
- **`vrf`** - Verifiable Random Function types
- **`codec`** - Data encoding and decoding types
- **`serialization`** - Gray Paper serialization types

## Usage

```typescript
import type { 
  Bytes, 
  BlockHeader, 
  Ticket, 
  PVMState,
  VRFPublicKey 
} from '@pbnj/types'
```

## Migration

All packages have been updated to use this centralized types package. The following packages now depend on `@pbnj/types`:

- `@pbnj/core`
- `@pbnj/safrole`
- `@pbnj/pvm`
- `@pbnj/cli`
- `@pbnj/bandersnatch-vrf`
- `@pbnj/block-authoring`
- `@pbnj/codec`
- `@pbnj/serialization`

## Development

To build the types package:

```bash
cd packages/types
bun run build
```

## Gray Paper Compliance

All types are designed to comply with the Gray Paper specifications. Each module includes references to relevant sections of the Gray Paper where applicable. 