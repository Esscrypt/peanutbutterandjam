# JIP-2 Node RPC Server

A boilerplate implementation of the JIP-2 Node RPC specification for JAM nodes, built with Elysia.

## Overview

This RPC server implements the [JIP-2 Node RPC specification](https://docs.jamcha.in/advanced/rpc/jip2-node-rpc) to ensure JAM tooling which relies on being an RPC client is implementation-agnostic.

## Features

- **Full JIP-2 Compliance**: Implements all endpoints from the specification
- **WebSocket Support**: Real-time subscriptions via WebSocket connections
- **Type Safety**: Full TypeScript support with proper type definitions
- **High Performance**: Built with Elysia for optimal performance
- **Structured Logging**: Comprehensive logging with Pino
- **Environment Configuration**: Flexible configuration via environment variables

## Quick Start

### Installation

```bash
cd apis/rpc-server
bun install
```

### Development

```bash
# Start development server with hot reload
bun run start:dev

# Start production server
bun run start
```

### Build

```bash
# Type check
bun run check

# Build binary
bun run build:bin
```

## Configuration

The server can be configured via environment variables:

```bash
# Server configuration
RPC_PORT=19800                    # Port to listen on (default: 19800)
RPC_HOST=0.0.0.0                 # Host to bind to (default: 0.0.0.0)
RPC_CORS_ORIGIN=*                # CORS origin (default: *)

# Rate limiting
RPC_RATE_LIMIT_WINDOW=900000     # Rate limit window in ms (default: 15 minutes)
RPC_RATE_LIMIT_MAX_REQUESTS=1000 # Max requests per window (default: 1000)

# Payload limits
RPC_MAX_PAYLOAD_SIZE=10485760    # Max payload size in Uint8Array (default: 10MB)

# Base environment variables (from @pbnj/core)
NODE_ENV=development             # Environment (development/production)
LOG_LEVEL=info                   # Log level (trace/debug/info/warn/error)
```

## API Endpoints

### HTTP Endpoints

- `GET /health` - Health check endpoint
- `POST /rpc` - JSON-RPC endpoint

### WebSocket Endpoints

- `WS /ws` - WebSocket endpoint for subscriptions

## Supported RPC Methods

### Chain Information
- `parameters` - Returns chain parameters
- `bestBlock` - Returns best block hash and slot
- `finalizedBlock` - Returns finalized block hash and slot
- `parent` - Returns parent block information
- `stateRoot` - Returns state root for a block

### Subscriptions
- `subscribeBestBlock` - Subscribe to best block updates
- `subscribeFinalizedBlock` - Subscribe to finalized block updates
- `subscribeStatistics` - Subscribe to statistics updates
- `subscribeServiceData` - Subscribe to service data updates
- `subscribeServiceValue` - Subscribe to service value updates
- `subscribeServicePreimage` - Subscribe to service preimage updates
- `subscribeServiceRequest` - Subscribe to service request updates

### Statistics
- `statistics` - Returns activity statistics

### Service Data
- `serviceData` - Returns service data for a service ID
- `serviceValue` - Returns service value for a key
- `servicePreimage` - Returns service preimage for a hash
- `serviceRequest` - Returns service request information
- `listServices` - Returns list of all services

### BEEFY
- `beefyRoot` - Returns BEEFY root for a block

### Submissions
- `submitWorkPackage` - Submit a work package
- `submitPreimage` - Submit a preimage

## Example Usage

### HTTP RPC Call

```bash
curl -X POST http://localhost:19800/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "parameters",
    "params": []
  }'
```

### WebSocket Subscription

```javascript
const ws = new WebSocket('ws://localhost:19800/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'subscribeBestBlock',
    params: []
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## Architecture

```
src/
├── index.ts              # Main server entry point
├── config.ts             # Configuration management
├── logger.ts             # Logging setup
├── rpc-handler.ts        # RPC method implementations
├── subscription-manager.ts # WebSocket subscription management
└── types.ts              # TypeScript type definitions
```

## Development

### Adding New Methods

1. Add the method to the `RpcMethod` type in `types.ts`
2. Implement the method in `RpcHandler` class
3. Add appropriate error handling and validation
4. Add tests for the new method

### Testing

```bash
# Run tests (when implemented)
bun test
```

## Notes

- This is a boilerplate implementation with mock data
- In production, replace mock implementations with actual chain queries
- Consider implementing proper authentication and rate limiting
- Add comprehensive error handling and validation
- Implement proper connection pooling for database operations

## License

Private - Part of the PeanutButterAndJam project
