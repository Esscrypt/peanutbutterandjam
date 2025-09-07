/**
 * Genesis Manager Implementation
 *
 * Handles loading chain-spec.json files and building Gray Paper compliant
 * GenesisState. Provides complete chain spec to genesis state conversion.
 */

import { readFile } from 'node:fs/promises'
import type {
  Hex,
  ChainSpec as ZodChainSpec,
  ChainSpecConfig as ZodChainSpecConfig,
  ChainSpecJson as ZodChainSpecJson,
} from '@pbnj/core'
import { isChainSpecConfig, logger, parseChainSpec } from '@pbnj/core'
import type {
  ChainSpec,
  ChainSpecParserOptions,
  GenesisBuilderOptions,
  GenesisConfig,
  GenesisError,
  GenesisResult,
  GenesisState,
  GenesisStateInitializers,
  ValidatorKey,
} from '@pbnj/types'

// Helper methods merged into main class

/**
 * Default genesis builder options
 */
const DEFAULT_BUILDER_OPTIONS: GenesisBuilderOptions = {
  initializeEmpty: true,
  validateConsistency: true,
  strictCompliance: true,
}

/**
 * Genesis Manager Implementation
 */
export class GenesisManagerImpl {
  private readonly builderOptions: GenesisBuilderOptions
  private readonly initializers: GenesisStateInitializers

  constructor(
    _parserOptions: Partial<ChainSpecParserOptions> = {},
    builderOptions: Partial<GenesisBuilderOptions> = {},
  ) {
    this.builderOptions = { ...DEFAULT_BUILDER_OPTIONS, ...builderOptions }
    this.initializers = this.createStateInitializers()
  }

  /**
   * Load and parse chain-spec.json file (returns Zod-validated input)
   */
  async loadChainSpec(filePath: string): Promise<ZodChainSpec> {
    try {
      const content = await readFile(filePath, 'utf8')
      const result = parseChainSpec(content)

      if (!result.success) {
        throw new Error(result.error)
      }

      logger.debug('Chain spec loaded successfully', {
        path: filePath,
        chainId: result.data.id,
        format: isChainSpecConfig(result.data) ? 'config' : 'full',
      })

      return result.data
    } catch (error) {
      throw new Error(`Failed to load chain spec from ${filePath}: ${error}`)
    }
  }

  /**
   * Normalize chain spec to internal config format
   */
  normalizeChainSpec(chainSpec: ZodChainSpec): GenesisConfig {
    // Handle both config and full formats
    if (isChainSpecConfig(chainSpec)) {
      return this.normalizeFromConfig(chainSpec)
    } else {
      return this.normalizeFromJson(chainSpec)
    }
  }

  /**
   * Normalize from config format (has genesis_validators)
   */
  private normalizeFromConfig(chainSpec: ZodChainSpecConfig): GenesisConfig {
    const validators = chainSpec.genesis_validators || []
    const accounts = chainSpec.accounts || []

    return {
      chain: {
        id: chainSpec.id,
        name: chainSpec.name || chainSpec.id,
        protocolVersion: '1.0.0',
        bootnodes: [],
      },
      time: {
        genesisTime: 0n,
        slotDuration: 6n,
        epochLength: 600n,
      },
      validators: {
        validators: validators.map((v) => ({
          validatorKey: this.parseValidatorKeyFromConfig(v),
          address: this.generateValidatorAddress(v.validator_index),
          index: BigInt(v.validator_index),
          name: `validator-${v.validator_index}`,
          network: {
            peerId: v.peer_id,
            address: v.net_addr,
          },
        })),
        maxValidators: BigInt(validators.length),
      },
      accounts: {
        services: accounts
          .filter((a) => !a.isValidator)
          .map((a, index) => ({
            index: BigInt(index),
            address: a.address,
            balance: a.balance,
            minBalance: 0n,
            nonce: BigInt(a.nonce),
          })),
      },
      safrole: {
        entropy: `0x${'00'.repeat(32)}` as Hex,
        epochRoot: `0x${'00'.repeat(32)}` as Hex,
        ticketAccumulator: [],
        pendingSet: validators.map((v) => this.parseValidatorKeyFromConfig(v)),
      },
      system: {
        coreCount: 16n,
        coreAssignments: new Map(),
        privileges: {
          manager: 0n,
          assigners: [],
          delegator: 0n,
          registrar: 0n,
          alwaysAccessors: [],
        },
      },
    }
  }

