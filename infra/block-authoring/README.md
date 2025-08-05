# @pbnj/block-authoring

Block authoring service for JAM Protocol implementation.

## Overview

This package provides a comprehensive block authoring service that handles block creation, validation, and submission according to the JAM Protocol Gray Paper specifications.

## Features

- **Block Header Construction**: Creates valid block headers with all required components
- **Extrinsic Validation**: Validates extrinsics before inclusion in blocks
- **Work Package Processing**: Processes work packages and generates work reports
- **State Management**: Manages state transitions and validation
- **Block Submission**: Submits blocks to the network with retry logic
- **Performance Metrics**: Collects and tracks performance metrics
- **Safrole Integration**: Integrates with the Safrole consensus mechanism
- **Genesis Management**: Load, validate, and import genesis.json files for initialization

## Installation

```bash
npm install @pbnj/block-authoring
```

## Usage

### Basic Usage

```typescript
import { BlockAuthoringServiceImpl } from '@pbnj/block-authoring'
import type { BlockAuthoringConfig, BlockAuthoringContext, GenesisConfig } from '@pbnj/block-authoring'

// Configure the service
const config: BlockAuthoringConfig = {
  networkId: 'mainnet',
  validatorKey: 'your-validator-key',
  slotDuration: 6, // 6 seconds
  epochLength: 600, // 600 slots
  maxExtrinsicsPerBlock: 100,
  maxWorkPackagesPerBlock: 10,
  enableStrictValidation: true,
  enableAuditMode: false,
  enableSafroleValidation: true,
  enableGrandpaFinalization: true
}

const service = new BlockAuthoringServiceImpl()
service.configure(config)

// Create a block
const context: BlockAuthoringContext = {
  parentHeader: parentBlockHeader,
  parentState: currentState,
  currentTimeslot: currentSlot,
  validatorSet: validatorSet,
  authorIndex: authorIndex,
  extrinsics: pendingExtrinsics,
  workPackages: pendingWorkPackages,
  networkState: networkState
}

// Initialize genesis state
const genesisConfig: GenesisConfig = {
  genesisPath: './genesis.json',
  validation: {
    validateGenesis: true,
    allowEmptyGenesis: false,
    requireValidators: true,
    requireAccounts: true
  },
  import: {
    createMissingAccounts: true,
    initializeValidators: true,
    resetExistingState: false,
    backupExistingState: true
  }
}

const genesisInitialized = await service.initializeGenesis(genesisConfig)
if (!genesisInitialized) {
  console.error('Failed to initialize genesis')
  return
}

const result = await service.createBlock(context)

if (result.success) {
  console.log('Block created successfully:', result.block)
  console.log('Block hash:', result.blockHash)
} else {
  console.error('Block creation failed:', result.error)
}
```

### Advanced Usage

```typescript
// Individual component usage
import { 
  HeaderConstructor,
  ExtrinsicValidator,
  WorkPackageProcessor,
  StateManager,
  BlockSubmitter
} from '@pbnj/block-authoring'

// Validate extrinsics
const validator = new ExtrinsicValidator()
const validationResult = await validator.validate(extrinsics, config)

// Process work packages
const processor = new WorkPackageProcessor()
const workReports = await processor.process(workPackages, config)

// Construct header
const headerConstructor = new HeaderConstructor()
const header = await headerConstructor.construct(parentHeader, extrinsics, config)

// Submit block
const submitter = new BlockSubmitter()
const submissionResult = await submitter.submit(block, config)

// Genesis Management
import { GenesisManager } from '@pbnj/block-authoring'

// Load genesis from file
const genesisManager = new GenesisManager({
  genesisPath: './genesis.json',
  validation: {
    validateGenesis: true,
    allowEmptyGenesis: false,
    requireValidators: true,
    requireAccounts: true
  },
  import: {
    createMissingAccounts: true,
    initializeValidators: true,
    resetExistingState: false,
    backupExistingState: true
  }
})

const genesisResult = await genesisManager.loadGenesis()
if (genesisResult.success) {
  console.log('Genesis loaded successfully')
  console.log('Accounts:', genesisResult.genesisState!.state.accounts.size)
  console.log('Validators:', genesisResult.genesisState!.state.validators.validators.length)
} else {
  console.error('Genesis loading failed:', genesisResult.errors)
}

// Export genesis to file
await genesisManager.exportGenesis(genesisResult.genesisState!, './exported-genesis.json')
```

