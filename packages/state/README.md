# @pbnj/state

State management and database layer for JAM nodes using PostgreSQL and Drizzle ORM.

## Features

- **Drizzle ORM**: Type-safe database operations with excellent TypeScript support
- **PostgreSQL Integration**: Uses Bun with the `postgres` package for efficient database operations
- **Validator Management**: Store and manage validator information with epoch support
- **Connection Tracking**: Track validator connections and their states
- **Stream Management**: Store stream information for debugging and monitoring
- **Type Safety**: Full TypeScript support with proper type definitions and schema inference
- **Migrations**: Automatic migration generation and management

## Installation

```bash
bun add @pbnj/state
```

## Usage

### Basic Setup

```typescript
import { DatabaseManager, ValidatorStore, type DatabaseConfig } from '@pbnj/state'

// Configure database connection
const dbConfig: DatabaseConfig = {
  host: 'localhost',
  port: 5432,
  database: 'jam_node',
  username: 'postgres',
  password: 'password',
  ssl: false,
  maxConnections: 10
}

// Initialize database
const dbManager = new DatabaseManager(dbConfig)
await dbManager.initialize()

// Create validator store
const validatorStore = new ValidatorStore(dbManager.getDatabase())
```

### Managing Validators

```typescript
// Store validator information
await validatorStore.upsertValidator({
  index: 0,
  publicKey: new Uint8Array(32), // Ed25519 public key
  metadata: {
    index: 0,
    publicKey: new Uint8Array(32),
    endpoint: {
      host: '192.168.1.100',
      port: 30333,
      publicKey: new Uint8Array(32)
    }
  },
  epoch: 1,
  isActive: true
})

// Get validator by index
const validator = await validatorStore.getValidator(0)

// Get all validators for an epoch
const validators = await validatorStore.getValidatorsForEpoch(1)

// Get all active validators
const activeValidators = await validatorStore.getActiveValidators()
```

### Managing Connections

```typescript
// Store connection information
await validatorStore.upsertConnection({
  id: 'conn-123',
  validatorIndex: 0,
  remoteEndpoint: {
    host: '192.168.1.100',
    port: 30333
  },
  state: 'connected',
  connectedAt: new Date(),
  lastActivity: new Date()
})

// Get connection by ID
const connection = await validatorStore.getConnection('conn-123')

// Get all connections for a validator
const connections = await validatorStore.getConnectionsForValidator(0)

// Get all active connections
const activeConnections = await validatorStore.getActiveConnections()
```

### Cleanup

```typescript
// Clean up old connections (older than 7 days)
await validatorStore.cleanupOldConnections(7)

// Close database connection
await dbManager.close()
```

## Database Schema

The package uses Drizzle ORM with the following schema:

### Validators Table

```sql
CREATE TABLE validators (
  index INTEGER PRIMARY KEY,
  public_key TEXT NOT NULL,
  metadata_host TEXT NOT NULL,
  metadata_port INTEGER NOT NULL,
  epoch INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);
```

### Validator Connections Table

```sql
CREATE TABLE validator_connections (
  id TEXT PRIMARY KEY,
  validator_index INTEGER NOT NULL REFERENCES validators(index),
  remote_host TEXT NOT NULL,
  remote_port INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('connecting', 'connected', 'disconnected', 'error')),
  connected_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Streams Table

```sql
CREATE TABLE streams (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  kind INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('initial', 'open', 'closing', 'closed', 'error')),
  is_initiator BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE,
  error TEXT
);
```

## Development

```bash
# Install dependencies
bun install

# Build the package
bun run build

# Generate database migrations
bun run db:generate

# Run migrations
bun run db:migrate

# Open Drizzle Studio (database GUI)
bun run db:studio

# Run tests
bun test

# Development mode
bun run dev
```

## Environment Variables

Set these environment variables for database configuration:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jam_node
DB_USER=postgres
DB_PASSWORD=password
```

## Type Safety

The package provides full TypeScript support with inferred types from the Drizzle schema:

```typescript
import type { Validator, ValidatorConnection, Stream } from '@pbnj/state'

// These types are automatically inferred from the schema
const validator: Validator = {
  index: 0,
  publicKey: 'hex-string',
  metadataHost: '192.168.1.100',
  metadataPort: 30333,
  epoch: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true
}
``` 