  /**
   * Normalize from full JSON format (has genesis_state)
   */
  private normalizeFromJson(chainSpec: ZodChainSpecJson): GenesisConfig {
    const genesisState = chainSpec.genesis_state
    const network = chainSpec.network

    return {
      chain: {
        id: chainSpec.id,
        name: chainSpec.name || chainSpec.id,
        protocolVersion: chainSpec.protocol_version || '1.0.0',
        bootnodes: chainSpec.bootnodes || [],
      },
      time: {
        genesisTime: BigInt(
          genesisState?.genesis_time || genesisState?.safrole?.timeslot || 0,
        ),
        slotDuration: BigInt(network?.slot_duration || 6),
        epochLength: BigInt(network?.epoch_length || 600),
      },
      validators: this.normalizeValidatorConfigFromJson(chainSpec),
      accounts: this.normalizeAccountsConfigFromJson(chainSpec),
      safrole: this.normalizeSafroleConfigFromJson(chainSpec),
      system: this.normalizeSystemConfigFromJson(chainSpec),
    }
  }

  /**
   * Build Gray Paper compliant genesis state from config
   */
  buildGenesisState(config: GenesisConfig): GenesisState {
    // Initialize all 17 Gray Paper state components
    const genesisState: GenesisState = {
      authpool: this.initializers.authpool(config),
      recent: this.initializers.recent(config),
      lastaccout: this.initializers.lastaccout(config),
      safrole: this.initializers.safrole(config),
      accounts: this.initializers.accounts(config),
      entropy: this.initializers.entropy(config),
      stagingset: this.initializers.stagingset(config),
      activeset: this.initializers.activeset(config),
      previousset: this.initializers.previousset(config),
      reports: this.initializers.reports(config),
      thetime: this.initializers.thetime(config),
      authqueue: this.initializers.authqueue(config),
      privileges: this.initializers.privileges(config),
      disputes: this.initializers.disputes(config),
      activity: this.initializers.activity(config),
      ready: this.initializers.ready(config),
      accumulated: this.initializers.accumulated(config),
    }

    // Validate consistency if enabled
    if (this.builderOptions.validateConsistency) {
      const errors = this.validateGenesis(genesisState)
      if (errors.length > 0) {
        throw new Error(
          `Genesis validation failed: ${errors.map((e) => e.message).join(', ')}`,
        )
      }
    }

    return genesisState
  }

  /**
   * Complete genesis construction from chain-spec.json
   */
  async constructGenesis(filePath: string): Promise<GenesisResult> {
    const zodChainSpec = await this.loadChainSpec(filePath)
    const config = this.normalizeChainSpec(zodChainSpec)
    const genesisState = this.buildGenesisState(config)
    const genesisHeader = this.createGenesisHeader(genesisState)
    const genesisHash = this.computeGenesisHeaderHash(genesisHeader)

    // Convert Zod ChainSpec to Gray Paper ChainSpec
    const chainSpec = this.convertToGrayPaperChainSpec(zodChainSpec, config)

    return {
      genesisState,
      genesisHeader,
      genesisHash,
      chainSpec,
    }
  }

  /**
   * Convert Zod ChainSpec to Gray Paper ChainSpec format
   */
  private convertToGrayPaperChainSpec(
    zodChainSpec: ZodChainSpec,
    config: GenesisConfig,
  ): ChainSpec {
    return {
      id: zodChainSpec.id,
      name: zodChainSpec.name || zodChainSpec.id,
      protocolVersion: config.chain.protocolVersion,
      genesis: {
        genesisTime: config.time.genesisTime,
        validators: config.validators.validators.map((v) => ({
          validatorKey: v.validatorKey,
          peerId: v.network?.peerId || '',
          address: v.network?.address || '',
          index: v.index,
        })),
        services: config.accounts.services.map((s) => ({
          index: s.index,
          balance: s.balance,
          codeHash: s.codeHash,
          storage: new Map<Hex, Hex>(),
          minBalance: s.minBalance,
        })),
        entropy: config.safrole.entropy,
        coreAssignments: config.system.coreAssignments,
        privileges: config.system.privileges,
      },
      network: {
        chainId: config.chain.id,
        slotDuration: config.time.slotDuration,
        epochLength: config.time.epochLength,
        maxValidators: config.validators.maxValidators,
        coreCount: config.system.coreCount,
      },
      bootnodes: config.chain.bootnodes,
    }
  }

  /**
   * Validate genesis state
   */
  validateGenesis(genesisState: GenesisState): readonly GenesisError[] {
    return this.validateGenesisState(genesisState)
  }

  // ============================================================================
  // Helper Methods (moved from genesis-manager-impl.ts)
  // ============================================================================

