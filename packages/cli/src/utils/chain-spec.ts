import { bytesToHex, type Hex, logger, z, zeroHash } from '@pbnj/core'
import { createStateKey, createStateTrie } from '@pbnj/codec'
import type {
  Account,
  GenesisState,
  IConfigService,
  Safe,
  ServiceAccount,
  Validator,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'

/**
 * Helper function to convert Uint8Array to hex without 0x prefix
 */
function Uint8ArrayToHexNoPrefix(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Input configuration schema for chain spec generation
 */
const ChainSpecConfigSchema = z.object({
  id: z.string().min(1, 'Chain ID is required'),
  name: z.string().optional(),
  genesis_validators: z
    .array(
      z.object({
        peer_id: z.string().min(1, 'Peer ID is required'),
        bandersnatch: z
          .string()
          .regex(
            /^[a-fA-F0-9]{64}$/,
            'Bandersnatch key must be a 64-character hex string',
          ),
        net_addr: z.string().min(1, 'Network address is required'),
        validator_index: z.number().int().min(0).optional().default(0),
        stake: z
          .string()
          .regex(/^\d+$/, 'Stake must be a numeric string')
          .optional()
          .default('1000000000000000000'),
      }),
    )
    .min(1, 'At least one genesis validator is required'),
  accounts: z
    .array(
      z.object({
        address: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/, 'Address must be a valid hex address'),
        balance: z.string().regex(/^\d+$/, 'Balance must be a numeric string'),
        nonce: z.number().int().min(0).optional().default(0),
        isValidator: z.boolean().optional().default(false),
        validatorKey: z.string().optional(),
        stake: z
          .string()
          .regex(/^\d+$/, 'Stake must be a numeric string')
          .optional(),
      }),
    )
    .optional(),
})

export type ChainSpecConfig = z.infer<typeof ChainSpecConfigSchema>

/**
 * Chain specification structure matching polkajam format
 */
export interface ChainSpec {
  /** Chain identifier */
  id: string
  /** Genesis state structure - flat key-value mapping */
  genesis_state: Record<string, string>
}

export function generateChainSpec(
  inputConfig: ChainSpecConfig,
  configService: IConfigService,
): Safe<ChainSpec> {
  logger.info('Generating chain spec', {
    id: inputConfig.id,
    validatorsCount: inputConfig.genesis_validators.length,
  })

  // Validate input config
  const validatedConfig = ChainSpecConfigSchema.parse(inputConfig)

  // Generate validators and accounts using proper JIP-5 functions
  const validators: Validator[] = []
  const accounts: Record<string, Account> = {}

  for (const validator of validatedConfig.genesis_validators) {
    try {
      const validatorIndex = validator.validator_index || 0

      // Generate deterministic address from validator index
      const addressUint8Array = new Uint8Array(20)
      for (let i = 0; i < 20; i++) {
        addressUint8Array[i] = (validatorIndex + i) % 256
      }
      const address = `0x${Uint8ArrayToHexNoPrefix(addressUint8Array)}`

      // Create validator entry
      const validatorEntry = {
        address,
        publicKey: `0x${validator.bandersnatch}`,
        stake: validator.stake,
        isActive: true,
        altname: `validator-${validatorIndex}`,
      }

      validators.push(validatorEntry as unknown as Validator)

      // Add validator account to accounts
      accounts[address] = {
        address: address as `0x${string}`,
        balance: BigInt(validator.stake),
        nonce: 0n,
        isValidator: true,
        validatorKey: `0x${validator.bandersnatch}`,
        stake: BigInt(validator.stake),
      }

      logger.debug('Generated validator', {
        index: validatorIndex,
        address: validatorEntry.address,
        altname: validatorEntry.altname,
      })
    } catch (error) {
      logger.error('Failed to generate validator', {
        validator,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Create genesis state with proper types according to Gray Paper specification
  const genesisState: GenesisState = {
    accounts: {
      accounts: new Map(
        Object.entries(accounts).map(([address, account]) => [
          BigInt(address),
          {
            ...account,
            nonce: 0n,
            isValidator: false,
            storage: new Map(),
            preimages: new Map(),
            requests: new Map(),
            gratis: 0n,
            codehash: zeroHash,
            minaccgas: 1000n,
            minmemogas: 100n,
            octets: 0n,
            items: 0n,
            created: 0n,
            lastacc: 0n,
            parent: 0n,
            minbalance: 0n,
          },
        ]),
      ),
    },
    authpool: [],
    recent: {
      history: [
        {
          headerHash: zeroHash,
          accoutLogSuperPeak: zeroHash,
          stateRoot: zeroHash,
          reportedPackageHashes: new Map(),
        },
      ],
      accoutBelt: {
        peaks: [],
        totalCount: 0n,
      },
    },
    lastAccumulationOutput: new Map(),
    entropy: {
      accumulator: zeroHash,
      entropy1: zeroHash,
      entropy2: zeroHash,
      entropy3: zeroHash,
    },
    safrole: {
      pendingSet: [],
      epochRoot: zeroHash,
      sealTickets: [],
      ticketAccumulator: [],
    },
    reports: {
      coreReports: new Array(341).fill(null),
    },
    disputes: {
      goodSet: new Set(),
      badSet: new Set(),
      wonkySet: new Set(),
      offenders: new Set(),
    },
    stagingset: [],
    activeset: [],
    previousset: [],
    thetime: 0n,
    authqueue: [],
    privileges: {
      manager: 0n,
      delegator: 0n,
      registrar: 0n,
      assigners: [],
      alwaysaccers: new Map(),
    },
    activity: {
      validatorStatsAccumulator: [],
      validatorStatsPrevious: [],
      coreStats: [],
      serviceStats: new Map(),
    },
    ready: {
      epochSlots: new Array(341).fill(null),
    },
    accumulated: {
      packages: [],
    },
  }

  // Generate service accounts for each validator (Chapter 255) according to Gray Paper
  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i]
    const serviceAccount: ServiceAccount = {
      balance: validator.stake,
      storage: new Map(),
      preimages: new Map(),
      requests: new Map(),
      gratis: 0n,
      codehash: zeroHash,
      minaccgas: 1000n,
      minmemogas: 100n,
      octets: 0n,
      items: 0n,
      created: 0n,
      lastacc: 0n,
      parent: 0n,
    }

    // Create service account key (Chapter 255 with service ID) according to Gray Paper
    const serviceKey = createStateKey(255, BigInt(i))
    const serviceKeyHex = bytesToHex(serviceKey)
    genesisState.accounts.accounts.set(BigInt(serviceKeyHex), serviceAccount)
  }

  // Generate genesis state trie according to Gray Paper specification
  // This includes chapters 1-16 and 255 (service accounts)
  const [genesisError, genesisStateTrie] = createStateTrie(
    genesisState,
    configService,
  )

  if (genesisError) {
    return safeError(genesisError)
  }

  // Convert keys to match Polkajam format (remove 0x prefix)
  const convertedStateTrie: Record<string, string> = {}
  for (const [key, value] of Object.entries(genesisStateTrie)) {
    const keyWithoutPrefix = key.startsWith('0x') ? key.slice(2) : key
    const valueWithoutPrefix = value.startsWith('0x')
      ? value.slice(2)
      : (value as Hex)
    convertedStateTrie[keyWithoutPrefix] = valueWithoutPrefix
  }

  // Create chain spec matching polkajam format
  const chainSpec: ChainSpec = {
    id: validatedConfig.id,
    genesis_state: convertedStateTrie,
  }

  logger.info('Chain spec generated successfully', {
    accountsCount: Object.keys(accounts).length,
    validatorsCount: validators.length,
    stateTrieEntries: Object.keys(convertedStateTrie).length,
  })

  return safeResult(chainSpec)
}
