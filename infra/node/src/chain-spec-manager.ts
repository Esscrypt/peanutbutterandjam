/**
 * Chain Spec Manager
 *
 * Handles loading, validation, and import of chain spec JSON files
 * Reference: JAM Protocol chain specification format
 */

import { existsSync, readFileSync } from 'node:fs'
import { logger, type Safe, safeError, safeResult, z } from '@pbnj/core'

/**
 * Chain spec validation result
 */
export interface ChainSpecValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Chain spec configuration schema using Zod
 */
const ChainSpecSchema = z.object({
  id: z.string().min(1, 'Chain ID is required'),
  name: z.string().optional(),
  bootnodes: z
    .array(z.string().min(1, 'Bootnode must be a non-empty string'))
    .optional(),
  genesis_header: z
    .string()
    .regex(
      /^0x[a-fA-F0-9]{64}$/,
      'Genesis header must be a valid 64-character hex string',
    )
    .optional(),
  genesis_state: z.record(z.string(), z.string()).optional(),
  properties: z
    .object({
      ss58Format: z.number().int().min(0).optional(),
      tokenDecimals: z.number().int().min(0).optional(),
      tokenSymbol: z.string().optional(),
    })
    .optional(),
  protocolId: z.string().optional(),
  telemetryEndpoints: z.array(z.string()).optional(),
  forkBlocks: z.record(z.string(), z.number()).optional(),
  badBlocks: z.array(z.string()).optional(),
  consensusEngine: z.string().optional(),
  lightSyncState: z.string().optional(),
})

export type ChainSpec = z.infer<typeof ChainSpecSchema>

/**
 * Chain spec configuration
 */
export interface ChainSpecConfig {
  chainSpecPath?: string
  validation: {
    validateChainSpec: boolean
    requireBootnodes: boolean
    requireGenesisState: boolean
  }
}

/**
 * Chain Spec Manager
 */
export class ChainSpecManager {
  private config: ChainSpecConfig

  constructor(config: ChainSpecConfig) {
    this.config = config
  }

  /**
   * Load chain spec from file or data
   */
  async loadChainSpec(): Promise<Safe<ChainSpec, Error>> {
    try {
      if (!this.config.chainSpecPath) {
        return safeError(new Error('Chain spec path not configured'))
      }
      const chainSpecResult = await this.loadFromFile(this.config.chainSpecPath)
      if (chainSpecResult[0]) {
        return safeError(chainSpecResult[0])
      }

      const chainSpecData = chainSpecResult[1]!

      // Validate chain spec
      const validation = this.validateChainSpec(chainSpecData)
      if (!validation.valid && this.config.validation.validateChainSpec) {
        return safeError(
          new Error(
            `Chain spec validation failed: ${validation.errors.join(', ')}`,
          ),
        )
      }

      return safeResult(chainSpecData)
    } catch (error) {
      logger.error('Failed to load chain spec', { error })
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  /**
   * Load chain spec from JSON file
   */
  private async loadFromFile(
    filePath: string,
  ): Promise<Safe<ChainSpec, Error>> {
    if (!existsSync(filePath)) {
      return safeError(new Error(`Chain spec file not found: ${filePath}`))
    }

    logger.debug('Loading chain spec from file', { filePath })

    try {
      const fileContent = readFileSync(filePath, 'utf-8')

      // Parse and validate chain spec JSON using Zod
      const parseResult = ChainSpecSchema.safeParse(JSON.parse(fileContent))
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        )
        return safeError(
          new Error(`Chain spec JSON validation failed: ${errors.join(', ')}`),
        )
      }

      return safeResult(parseResult.data)
    } catch (error) {
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  /**
   * Validate chain spec
   */
  private validateChainSpec(chainSpec: ChainSpec): ChainSpecValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate required fields
    if (!chainSpec.id) {
      errors.push('Chain spec must have an ID')
    }

    // Validate bootnodes if required
    if (this.config.validation.requireBootnodes) {
      if (!chainSpec.bootnodes || chainSpec.bootnodes.length === 0) {
        errors.push('Chain spec must contain at least one bootnode')
      } else {
        // Validate bootnode format (basic validation)
        for (const bootnode of chainSpec.bootnodes) {
          if (!this.isValidBootnode(bootnode)) {
            errors.push(`Invalid bootnode format: ${bootnode}`)
          }
        }
      }
    }

    // Validate genesis state if required
    if (this.config.validation.requireGenesisState) {
      if (
        !chainSpec.genesis_state ||
        Object.keys(chainSpec.genesis_state).length === 0
      ) {
        errors.push('Chain spec must contain genesis state')
      }
    }

    // Validate genesis header format if present
    if (chainSpec.genesis_header) {
      if (!/^0x[a-fA-F0-9]{64}$/.test(chainSpec.genesis_header)) {
        errors.push('Genesis header must be a valid 64-character hex string')
      }
    }

    // Validate properties if present
    if (chainSpec.properties) {
      if (
        chainSpec.properties.ss58Format !== undefined &&
        (chainSpec.properties.ss58Format < 0 ||
          chainSpec.properties.ss58Format > 255)
      ) {
        errors.push('SS58 format must be between 0 and 255')
      }

      if (
        chainSpec.properties.tokenDecimals !== undefined &&
        (chainSpec.properties.tokenDecimals < 0 ||
          chainSpec.properties.tokenDecimals > 18)
      ) {
        errors.push('Token decimals must be between 0 and 18')
      }
    }

    // Check for warnings
    if (!chainSpec.bootnodes || chainSpec.bootnodes.length === 0) {
      warnings.push('No bootnodes in chain spec')
    }

    if (
      !chainSpec.genesis_state ||
      Object.keys(chainSpec.genesis_state).length === 0
    ) {
      warnings.push('No genesis state in chain spec')
    }

    if (!chainSpec.name) {
      warnings.push('No chain name specified')
    }

    if (!chainSpec.properties) {
      warnings.push('No chain properties specified')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate bootnode format
   */
  private isValidBootnode(bootnode: string): boolean {
    // Basic validation for libp2p multiaddr format
    // This is a simplified validation - in practice you might want more sophisticated parsing
    const parts = bootnode.split('@')
    if (parts.length !== 2) {
      return false
    }

    const peerId = parts[0]
    const address = parts[1]

    // Validate peer ID format (basic check)
    if (!peerId.startsWith('12D3KooW') || peerId.length < 50) {
      return false
    }

    // Validate address format (basic check)
    const addressParts = address.split(':')
    if (addressParts.length !== 2) {
      return false
    }

    const host = addressParts[0]
    const port = Number.parseInt(addressParts[1])

    if (!host || Number.isNaN(port) || port < 1 || port > 65535) {
      return false
    }

    return true
  }

  /**
   * Get network configuration from chain spec
   */
  getNetworkConfig(chainSpec: ChainSpec) {
    return {
      chainId: chainSpec.id,
      chainName: chainSpec.name || chainSpec.id,
      bootnodes: chainSpec.bootnodes || [],
      properties: chainSpec.properties || {},
      protocolId: chainSpec.protocolId,
      telemetryEndpoints: chainSpec.telemetryEndpoints || [],
    }
  }

  /**
   * Get genesis configuration from chain spec
   */
  getGenesisConfig(chainSpec: ChainSpec) {
    return {
      genesisHeader: chainSpec.genesis_header,
      genesisState: chainSpec.genesis_state || {},
    }
  }
}