  /**
   * Parse validator key from config format
   */
  private parseValidatorKeyFromConfig(validator: {
    bandersnatch: string
  }): ValidatorKey {
    return {
      bandersnatch: `0x${validator.bandersnatch}` as Hex,
      ed25519: `0x${'00'.repeat(32)}` as Hex,
      bls: `0x${'00'.repeat(144)}` as Hex,
      metadata: `0x${'00'.repeat(128)}` as Hex,
    } as ValidatorKey
  }

  /**
   * Generate validator address from index
   */
  private generateValidatorAddress(index: number): Hex {
    const addressBytes = new Uint8Array(20)
    for (let i = 0; i < 20; i++) {
      addressBytes[i] = (index + i) % 256
    }
    return `0x${Array.from(addressBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}` as Hex
  }

  /**
   * Normalize validator config from JSON format
   */
  private normalizeValidatorConfigFromJson(chainSpec: ZodChainSpecJson) {
    const validators = chainSpec.genesis_state?.validators || []

    return {
      validators: validators.map((v, index) => ({
        validatorKey: this.parseValidatorKeyFromJson(v),
        address: v.address,
        index: BigInt(index),
        name: v.altname,
        network: v.peerId
          ? {
              peerId: v.peerId,
              address: v.address_net || '',
            }
          : undefined,
      })),
      maxValidators: BigInt(
        chainSpec.network?.max_validators || validators.length,
      ),
    }
  }

  /**
   * Normalize accounts config from JSON format
   */
  private normalizeAccountsConfigFromJson(chainSpec: ZodChainSpecJson) {
    const services = []
    let serviceIndex = 0n

    const accounts = chainSpec.genesis_state?.accounts || {}
    for (const [address, account] of Object.entries(accounts)) {
      if (account && !account.isValidator) {
        services.push({
          index: serviceIndex++,
          address: address as Hex,
          balance: BigInt(account.balance),
          codeHash: account.codeHash,
          minBalance: account.minBalance || 0n,
          nonce: BigInt(account.nonce),
        })
      }
    }

    return { services }
  }

  /**
   * Normalize Safrole config from JSON format
   */
  private normalizeSafroleConfigFromJson(chainSpec: ZodChainSpecJson) {
    const safrole = chainSpec.genesis_state?.safrole
    const validators = chainSpec.genesis_state?.validators || []

    const ticketAccumulator =
      safrole?.tickets?.map((ticket) => ({
        id: ticket.id,
        entryIndex: BigInt(ticket.entry_index),
      })) || []

    const pendingSet = validators.map((validator) =>
      this.parseValidatorKeyFromJson(validator),
    )

    return {
      entropy:
        safrole?.entropy ||
        chainSpec.genesis_state?.entropy ||
        (`0x${'00'.repeat(32)}` as Hex),
      epochRoot: safrole?.epoch_root || this.computeEpochRoot(pendingSet),
      ticketAccumulator,
      pendingSet,
    }
  }

  /**
   * Normalize system config from JSON format
   */
  private normalizeSystemConfigFromJson(chainSpec: ZodChainSpecJson) {
    const privileges = chainSpec.genesis_state?.privileges
    const coreAssignments = new Map<bigint, bigint>()

    // Parse core assignments
    if (chainSpec.genesis_state?.core_assignments) {
      for (const [core, service] of Object.entries(
        chainSpec.genesis_state.core_assignments,
      )) {
        coreAssignments.set(BigInt(core), BigInt(service))
      }
    }

    return {
      coreCount: BigInt(chainSpec.network?.core_count || 16),
      coreAssignments,
      privileges: {
        manager: BigInt(privileges?.manager || 0),
        assigners: privileges?.assigners?.map((a) => BigInt(a)) || [],
        delegator: BigInt(privileges?.delegator || 0),
        registrar: BigInt(privileges?.registrar || 0),
        alwaysAccessors:
          privileges?.always_accessors?.map((a) => BigInt(a)) || [],
      },
    }
  }

  /**
   * Parse validator key from JSON format
   */
  private parseValidatorKeyFromJson(validator: {
    publicKey?: string
    ed25519?: string
    bls?: string
    metadata?: string
  }): ValidatorKey {
    return {
      bandersnatch: validator.publicKey || (`0x${'00'.repeat(32)}` as Hex),
      ed25519: validator.ed25519 || (`0x${'00'.repeat(32)}` as Hex),
      bls: validator.bls || (`0x${'00'.repeat(144)}` as Hex),
      metadata: validator.metadata || (`0x${'00'.repeat(128)}` as Hex),
    } as ValidatorKey
  }

