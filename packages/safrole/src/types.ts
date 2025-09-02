/**
 * Safrole Types
 *
 * Type definitions for Safrole consensus protocol
 * Reference: Gray Paper Safrole specifications
 */

import type { Hex } from '@pbnj/core'
import type { Sequence } from '@pbnj/types'

/**
 * Safrole state as defined in Gray Paper
 */
export interface SafroleState {
  /** Current slot number */
  slot: bigint
  /** Current epoch number */
  epoch: bigint
  /** Current entropy accumulator */
  entropy: Sequence<Hex>
  /** Validators for current epoch */
  activeSet: Sequence<Hex>
  /** Validators for next epoch */
  pendingSet: Sequence<Hex>
  /** Validator entries per epoch */
  entriesPerEpoch: bigint
  /** Gamma value for epoch change */
  gamma: bigint
  /** Lambda value for epoch change */
  lambda: bigint
  /** Kappa value for epoch change */
  kappa: bigint
}

/**
 * Safrole input for state transitions
 */
export interface SafroleInput {
  /** New entropy values */
  entropy: Sequence<Hex>
  /** New ticket entries */
  tickets: Sequence<SafroleTicket>
  /** New offenders */
  offenders: Sequence<Hex>
  /** Extrinsic hash */
  extrinsicHash?: Hex
}

/**
 * Safrole ticket as defined in Gray Paper
 */
export interface SafroleTicket {
  /** Ticket identifier */
  id: Hex
  /** Ticket attempt number */
  attempt: bigint
  /** VRF signature */
  signature: Uint8Array
  /** Validator public key */
  validator: Hex
}

/**
 * Safrole output from state transitions
 */
export interface SafroleOutput {
  /** Updated state */
  state: SafroleState
  /** Generated tickets */
  tickets: Sequence<SafroleTicket>
  /** Validator changes */
  validatorChanges: Sequence<ValidatorChange>
}

/**
 * Validator change record
 */
export interface ValidatorChange {
  /** Validator public key */
  validator: Hex
  /** Change type */
  type: 'added' | 'removed' | 'slashed'
  /** Slot when change occurred */
  slot: bigint
}

/**
 * Safrole constants as defined in Gray Paper
 */
export interface SafroleConstants {
  /** Slots per epoch */
  slotsPerEpoch: bigint
  /** Tickets per slot */
  ticketsPerSlot: bigint
  /** Entropy size in Uint8Array */
  entropySize: bigint
  /** Maximum validator set size */
  maxValidators: bigint
  /** Minimum validator set size */
  minValidators: bigint
}

/**
 * Safrole configuration
 */
export interface SafroleConfig {
  /** Protocol constants */
  constants: SafroleConstants
  /** Genesis state */
  genesis: SafroleState
  /** Enable debug logging */
  debug: boolean
}
