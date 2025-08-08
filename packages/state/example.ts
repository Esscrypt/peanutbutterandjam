#!/usr/bin/env bun

import { DatabaseManager, ValidatorStore, type DatabaseConfig } from './src/index'

async function main() {
  // Configure database connection
  const dbConfig: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'jam_node',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: false,
    maxConnections: 10
  }

  console.log('Initializing database...')
  const dbManager = new DatabaseManager(dbConfig)
  await dbManager.initialize()

  console.log('Creating validator store...')
  const validatorStore = new ValidatorStore(dbManager.getDatabase())

  // Example: Store a validator
  console.log('Storing validator information...')
  await validatorStore.upsertValidator({
    index: 0,
    publicKey: new Uint8Array(32).fill(1), // Example public key
    metadata: {
      index: 0,
      publicKey: new Uint8Array(32).fill(2), // Example metadata public key
      endpoint: {
        host: '192.168.1.100',
        port: 30333,
        publicKey: new Uint8Array(32).fill(3) // Example endpoint public key
      }
    },
    epoch: 1,
    isActive: true
  })

  // Example: Store another validator
  await validatorStore.upsertValidator({
    index: 1,
    publicKey: new Uint8Array(32).fill(4),
    metadata: {
      index: 1,
      publicKey: new Uint8Array(32).fill(5),
      endpoint: {
        host: '192.168.1.101',
        port: 30334,
        publicKey: new Uint8Array(32).fill(6)
      }
    },
    epoch: 1,
    isActive: true
  })

  // Example: Retrieve validators
  console.log('Retrieving validators...')
  const validator0 = await validatorStore.getValidator(0)
  console.log('Validator 0:', validator0)

  const activeValidators = await validatorStore.getActiveValidators()
  console.log('Active validators:', activeValidators.length)

  const epochValidators = await validatorStore.getValidatorsForEpoch(1)
  console.log('Epoch 1 validators:', epochValidators.length)

  // Example: Store connection information
  console.log('Storing connection information...')
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

  // Example: Retrieve connection information
  const connection = await validatorStore.getConnection('conn-123')
  console.log('Connection:', connection)

  const activeConnections = await validatorStore.getActiveConnections()
  console.log('Active connections:', activeConnections.length)

  // Cleanup
  console.log('Cleaning up...')
  await validatorStore.deleteConnection('conn-123')
  await dbManager.close()

  console.log('Example completed successfully!')
}

main().catch(console.error) 