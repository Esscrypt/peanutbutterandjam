import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GenesisManager } from '../src/genesis-manager'
import type { GenesisConfig } from '../src/types'

describe('GenesisManager', () => {
  let tempGenesisPath: string
  let genesisManager: GenesisManager

  beforeEach(() => {
    tempGenesisPath = join(process.cwd(), 'temp-genesis.json')
  })

  afterEach(() => {
    // Clean up temp file
    if (existsSync(tempGenesisPath)) {
      unlinkSync(tempGenesisPath)
    }
  })

  describe('Genesis Loading', () => {
    it('should load genesis from file', async () => {
      const genesisData = createSampleGenesis()
      writeFileSync(tempGenesisPath, JSON.stringify(genesisData, null, 2))

      const config: GenesisConfig = {
        genesisPath: tempGenesisPath,
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireValidators: true,
          requireAccounts: true,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)
      const result = await genesisManager.loadGenesis()

      expect(result.success).toBe(true)
      expect(result.genesisState).toBeDefined()
      expect(result.errors).toHaveLength(0)
      expect(result.genesisState!.state.accounts.size).toBe(3)
      expect(result.genesisState!.state.validators.validators.length).toBe(2)
    })

    it('should create default genesis when no file provided', async () => {
      const config: GenesisConfig = {
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: true,
          requireValidators: false,
          requireAccounts: false,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)
      const result = await genesisManager.loadGenesis()

      expect(result.success).toBe(true)
      expect(result.genesisState).toBeDefined()
      expect(result.genesisState!.genesisBlock.number).toBe(0)
      expect(result.genesisState!.state.accounts.size).toBe(1)
      expect(result.genesisState!.state.validators.validators.length).toBe(1)
    })

    it('should fail when genesis file not found', async () => {
      const config: GenesisConfig = {
        genesisPath: '/nonexistent/genesis.json',
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireValidators: true,
          requireAccounts: true,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)
      const result = await genesisManager.loadGenesis()

      expect(result.success).toBe(false)
      expect(result.genesisState).toBeNull()
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Genesis file not found')
    })
  })

  describe('Genesis Validation', () => {
    it('should validate genesis block number', async () => {
      const genesisData = createSampleGenesis()
      genesisData.genesisBlock.number = 1 // Invalid: should be 0
      writeFileSync(tempGenesisPath, JSON.stringify(genesisData, null, 2))

      const config: GenesisConfig = {
        genesisPath: tempGenesisPath,
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireValidators: true,
          requireAccounts: true,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)
      const result = await genesisManager.loadGenesis()

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Genesis block number must be 0')
    })

    it('should validate validator stakes', async () => {
      const genesisData = createSampleGenesis()
      genesisData.validators[0].stake = '100000000000000000' // Below minimum
      writeFileSync(tempGenesisPath, JSON.stringify(genesisData, null, 2))

      const config: GenesisConfig = {
        genesisPath: tempGenesisPath,
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireValidators: true,
          requireAccounts: true,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)
      const result = await genesisManager.loadGenesis()

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.includes('stake below minimum'))).toBe(
        true,
      )
    })

    it('should validate network configuration', async () => {
      const genesisData = createSampleGenesis()
      genesisData.network.slotDuration = -1 // Invalid: must be positive
      writeFileSync(tempGenesisPath, JSON.stringify(genesisData, null, 2))

      const config: GenesisConfig = {
        genesisPath: tempGenesisPath,
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireValidators: true,
          requireAccounts: true,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)
      const result = await genesisManager.loadGenesis()

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Slot duration must be positive')
    })
  })

  describe('Genesis Export', () => {
    it('should export genesis to file', async () => {
      const genesisData = createSampleGenesis()
      const exportPath = join(process.cwd(), 'exported-genesis.json')

      const config: GenesisConfig = {
        genesisData,
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireValidators: true,
          requireAccounts: true,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)

      // Load genesis first
      const loadResult = await genesisManager.loadGenesis()
      expect(loadResult.success).toBe(true)

      // Export genesis
      await genesisManager.exportGenesis(loadResult.genesisState!, exportPath)

      // Verify file was created
      expect(existsSync(exportPath)).toBe(true)

      // Clean up
      if (existsSync(exportPath)) {
        unlinkSync(exportPath)
      }
    })
  })

  describe('Genesis Parsing', () => {
    it('should parse accounts correctly', async () => {
      const genesisData = createSampleGenesis()
      writeFileSync(tempGenesisPath, JSON.stringify(genesisData, null, 2))

      const config: GenesisConfig = {
        genesisPath: tempGenesisPath,
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireValidators: true,
          requireAccounts: true,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)
      const result = await genesisManager.loadGenesis()

      expect(result.success).toBe(true)
      const genesis = result.genesisState!

      // Check accounts
      const account1 = genesis.state.accounts.get(
        '0x0000000000000000000000000000000000000001',
      )
      expect(account1).toBeDefined()
      expect(account1!.balance).toBe(BigInt('1000000000000000000000'))
      expect(account1!.isValidator).toBe(true)
      expect(account1!.stake).toBe(BigInt('1000000000000000000000'))

      const account3 = genesis.state.accounts.get(
        '0x0000000000000000000000000000000000000003',
      )
      expect(account3).toBeDefined()
      expect(account3!.isValidator).toBe(false)
      expect(account3!.stake).toBeUndefined()
    })

    it('should parse validators correctly', async () => {
      const genesisData = createSampleGenesis()
      writeFileSync(tempGenesisPath, JSON.stringify(genesisData, null, 2))

      const config: GenesisConfig = {
        genesisPath: tempGenesisPath,
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireValidators: true,
          requireAccounts: true,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)
      const result = await genesisManager.loadGenesis()

      expect(result.success).toBe(true)
      const genesis = result.genesisState!

      // Check validators
      expect(genesis.state.validators.validators.length).toBe(2)
      expect(genesis.state.validators.totalStake).toBe(
        BigInt('1500000000000000000000'),
      )
      expect(genesis.state.validators.minStake).toBe(
        BigInt('1000000000000000000'),
      )

      const validator1 = genesis.state.validators.validators[0]
      expect(validator1.address).toBe(
        '0x0000000000000000000000000000000000000001',
      )
      expect(validator1.stake).toBe(BigInt('1000000000000000000000'))
      expect(validator1.isActive).toBe(true)
    })

    it('should parse work packages correctly', async () => {
      const genesisData = createSampleGenesis()
      writeFileSync(tempGenesisPath, JSON.stringify(genesisData, null, 2))

      const config: GenesisConfig = {
        genesisPath: tempGenesisPath,
        validation: {
          validateGenesis: true,
          allowEmptyGenesis: false,
          requireValidators: true,
          requireAccounts: true,
        },
        import: {
          createMissingAccounts: true,
          initializeValidators: true,
          resetExistingState: false,
          backupExistingState: false,
        },
      }

      genesisManager = new GenesisManager(config)
      const result = await genesisManager.loadGenesis()

      expect(result.success).toBe(true)
      const genesis = result.genesisState!

      // Check work packages
      expect(genesis.initialWorkPackages!.length).toBe(1)
      const workPackage = genesis.initialWorkPackages![0]
      expect(workPackage.id).toBe('wp-001')
      expect(workPackage.author).toBe(
        '0x0000000000000000000000000000000000000001',
      )
      expect(workPackage.workItems.length).toBe(1)
    })
  })
})

