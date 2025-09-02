import {
  bytesToHex,
  deriveSecretSeeds,
  generateAlternativeName,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import { decodeFixedLength } from '@pbnj/serialization'

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
  const ed25519Public = bytesToHex(derivedSecretSeeds.ed25519_secret_seed) // Placeholder
  const bandersnatchPublic = bytesToHex(
    derivedSecretSeeds.bandersnatch_secret_seed,
  ) // Placeholder

  const [dnsAltNameError, dnsAltName] = generateAlternativeName(
    derivedSecretSeeds.ed25519_secret_seed,
    decodeFixedLength,
  )
  if (dnsAltNameError) {
    return safeError(dnsAltNameError)
  }

  return safeResult({
    seed: bytesToHex(seed),
    ed25519_secret_seed: bytesToHex(derivedSecretSeeds.ed25519_secret_seed),
    ed25519_public: ed25519Public,
    bandersnatch_secret_seed: bytesToHex(
      derivedSecretSeeds.bandersnatch_secret_seed,
    ),
    bandersnatch_public: bandersnatchPublic,
    dnsAltName,
  })
}
