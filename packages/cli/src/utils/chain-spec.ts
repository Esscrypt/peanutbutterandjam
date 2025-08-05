import { z } from '@pbnj/core'

/**
 * Input configuration schema for chain spec generation
 */
const ChainSpecConfigSchema = z.object({
  id: z.string().min(1, 'Chain ID is required'),
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
      }),
    )
    .min(1, 'At least one genesis validator is required'),
})

export type ChainSpecConfig = z.infer<typeof ChainSpecConfigSchema>

/**
 * Chain specification structure
 * Based on jamduna chain spec format
 */
export interface ChainSpec {
  /** Bootnodes - network addresses of initial nodes */
  bootnodes: string[]
  /** Chain identifier */
  id: string
  /** Genesis block header as hex string */
  genesis_header: string
  /** Genesis state as key-value pairs */
  genesis_state: Record<string, string>
}

export function generateChainSpec(inputConfig: ChainSpecConfig): ChainSpec {
  // Validate input configuration
  const validatedConfig = ChainSpecConfigSchema.parse(inputConfig)

  // Generate bootnodes from validator network addresses
  const bootnodes = validatedConfig.genesis_validators.map(
    (validator) => `${validator.peer_id}@${validator.net_addr}`,
  )

  // Generate genesis header (simplified - just a placeholder for now)
  const genesisHeader = `0x${'0'.repeat(512)}` // 256 bytes for genesis header

  // Generate genesis state with some basic entries
  const genesisState: Record<string, string> = {
    // Add some basic state entries
    [`0x${'1'.repeat(64)}`]: `0x${'2'.repeat(64)}`,
    [`0x${'3'.repeat(64)}`]: `0x${'4'.repeat(64)}`,
    [`0x${'5'.repeat(64)}`]: `0x${'6'.repeat(64)}`,
  }

  return {
    bootnodes,
    id: validatedConfig.id,
    genesis_header: genesisHeader,
    genesis_state: genesisState,
  }
}
