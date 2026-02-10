/**
 * Validator Key Service
 *
 * Manages validator key pairs for the JAM node
 * Handles key generation, storage, and retrieval by validator index
 * Supports Bandersnatch, Ed25519, and BLS key types
 */

import {
  generateDevAccountValidatorKeyPair,
  generateValidatorKeyPairFromSeed,
  type Hex,
  hexToBytes,
  signEd25519,
  verifyEd25519,
} from '@pbnjam/core'
import type { Safe, ValidatorCredentials } from '@pbnjam/types'
import { BaseService, safeError, safeResult } from '@pbnjam/types'

/**
 * Validator key pair with all components
 */
export interface ValidatorWallet {
  /** Validator index */
  validatorIndex: bigint
  /** Complete validator key (336 bytes total) */
  validatorKeys: ValidatorCredentials
}

/**
 * Seed configuration for validator key generation
 */
export interface ValidatorSeedConfig {
  /** Validator index */
  validatorIndex: bigint
  /** Ed25519 secret seed */
  ed25519SecretSeed: Hex
  /** Bandersnatch secret seed */
  bandersnatchSecretSeed: Hex
}

/**
 * Validator key service configuration
 */
export interface ValidatorKeyServiceConfig {
  /** Whether to enable dev account support (JIP-5) */
  enableDevAccounts: boolean
  /** Number of dev accounts to generate (default: 6 for Alice, Bob, Carol, David, Eve, Fergie) */
  devAccountCount: number

  /** Optional list of validator seed configurations */
  customSeed?: Hex
}

/**
 * Validator Key Service
 *
 * Manages validator key pairs and provides signing/verification functionality
 * Loads seed and creates keypairs on startup
 * Stores internal map of validator index to keypair
 */
export class KeyPairService extends BaseService {
  private readonly keyPairs: Map<bigint, ValidatorCredentials> = new Map()
  private localKeyPair: ValidatorCredentials | null = null

  private readonly enableDevAccounts: boolean | undefined = undefined
  private readonly devAccountCount: number | undefined = undefined
  private readonly customSeed: Hex | undefined = undefined

  constructor(config: ValidatorKeyServiceConfig) {
    super('KeyPairService')
    this.enableDevAccounts = config.enableDevAccounts
    this.devAccountCount = config.devAccountCount
    this.customSeed = config.customSeed
  }

  start(): Safe<boolean> {
    const [generateValidatorKeysError, _generateValidatorKeysResult] =
      this.generateValidatorKeys(
        this.enableDevAccounts || false,
        this.devAccountCount || 0,
        this.customSeed,
      )
    if (generateValidatorKeysError) {
      return safeError(generateValidatorKeysError)
    }
    return safeResult(true)
  }

  /**
   * Generate dev account key pairs
   */
  private generateDevAccountKeyPairs(devAccountCount: number): Safe<void> {
    for (let i = 0; i < devAccountCount; i++) {
      const validatorIndex = BigInt(i)
      const [keyPairError, keyPairs] = generateDevAccountValidatorKeyPair(i)
      if (keyPairError) {
        return safeError(keyPairError)
      }
      if (!keyPairs) {
        return safeError(new Error('Key pair is undefined'))
      }
      this.keyPairs.set(validatorIndex, keyPairs)
    }
    return safeResult(undefined)
  }

  /**
   * Generate all validator keys
   */
  private generateValidatorKeys(
    enableDevAccounts: boolean,
    devAccountCount: number,
    customSeed?: Hex,
  ): Safe<void> {
    if (enableDevAccounts) {
      const [devAccountError] = this.generateDevAccountKeyPairs(devAccountCount)
      if (devAccountError) {
        return safeError(devAccountError)
      }
    }

    if (customSeed) {
      // Generate from main seed
      const [keyPairError, keyPairs] = generateValidatorKeyPairFromSeed(
        hexToBytes(customSeed),
      )
      if (keyPairError) {
        return safeError(keyPairError)
      }
      this.localKeyPair = keyPairs
    }

    return safeResult(undefined)
  }

  /**
   * Sign message with Ed25519 key for validator
   */
  signMessageWithLoadedValidatorKeyPair(
    validatorIndex: bigint,
    message: Uint8Array,
  ): Safe<Uint8Array> {
    const keyPair = this.keyPairs.get(validatorIndex)
    if (!keyPair) {
      return safeError(
        new Error(`Validator key pair not found for index ${validatorIndex}`),
      )
    }

    return signEd25519(message, keyPair.ed25519KeyPair.privateKey)
  }

  signMessage(message: Uint8Array): Safe<Uint8Array> {
    const localKeyPair = this.localKeyPair
    if (!localKeyPair) {
      return safeError(new Error('Local key pair not found'))
    }
    return signEd25519(message, localKeyPair.ed25519KeyPair.privateKey)
  }

  /**
   * Verify Ed25519 signature for validator
   */
  verifySignature(message: Uint8Array, signature: Uint8Array): Safe<boolean> {
    const keyPair = this.localKeyPair
    if (!keyPair) {
      return safeError(new Error(`Local validator key pair not found`))
    }

    return verifyEd25519(message, signature, keyPair.ed25519KeyPair.publicKey)
  }

  /**
   * Get local key pair
   */
  getLocalKeyPair(): Safe<ValidatorCredentials> {
    if (!this.localKeyPair) {
      return safeError(new Error('Local key pair not found'))
    }
    return safeResult(this.localKeyPair)
  }
}
