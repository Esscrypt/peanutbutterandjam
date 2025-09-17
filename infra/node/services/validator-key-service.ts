/**
 * Validator Key Service
 *
 * Manages validator key pairs for the JAM node
 * Handles key generation, storage, and retrieval by validator index
 * Supports Bandersnatch, Ed25519, and BLS key types
 */

import {
  generateDevAccountValidatorKeyPair,
  type Hex,
  hexToBytes,
  logger,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
  signEd25519,
  verifyEd25519,
} from '@pbnj/core'
import type { ValidatorPublicKeys } from '@pbnj/types'
import { BaseService } from '../interfaces/service'

/**
 * Validator key pair with all components
 */
export interface ValidatorWallet {
  /** Validator index */
  validatorIndex: bigint
  /** Complete validator key (336 bytes total) */
  validatorKey: ValidatorPublicKeys
  /** Core validator key pair with all cryptographic keys */
  seed: Uint8Array
}

/**
 * Validator key service configuration
 */
export interface ValidatorKeyServiceConfig {
  /** Seed for deterministic key generation */
  seed?: string
  /** Number of validators to generate keys for */
  validatorCount?: number
  /** Whether to enable dev account support (JIP-5) */
  enableDevAccounts?: boolean
  /** Number of dev accounts to generate (default: 6 for Alice, Bob, Carol, David, Eve, Fergie) */
  devAccountCount?: number
}

/**
 * Validator Key Service
 *
 * Manages validator key pairs and provides signing/verification functionality
 * Loads seed and creates keypairs on startup
 * Stores internal map of validator index to keypair
 */
export class ValidatorKeyService extends BaseService {
  private keyPairs: Map<bigint, ValidatorWallet> = new Map()
  private config: ValidatorKeyServiceConfig

  constructor(config: ValidatorKeyServiceConfig = {}) {
    super('ValidatorKeyService')
    this.config = {
      seed: process.env['VALIDATOR_SEED'] || 'default-validator-seed',
      validatorCount: Number.parseInt(process.env['VALIDATOR_COUNT'] || '10'),
      enableDevAccounts: false,
      devAccountCount: 6,
      ...config,
    }
  }