## Genesis File Format

The block authoring service supports loading genesis state from JSON files. Here's the expected format:

```json
{
  "genesisBlock": {
    "number": 0,
    "hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "timestamp": 1704067200000
  },
  "accounts": {
    "0x0000000000000000000000000000000000000001": {
      "balance": "1000000000000000000000",
      "nonce": 0,
      "isValidator": true,
      "validatorKey": "0x0000000000000000000000000000000000000000000000000000000000000001",
      "stake": "1000000000000000000000"
    }
  },
  "validators": [
    {
      "address": "0x0000000000000000000000000000000000000001",
      "publicKey": "0x0000000000000000000000000000000000000000000000000000000000000001",
      "stake": "1000000000000000000000",
      "isActive": true
    }
  ],
  "network": {
    "chainId": "jam-dev",
    "protocolVersion": "1.0.0",
    "slotDuration": 6000,
    "epochLength": 600,
    "maxValidators": 100,
    "minStake": "1000000000000000000"
  },
  "initialWorkPackages": [],
  "initialExtrinsics": []
}
```

### Genesis Validation

The service validates genesis files for:
- Genesis block number must be 0
- Genesis block parent hash must be zero
- Validator stakes must meet minimum requirements
- Network configuration must be valid
- Required accounts and validators (if specified)

## Architecture

The block authoring service is composed of several specialized components:

### Core Components

- **BlockAuthoringServiceImpl**: Main service orchestrating all operations
- **HeaderConstructor**: Constructs valid block headers
- **ExtrinsicValidator**: Validates extrinsics before inclusion
- **WorkPackageProcessor**: Processes work packages and generates reports
- **StateManager**: Manages state transitions and validation
- **BlockSubmitter**: Handles block submission and propagation
- **MetricsCollector**: Collects performance metrics

### Integration Points

- **@pbnj/safrole**: Consensus and ticket validation
- **@pbnj/serialization**: Block header serialization
- **@pbnj/pvm**: Work package execution
- **@pbnj/bandersnatch-vrf**: VRF operations
- **@pbnj/core**: Types and utilities

## Configuration

### BlockAuthoringConfig

```typescript
interface BlockAuthoringConfig {
  // Network settings
  networkId: string
  validatorKey: string
  
  // Timing settings
  slotDuration: number // 6 seconds
  epochLength: number // 600 slots
  
  // Performance settings
  maxExtrinsicsPerBlock: number
  maxWorkPackagesPerBlock: number
  
  // Validation settings
  enableStrictValidation: boolean
  enableAuditMode: boolean
  
  // Consensus settings
  enableSafroleValidation: boolean
  enableGrandpaFinalization: boolean
}
```

## API Reference

### BlockAuthoringService

```typescript
interface BlockAuthoringService {
  // Configuration
  configure(config: BlockAuthoringConfig): void
  
  // Block creation
  createBlock(context: BlockAuthoringContext): Promise<BlockAuthoringResult>
  
  // Header management
  constructHeader(parent: BlockHeader, extrinsics: Extrinsic[]): Promise<BlockHeader>
  
  // Work package handling
  processWorkPackages(packages: WorkPackage[]): Promise<WorkReport[]>
  
  // Extrinsic management
  validateExtrinsics(extrinsics: Extrinsic[]): Promise<ValidationResult>
  
  // State management
  updateState(block: Block): Promise<State>
  
  // Submission
  submitBlock(block: Block): Promise<SubmissionResult>
  
  // Utility methods
  getMetrics(): BlockAuthoringMetrics
  resetMetrics(): void
}
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Development

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run check
```

### Linting

```bash
npm run lint
```

## Gray Paper Compliance

This implementation follows the JAM Protocol Gray Paper specifications:

- **Block Structure**: Implements block header and body according to Section 2
- **Safrole Consensus**: Integrates with Safrole consensus mechanism (Section 3)
- **Work Packages**: Processes work packages and reports (Section 4)
- **State Transitions**: Implements state transition functions (Section 5)
- **Extrinsic Handling**: Validates and processes extrinsics (Section 6)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details. 