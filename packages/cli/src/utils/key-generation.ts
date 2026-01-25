import { decodeFixedLength } from '@pbnjam/codec'
import {
  bytesToHex,
  deriveSecretSeeds,
  generateAlternativeName,
} from '@pbnjam/core'
import type { Safe } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'

export interface ValidatorKeys {
  seed: string
  ed25519_secret_seed: string
  ed25519_public: string
  bandersnatch_secret_seed: string
  bandersnatch_public: string
  dnsAltName: string
}

/**
 * Generate validator keys from an index according to JAM specification
 *
 * This function generates deterministic Ed25519 and Bandersnatch key pairs
 * from a validator index using the deriveSecretSeeds function.
 *
 * @param index - Validator index (0-65535)
 * @returns ValidatorKeys object with Ed25519 and Bandersnatch keys
 */
export function generateValidatorKeys(index: number): Safe<ValidatorKeys> {
  // Validate index range
  if (index < 0 || index > 65535) {
    return safeError(new Error('Validator index must be between 0 and 65535'))
  }

  // Create the seed from the index
  // The seed is 32 Uint8Array where each byte is the index value
  const seed = new Uint8Array(32)
  seed.fill(index)

  // Convert Uint8Array to number array for the deriveSecretSeeds function
  const seedArray = Array.from(seed)

  // Derive secret seeds using the networking package function
  const [deriveSecretSeedsError, derivedSecretSeeds] = deriveSecretSeeds(
    seedArray as unknown as Parameters<typeof deriveSecretSeeds>[0],
  )
  if (deriveSecretSeedsError) {
    return safeError(deriveSecretSeedsError)
  }

  // For now, we'll use placeholder values for the public keys
  // In a real implementation, these would be derived from the secret seeds
  const ed25519Public = bytesToHex(derivedSecretSeeds.ed25519SecretSeed) // Placeholder
  const bandersnatchPublic = bytesToHex(
    derivedSecretSeeds.bandersnatchSecretSeed,
  ) // Placeholder

  const [dnsAltNameError, dnsAltName] = generateAlternativeName(
    derivedSecretSeeds.ed25519SecretSeed,
    decodeFixedLength,
  )
  if (dnsAltNameError) {
    return safeError(dnsAltNameError)
  }

  return safeResult({
    seed: bytesToHex(seed),
    ed25519_secret_seed: bytesToHex(derivedSecretSeeds.ed25519SecretSeed),
    ed25519_public: ed25519Public,
    bandersnatch_secret_seed: bytesToHex(
      derivedSecretSeeds.bandersnatchSecretSeed,
    ),
    bandersnatch_public: bandersnatchPublic,
    dnsAltName,
  })
}

/**
 * Generate bootnodes from genesis_validators
 * Format: <name>@<ip>:<port> where name is the 53-character DNS name derived from Ed25519 public key
 * Reference: JIP-4 - https://github.com/polkadot-fellows/JIPs/blob/main/JIP-4.md
 *
 * Note: polkajam gen-spec automatically generates bootnodes from genesis_validators when creating a chainspec.
 * This utility can be used to generate bootnodes manually if needed.
 */
export function generateBootnodes(
  genesisValidators: Array<{
    peer_id?: string
    bandersnatch: string
    net_addr: string
    validator_index: number
    stake: string
  }>,
): Safe<string[]> {
  const bootnodes: string[] = []

  for (const validator of genesisValidators) {
    try {
      // If peer_id is provided, use it directly (it should be the 53-character DNS name)
      // Format: <peer_id>@<ip>:<port>
      if (validator.peer_id) {
        const [ip, port] = validator.net_addr.split(':')
        if (!ip || !port) {
          return safeError(
            new Error(
              `Invalid net_addr format for validator ${validator.validator_index}: ${validator.net_addr}. Expected format: IP:port`,
            ),
          )
        }
        bootnodes.push(`${validator.peer_id}@${ip}:${port}`)
      } else {
        // If peer_id is not provided, we would need to generate it from Ed25519 public key
        // This requires the Ed25519 public key, which may not be directly available in genesis_validators
        // Note: polkajam gen-spec generates peer_id automatically when creating chainspecs
        return safeError(
          new Error(
            `peer_id not found for validator ${validator.validator_index}. Use polkajam gen-spec to generate chainspec with bootnodes, or provide peer_id in genesis_validators.`,
          ),
        )
      }
    } catch (error) {
      return safeError(
        new Error(
          `Failed to generate bootnode for validator ${validator.validator_index}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
    }
  }

  return safeResult(bootnodes)
}