  /**
   * Compute epoch root from validators
   */
  private computeEpochRoot(validators: ValidatorKey[]): Hex {
    // Simplified epoch root computation
    // In a full implementation, this would use the proper Bandersnatch ring root calculation
    const combined = validators.map((v) => v.bandersnatch).join('')
    const { blake2b, hexToBytes } = require('@pbnj/core')
    const hashResult = blake2b(hexToBytes(combined as Hex))
    if (hashResult[0]) {
      throw new Error(`Failed to compute epoch root: ${hashResult[0]}`)
    }
    return hashResult[1]!
  }

  /**
   * Create genesis header
   */
  createGenesisHeader(genesisState: GenesisState) {
    return {
      parent: null,
      priorStateRoot: `0x${'00'.repeat(32)}` as Hex,
      extrinsicHash: `0x${'00'.repeat(32)}` as Hex,
      timeslot: genesisState.thetime,
      epochMark: null,
      winnersMark: null,
      offendersMark: [],
      authorIndex: 0n,
      vrfSig: `0x${'00'.repeat(96)}` as Hex,
      sealSig: `0x${'00'.repeat(96)}` as Hex,
    }
  }

  /**
   * Compute genesis header hash
   */
  computeGenesisHeaderHash(genesisHeader: {
    parent: null
    priorStateRoot: Hex
    extrinsicHash: Hex
    timeslot: bigint
    epochMark: null
    winnersMark: null
    offendersMark: Hex[]
    authorIndex: bigint
    vrfSig: Hex
    sealSig: Hex
  }): Hex {
    // Simplified genesis header hash computation
    // In a full implementation, this would serialize the complete genesis header
    const headerJson = JSON.stringify(genesisHeader)
    const { blake2b } = require('@pbnj/core')
    const hashResult = blake2b(new TextEncoder().encode(headerJson))
    if (hashResult[0]) {
      throw new Error(`Failed to compute genesis header hash: ${hashResult[0]}`)
    }
    return hashResult[1]!
  }

  /**
   * Validate genesis state
   */
  private validateGenesisState(
    genesisState: GenesisState,
  ): readonly GenesisError[] {
    const errors: GenesisError[] = []

    // Validate all state components are properly initialized
    if (!genesisState.authpool) {
      errors.push({
        code: 'MISSING_AUTHPOOL',
        message: 'Authorization pool not initialized',
      })
    }

    if (!genesisState.recent) {
      errors.push({
        code: 'MISSING_RECENT',
        message: 'Recent history not initialized',
      })
    }

    if (!genesisState.safrole) {
      errors.push({
        code: 'MISSING_SAFROLE',
        message: 'Safrole state not initialized',
      })
    }

    if (!genesisState.accounts) {
      errors.push({
        code: 'MISSING_ACCOUNTS',
        message: 'Service accounts not initialized',
      })
    }

    if (!genesisState.entropy) {
      errors.push({
        code: 'MISSING_ENTROPY',
        message: 'Entropy not initialized',
      })
    }

    if (!genesisState.activeset || genesisState.activeset.length === 0) {
      errors.push({
        code: 'EMPTY_ACTIVESET',
        message: 'Active validator set is empty',
      })
    }

    if (!genesisState.stagingset) {
      errors.push({
        code: 'MISSING_STAGINGSET',
        message: 'Staging validator set not initialized',
      })
    }

    // Validate validator consistency
    if (genesisState.activeset.length !== genesisState.stagingset.length) {
      errors.push({
        code: 'VALIDATOR_SET_MISMATCH',
        message: 'Active and staging validator sets have different sizes',
      })
    }

    // Validate time
    if (genesisState.thetime < 0n) {
      errors.push({
        code: 'INVALID_TIME',
        message: 'Genesis time cannot be negative',
      })
    }

    return errors
  }

