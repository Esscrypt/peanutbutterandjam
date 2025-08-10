/**
 * Prover-specific configuration for Bandersnatch VRF
 */

// Configuration constants for prover

/**
 * Default prover configuration
 */
export const DEFAULT_PROVER_CONFIG = {
  /** Use auxiliary data by default */
  useAuxData: false,
  /** Enable caching for performance */
  enableCaching: true,
  /** Cache size limit */
  maxCacheSize: 1000,
  /** Timeout for operations in milliseconds */
  operationTimeout: 5000,
} as const

/**
 * Prover performance settings
 */
export const PROVER_PERFORMANCE = {
  /** Batch size for batch operations */
  BATCH_SIZE: 100,
  /** Parallel processing threshold */
  PARALLEL_THRESHOLD: 10,
  /** Memory limit for caching in Uint8Array */
  CACHE_MEMORY_LIMIT: 1024 * 1024, // 1MB
} as const

/**
 * Prover error codes
 */
export enum ProverErrorCode {
  INVALID_SECRET_KEY = 'INVALID_SECRET_KEY',
  INVALID_INPUT = 'INVALID_INPUT',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  CACHE_FULL = 'CACHE_FULL',
  HASH_TO_CURVE_FAILED = 'HASH_TO_CURVE_FAILED',
  SCALAR_MULTIPLICATION_FAILED = 'SCALAR_MULTIPLICATION_FAILED',
  PROOF_GENERATION_FAILED = 'PROOF_GENERATION_FAILED',
}

/**
 * Ring VRF specific configuration
 */
export const RING_VRF_CONFIG = {
  /** Minimum ring size */
  MIN_RING_SIZE: 2,
  /** Maximum ring size */
  MAX_RING_SIZE: 1024,
  /** Default security parameter */
  DEFAULT_SECURITY_PARAM: 128,
  /** Hash function for ring commitments */
  RING_HASH_FUNCTION: 'blake2b',
  /** Position commitment scheme */
  POSITION_COMMITMENT_SCHEME: 'pedersen',
} as const

/**
 * Ring VRF performance targets
 */
export const RING_VRF_PERFORMANCE = {
  /** Maximum ring construction time in milliseconds */
  MAX_RING_CONSTRUCTION_TIME: 50,
  /** Maximum zero-knowledge proof generation time in milliseconds */
  MAX_ZK_PROOF_TIME: 100,
  /** Maximum ring signature generation time in milliseconds */
  MAX_RING_SIGNATURE_TIME: 30,
} as const
