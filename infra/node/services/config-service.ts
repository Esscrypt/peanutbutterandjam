/**
 * Safrole Configuration Service
 *
 * Manages Safrole constants and configuration values.
 * Provides getters for each constant and supports overriding from genesis manager.
 * Gray Paper Reference: safrole.tex constants
 */

import {
  BaseService,
  FULL_SAFROLE_CONSTANTS,
  type IConfigService,
  SMALL_SAFROLE_CONSTANTS,
  TINY_SAFROLE_CONSTANTS,
} from '@pbnj/types'

/**
 * Safrole Configuration Service
 *
 * Provides access to Safrole constants with support for:
 * - Default Gray Paper constants
 * - Genesis manager overrides
 * - Runtime overrides
 */
export class ConfigService extends BaseService implements IConfigService {
  constructor(
    private readonly mode:
      | 'tiny'
      | 'small'
      | 'medium'
      | 'large'
      | 'xlarge'
      | '2xlarge'
      | '3xlarge'
      | 'full',
  ) {
    super('safrole-config')
  }

  /**
   * Get preimage expunge period
   * Gray Paper: Cpreimageexpungeperiod = 32 slots
   */
  get preimageExpungePeriod(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.PREIMAGE_EXPUNGE_PERIOD
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.PREIMAGE_EXPUNGE_PERIOD
      case 'full':
        return FULL_SAFROLE_CONSTANTS.PREIMAGE_EXPUNGE_PERIOD
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get slot duration
   * Gray Paper: Cslotduration = 6 seconds
   */
  get slotDuration(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.SLOT_DURATION
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.SLOT_DURATION
      case 'full':
        return FULL_SAFROLE_CONSTANTS.SLOT_DURATION
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get epoch duration
   * Gray Paper: Cepochduration = 12 slots
   */
  get epochDuration(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.EPOCH_LENGTH
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.EPOCH_LENGTH
      case 'full':
        return FULL_SAFROLE_CONSTANTS.EPOCH_LENGTH
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get contest duration
   * Gray Paper: Ccontestduration = 10 slots
   */
  get contestDuration(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.CONTEST_DURATION
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.CONTEST_DURATION
      case 'full':
        return FULL_SAFROLE_CONSTANTS.CONTEST_DURATION
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get tickets per validator
   * Gray Paper: Cticketspervalidator = 3
   */
  get ticketsPerValidator(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.TICKETS_PER_VALIDATOR
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.TICKETS_PER_VALIDATOR
      case 'full':
        return FULL_SAFROLE_CONSTANTS.TICKETS_PER_VALIDATOR
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get maximum tickets per extrinsic
   * Gray Paper: Cmaxticketsperextrinsic = 3
   */
  get maxTicketsPerExtrinsic(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.MAX_TICKETS_PER_EXTRINSIC
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.MAX_TICKETS_PER_EXTRINSIC
      case 'full':
        return FULL_SAFROLE_CONSTANTS.MAX_TICKETS_PER_EXTRINSIC
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get rotation period
   * Gray Paper: Crotationperiod = 4 slots
   */
  get rotationPeriod(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.ROTATION_PERIOD
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.ROTATION_PERIOD
      case 'full':
        return FULL_SAFROLE_CONSTANTS.ROTATION_PERIOD
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get number of erasure coding pieces per segment
   * Gray Paper: Cecpiecespersegment = 1026
   */
  get numEcPiecesPerSegment(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.NUM_EC_PIECES_PER_SEGMENT
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.NUM_EC_PIECES_PER_SEGMENT
      case 'full':
        return FULL_SAFROLE_CONSTANTS.NUM_EC_PIECES_PER_SEGMENT
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get maximum block gas
   * Gray Paper: Cmaxblockgas = 20000000
   */
  get maxBlockGas(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.MAX_BLOCK_GAS
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.MAX_BLOCK_GAS
      case 'full':
        return FULL_SAFROLE_CONSTANTS.MAX_BLOCK_GAS
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get maximum refine gas
   * Gray Paper: Cmaxrefinegas = 1000000000
   */
  get maxRefineGas(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.MAX_REFINE_GAS
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.MAX_REFINE_GAS
      case 'full':
        return FULL_SAFROLE_CONSTANTS.MAX_REFINE_GAS
      default:
        throw new Error('Invalid mode')
    }
  }

  get numValidators(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.NUM_VALIDATORS
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.NUM_VALIDATORS
      case 'full':
        return FULL_SAFROLE_CONSTANTS.NUM_VALIDATORS
      default:
        throw new Error('Invalid mode')
    }
  }

  get numCores(): number {
    switch (this.mode) {
      case 'tiny':
        return TINY_SAFROLE_CONSTANTS.NUM_CORES
      case 'small':
        return SMALL_SAFROLE_CONSTANTS.NUM_CORES
      case 'full':
        return FULL_SAFROLE_CONSTANTS.NUM_CORES
      default:
        throw new Error('Invalid mode')
    }
  }

  get n(): number {
    switch (this.mode) {
      case 'tiny':
        return 6
      case 'full':
        return 1023
      default:
        throw new Error('Invalid mode')
    }
  }

  get k(): number {
    switch (this.mode) {
      case 'tiny':
        return 2
      case 'full':
        return 342
      default:
        throw new Error('Invalid mode')
    }
  }
}