function createSampleGenesis(): any {
  return {
    genesisBlock: {
      number: 0,
      hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      parentHash:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: 1704067200000,
    },
    accounts: {
      '0x0000000000000000000000000000000000000001': {
        balance: '1000000000000000000000',
        nonce: 0,
        isValidator: true,
        validatorKey:
          '0x0000000000000000000000000000000000000000000000000000000000000001',
        stake: '1000000000000000000000',
      },
      '0x0000000000000000000000000000000000000002': {
        balance: '500000000000000000000',
        nonce: 0,
        isValidator: true,
        validatorKey:
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        stake: '500000000000000000000',
      },
      '0x0000000000000000000000000000000000000003': {
        balance: '100000000000000000000',
        nonce: 0,
        isValidator: false,
      },
    },
    validators: [
      {
        address: '0x0000000000000000000000000000000000000001',
        publicKey:
          '0x0000000000000000000000000000000000000000000000000000000000000001',
        stake: '1000000000000000000000',
        isActive: true,
      },
      {
        address: '0x0000000000000000000000000000000000000002',
        publicKey:
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        stake: '500000000000000000000',
        isActive: true,
      },
    ],
    totalStake: '1500000000000000000000',
    minStake: '1000000000000000000',
    safrole: {
      epoch: 0,
      timeslot: 0,
      entropy:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      tickets: [],
    },
    state: {
      authpool: [],
      recent: [],
      lastAccount: 3,
      stagingset: [],
      activeset: [
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
      ],
      previousset: [],
      reports: [],
      thetime: 1704067200000,
      authqueue: [],
      privileges: {
        '0x0000000000000000000000000000000000000001': 1,
        '0x0000000000000000000000000000000000000002': 1,
      },
      disputes: [],
      activity: {
        '0x0000000000000000000000000000000000000001': 1,
        '0x0000000000000000000000000000000000000002': 1,
      },
      ready: true,
      accumulated: [],
    },
    network: {
      chainId: 'jam-dev',
      protocolVersion: '1.0.0',
      slotDuration: 6000,
      epochLength: 600,
      maxValidators: 100,
      minStake: '1000000000000000000',
    },
    initialWorkPackages: [
      {
        id: 'wp-001',
        data: '0x0102030405060708090a0b0c0d0e0f',
        author: '0x0000000000000000000000000000000000000001',
        timestamp: 1704067200000,
        authToken:
          '0x0000000000000000000000000000000000000000000000000000000000000001',
        authCodeHost: 1,
        authCodeHash:
          '0x0000000000000000000000000000000000000000000000000000000000000001',
        authConfig: '0x',
        context: {
          lookupAnchorTime: 1704067200000,
          coreIndex: 0,
          validatorSet: {
            validators: [
              {
                address: '0x0000000000000000000000000000000000000001',
                publicKey:
                  '0x0000000000000000000000000000000000000000000000000000000000000001',
                stake: '1000000000000000000000',
                isActive: true,
              },
            ],
            totalStake: '1000000000000000000000',
            minStake: '1000000000000000000',
          },
          networkState: {
            chainId: 'jam-dev',
            protocolVersion: '1.0.0',
            slotDuration: 6000,
            epochLength: 600,
            maxValidators: 100,
            minStake: '1000000000000000000',
          },
          timestamp: 1704067200000,
        },
        workItems: [
          {
            serviceIndex: 1,
            codeHash:
              '0x0000000000000000000000000000000000000000000000000000000000000001',
            payload: '0x0102030405060708090a0b0c0d0e0f',
            refGasLimit: 1000000,
            accGasLimit: 1000000,
            exportCount: 1,
            importSegments: [],
            extrinsics: [],
          },
        ],
      },
    ],
    initialExtrinsics: [
      {
        id: 'ext-001',
        data: '0x0102030405060708090a0b0c0d0e0f',
        signature:
          '0x0000000000000000000000000000000000000000000000000000000000000001',
        author: '0x0000000000000000000000000000000000000001',
      },
    ],
  }
}