  /**
   * Initialize the service and generate validator keys
   */
  async init(): SafePromise<boolean> {
    try {
      logger.info('Initializing validator key service', {
        seed: this.config.seed ? '***' : 'none',
        validatorCount: this.config.validatorCount,
      })

      // Generate validator keys
      await this.generateValidatorKeys()

      logger.info('Validator key service initialized', {
        keyCount: this.keyPairs.size,
      })

      this.setInitialized(true)
      return safeResult(true)
    } catch (error) {
      logger.error('Failed to initialize validator key service', { error })
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  /**
   * Start the service
   */
  async start(): SafePromise<boolean> {
    if (!this.initialized) {
      return safeError(new Error('Service not initialized'))
    }

    logger.info('Starting validator key service')
    this.setRunning(true)
    return safeResult(true)
  }

  /**
   * Stop the service
   */
  async stop(): SafePromise<boolean> {
    logger.info('Stopping validator key service')
    this.setRunning(false)
    return safeResult(true)
  }

  /**
   * Get service status with key count
   */
  getStatus() {
    return {
      ...super.getStatus(),
      details: {
        keyCount: this.keyPairs.size,
        validatorCount: this.config.validatorCount,
      },
    }
  }

  /**
   * Generate all validator keys
   */
  private async generateValidatorKeys(): Promise<void> {
    const {
      // validatorCount,
      // seed,
      enableDevAccounts,
      devAccountCount,
    } = this.config

    if (enableDevAccounts) {
      // Generate dev accounts according to JIP-5
      for (let i = 0; i < (devAccountCount ?? 6); i++) {
        const validatorIndex = BigInt(i)
        const [keyPairError, keyPair] =
          await generateDevAccountValidatorKeyPair(i)
        if (keyPairError) {
          logger.error('Failed to generate dev account key pair', {
            validatorIndex: i,
            error: keyPairError,
          })
          continue
        }
        if (!keyPair) {
          logger.error('Failed to generate dev account key pair', {
            validatorIndex: i,
            error: 'Key pair is undefined',
          })
          continue
        }
        this.keyPairs.set(validatorIndex, {
          validatorIndex,
          validatorKey: keyPair,
          seed: new Uint8Array(32),
        })

        logger.debug('Generated dev account key pair', {
          validatorIndex: i,
          name: this.getDevAccountName(i),
        })
      }
    } else {
      // Generate regular validator keys
      // TODO: generate validator key pairs based on seed from file or passkey etc
      // for (let i = 0; i < (validatorCount ?? 10); i++) {
      //   const validatorIndex = BigInt(i)
      //   const keyPair = await this.generateValidatorKeyPair(
      //     validatorIndex,
      //     seed,
      //   )
      //   this.keyPairs.set(validatorIndex, keyPair)
      // }
    }

    logger.info('Generated validator keys', {
      count: this.keyPairs.size,
      indices: Array.from(this.keyPairs.keys()),
      devAccountsEnabled: enableDevAccounts,
    })
  }

  /**
   * Generate a single validator key pair
   */
  private walletToPublicKeys(
    validatorWallet: ValidatorWallet,
  ): Safe<ValidatorPublicKeys> {
    return safeResult({
      bandersnatch: validatorWallet.validatorKey.bandersnatch,
      ed25519: validatorWallet.validatorKey.ed25519,
      bls: validatorWallet.validatorKey.bls,
      metadata: validatorWallet.validatorKey.metadata,
    })
  }

  /**
   * Get validator key by index
   */
  getValidatorKey(validatorIndex: bigint): Safe<ValidatorPublicKeys> {
    const keyPair = this.keyPairs.get(validatorIndex)
    if (!keyPair) {
      return safeError(
        new Error(`Validator key pair not found for index ${validatorIndex}`),
      )
    }
    return this.walletToPublicKeys(keyPair)
  }

  /**
   * Sign message with Ed25519 key for validator
   */
  signMessage(validatorIndex: bigint, message: Uint8Array): Safe<Uint8Array> {
    const keyPair = this.keyPairs.get(validatorIndex)
    if (!keyPair) {
      return safeError(
        new Error(`Validator key pair not found for index ${validatorIndex}`),
      )
    }

    return signEd25519(hexToBytes(keyPair.validatorKey.ed25519), message)
  }

  /**
   * Verify Ed25519 signature for validator
   */
  verifySignature(
    validatorIndex: bigint,
    message: Uint8Array,
    signature: Uint8Array,
  ): Safe<boolean> {
    const keyPair = this.keyPairs.get(validatorIndex)
    if (!keyPair) {
      return safeError(
        new Error(`Validator key pair not found for index ${validatorIndex}`),
      )
    }

    return verifyEd25519(
      message,
      signature,
      hexToBytes(keyPair.validatorKey.ed25519),
    )
  }

  /**
   * Get Ed25519 public key for validator
   */
  getEd25519PublicKey(validatorIndex: bigint): Hex | undefined {
    const keyPair = this.keyPairs.get(validatorIndex)
    return keyPair?.validatorKey.ed25519
  }

  /**
   * Get Bandersnatch public key for validator
   */
  getBandersnatchPublicKey(validatorIndex: bigint): Hex | undefined {
    const keyPair = this.keyPairs.get(validatorIndex)
    return keyPair?.validatorKey.bandersnatch
  }

  /**
   * Get BLS public key for validator
   */
  getBLSPublicKey(validatorIndex: bigint): Hex | undefined {
    const keyPair = this.keyPairs.get(validatorIndex)
    return keyPair?.validatorKey.bls
  }

  /**
   * Get dev account name by index
   */
  private getDevAccountName(index: number): string {
    const names = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Fergie']
    return names[index] || `DevAccount${index}`
  }
}
