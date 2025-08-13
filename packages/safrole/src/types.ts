/**
 * Safrole Types
 *
 * Type definitions for Safrole consensus protocol
 * Reference: Gray Paper Safrole specifications
 */

import type { Hash, HashValue, Natural, Sequence } from '@pbnj/types'

/**
 * Safrole state as defined in Gray Paper
 */
export interface SafroleState {
  /** Current slot number */
  slot: Natural
  /** Current epoch number */
  epoch: Natural
  /** Current entropy accumulator */
  entropy: Sequence<HashValue>
  /** Validators for current epoch */
  activeSet: Sequence<HashValue>
  /** Validators for next epoch */
  pendingSet: Sequence<HashValue>
  /** Validator entries per epoch */
  entriesPerEpoch: Natural
  /** Gamma value for epoch change */
  gamma: Natural
  /** Lambda value for epoch change */
  lambda: Natural
  /** Kappa value for epoch change */
  kappa: Natural
}

/**
 * Safrole input for state transitions
 */
export interface SafroleInput {
  /** New entropy values */
  entropy: Sequence<HashValue>
  /** New ticket entries */
  tickets: Sequence<SafroleTicket>
  /** New offenders */
  offenders: Sequence<HashValue>
  /** Extrinsic hash */
  extrinsicHash?: Hash
}

/**
 * Safrole ticket as defined in Gray Paper
 */
export interface SafroleTicket {
  /** Ticket identifier */
  id: HashValue
  /** Ticket attempt number */
  attempt: Natural
  /** VRF signature */
  signature: Uint8Array
  /** Validator public key */
  validator: HashValue
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
  validator: HashValue
  /** Change type */
  type: 'added' | 'removed' | 'slashed'
  /** Slot when change occurred */
  slot: Natural
}

/**
 * Safrole constants as defined in Gray Paper
 */
export interface SafroleConstants {
  /** Slots per epoch */
  slotsPerEpoch: Natural
  /** Tickets per slot */
  ticketsPerSlot: Natural
  /** Entropy size in Uint8Array */
  entropySize: Natural
  /** Maximum validator set size */
  maxValidators: Natural
  /** Minimum validator set size */
  minValidators: Natural
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