  /**
   * Create state initializers
   */
  private createStateInitializers(): GenesisStateInitializers {
    return {
      authpool: (config) => ({
        authorizations: [],
        coreAssignments: new Map(config.system.coreAssignments),
      }),

      recent: () => ({
        history: {
          headerHash: `0x${'00'.repeat(32)}` as Hex,
          accoutLogSuperPeak: `0x${'00'.repeat(32)}` as Hex,
          stateRoot: `0x${'00'.repeat(32)}` as Hex,
          reportedPackageHashes: [],
        },
        accoutBelt: {
          peaks: [],
          totalCount: 0n,
        },
      }),

      lastaccout: () => `0x${'00'.repeat(32)}` as Hex,

      safrole: (config) => ({
        pendingSet: [...config.safrole.pendingSet],
        epochRoot: config.safrole.epochRoot,
        sealTickets: [],
        ticketAccumulator: config.safrole.ticketAccumulator.map((t) => ({
          id: t.id,
          entryIndex: t.entryIndex,
          signature: `0x${'00'.repeat(96)}` as Hex,
          timestamp: 0n,
        })),
      }),

      accounts: (config) => ({
        accounts: new Map(
          config.accounts.services.map((service) => [
            service.index,
            {
              codehash: service.codeHash || (`0x${'00'.repeat(32)}` as Hex),
              balance: service.balance,
              minaccgas: service.minBalance,
              minmemogas: 100n,
              octets: 0n,
              gratis: 0n,
              items: 0n,
              created: 0n,
              lastacc: 0n,
              parent: 0n,
            },
          ]),
        ),
        serviceCount: BigInt(config.accounts.services.length),
      }),

      entropy: (config) => ({
        current: config.safrole.entropy,
        previous: `0x${'00'.repeat(32)}` as Hex,
      }),

      stagingset: (config) => [
        ...config.validators.validators.map((v) => v.validatorKey),
      ],
      activeset: (config) => [
        ...config.validators.validators.map((v) => v.validatorKey),
      ],
      previousset: () => [],

      reports: () => ({
        coreReports: new Map(),
      }),

      thetime: (config) => config.time.genesisTime,

      authqueue: () => ({
        queue: new Map(),
        processingIndex: 0n,
      }),

      privileges: (config) => ({
        manager: config.system.privileges.manager,
        delegator: config.system.privileges.delegator,
        registrar: config.system.privileges.registrar,
        assigners: [...config.system.privileges.assigners],
        alwaysaccers: new Map(
          config.system.privileges.alwaysAccessors.map((id) => [id, 1000n]),
        ),
      }),

      disputes: () => ({
        goodSet: new Set(),
        badSet: new Set(),
        wonkySet: new Set(),
        offenders: new Set(),
      }),

      activity: (config) => ({
        validatorStatsAccumulator: config.validators.validators.map(() => ({
          blocks: 0n,
          tickets: 0n,
          preimageCount: 0n,
          preimageSize: 0n,
          guarantees: 0n,
          assurances: 0n,
        })),
        validatorStatsPrevious: [],
        coreStats: Array.from(
          { length: Number(config.system.coreCount) },
          () => ({
            daLoad: 0n,
            popularity: 0n,
            importCount: 0n,
            extrinsicCount: 0n,
            extrinsicSize: 0n,
            exportCount: 0n,
            bundleLength: 0n,
            gasUsed: 0n,
          }),
        ),
        serviceStats: new Map(),
      }),

      ready: () => ({
        reports: [],
        queueState: new Map(),
      }),

      accumulated: () => ({
        packages: [],
        metadata: new Map(),
      }),
    }
  }
}

/**
 * Create a genesis manager instance
 */
export function createGenesisManager(
  parserOptions?: Partial<ChainSpecParserOptions>,
  builderOptions?: Partial<GenesisBuilderOptions>,
): GenesisManagerImpl {
  return new GenesisManagerImpl(parserOptions, builderOptions)
}

/**
 * Convenience function to load genesis from chain spec file
 */
export async function loadGenesisFromChainSpec(
  filePath: string,
  options?: {
    parser?: Partial<ChainSpecParserOptions>
    builder?: Partial<GenesisBuilderOptions>
  },
): Promise<GenesisResult> {
  const manager = createGenesisManager(options?.parser, options?.builder)
  return manager.constructGenesis(filePath)
}

/**
 * Convenience function to create genesis from chain spec JSON
 */
export function createGenesisFromChainSpec(
  zodChainSpec: ZodChainSpec,
  options?: {
    parser?: Partial<ChainSpecParserOptions>
    builder?: Partial<GenesisBuilderOptions>
  },
): Promise<GenesisResult> {
  const manager = createGenesisManager(
    options?.parser,
    options?.builder,
  ) as GenesisManagerImpl
  const config = manager.normalizeChainSpec(zodChainSpec)
  const genesisState = manager.buildGenesisState(config)
  const genesisHeader = manager.createGenesisHeader(genesisState)
  const genesisHash = manager.computeGenesisHeaderHash(genesisHeader)
  const chainSpec = manager['convertToGrayPaperChainSpec'](zodChainSpec, config)

  return Promise.resolve({
    genesisState,
    genesisHeader,
    genesisHash,
    chainSpec,
  })
}
