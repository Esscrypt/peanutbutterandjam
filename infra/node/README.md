# JAM Node - Service Architecture

This directory contains the JAM node implementation with a standardized service architecture that provides polymorphic service management through a centralized registry.

# Running Node:
```
bun run infra/node/services/main-service.ts --validator-index 0 --chain config/spec-tiny.json
```

## Architecture Overview

The JAM node uses a service-oriented architecture where all components implement a common `Service` interface and are managed through a `ServiceRegistry`. This provides:

- **Standardized lifecycle**: All services have `init()`, `start()`, and `stop()` methods
- **Polymorphic management**: Services are managed uniformly through the registry
- **Centralized orchestration**: The `MainService` coordinates all other services
- **Graceful shutdown**: Proper cleanup and shutdown handling

## Service Interface

All services implement the `Service` interface:

```typescript
interface Service {
  readonly name: string
  init(): Promise<void>
  start(): Promise<boolean>
  stop(): Promise<void>
  getStatus(): ServiceStatus
}
```

## Service Registry

The `ServiceRegistry` manages all services and provides:

- Service registration and retrieval
- Bulk initialization, starting, and stopping
- Status monitoring
- Dependency management

## Main Service

The `MainServiceImpl` serves as the entry point and orchestrates all other services:

- Manages the service registry
- Provides the application lifecycle (`run()`, `shutdown()`)
- Handles graceful shutdown on signals (SIGINT, SIGTERM)
- Monitors service health

## Services

### Core Services
- **BlockAuthoringService**: Creates and validates blocks
- **NetworkingService**: Handles peer-to-peer communication
- **MetricsCollector**: Collects performance metrics
- **StateManager**: Manages blockchain state
- **WorkPackageProcessor**: Processes work packages

### Supporting Services
- **BlockSubmitter**: Submits blocks to the network
- **ExtrinsicValidator**: Validates extrinsics
- **GenesisManager**: Manages genesis state
- **HeaderConstructor**: Constructs block headers

## Usage

### Running the Node

```bash
# Set environment variables
export NODE_ID="jam-node-1"
export VALIDATOR_INDEX="0"
export NODE_TYPE="validator"
export LISTEN_ADDRESS="0.0.0.0"
export LISTEN_PORT="30333"
export CHAIN_HASH="0x0000000000000000000000000000000000000000000000000000000000000000"

# Run the node
node dist/index.js
```

### Programmatic Usage

```typescript
import { MainServiceImpl } from './main-service'
import type { MainServiceConfig } from './main-service'

const config: MainServiceConfig = {
  blockAuthoring: {
    maxBlockSize: 1024 * 1024,
    maxExtrinsicsPerBlock: 1000,
    blockTime: 6000,
    enableMetrics: true,
  },
  genesis: {
    chainSpecPath: './chain-spec.json',
  },
  networking: {
    validatorIndex: 0,
    nodeType: 'validator',
    chainHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  },
  nodeId: 'jam-node-1',
}

const mainService = new MainServiceImpl(config)
await mainService.run()
```

## Service Health Monitoring

The service registry provides status monitoring:

```typescript
const registry = mainService.getRegistry()
const status = registry.getAllStatus()
const allRunning = registry.areAllRunning()
```

## Graceful Shutdown

The node handles graceful shutdown automatically:

- SIGINT (Ctrl+C) triggers graceful shutdown
- SIGTERM triggers graceful shutdown
- All services are stopped in reverse dependency order
- Uncaught exceptions and unhandled rejections are logged and exit the process

## Development

### Building

```bash
bun run build
```

### Testing

```bash
bun run test
```

### Running in Development

```bash
bun run dev
``` 
