/**
 * Safrole Configuration Service
 *
 * Manages Safrole constants and configuration values.
 * Provides getters for each constant and supports overriding from genesis manager.
 * Gray Paper Reference: safrole.tex constants
 */

import {
  BaseService,
  DEFAULT_JAM_VERSION,
  FULL_SAFROLE_CONSTANTS,
  type IConfigService,
  type JamVersion,
  SEGMENT_CONSTANTS,
  SMALL_SAFROLE_CONSTANTS,
  TIME_CONSTANTS,
  TINY_SAFROLE_CONSTANTS,
} from '@pbnjam/types'

/**
 * Safrole Configuration Service
 *
 * Provides access to Safrole constants with support for:
 * - Default Gray Paper constants
 * - Genesis manager overrides
 * - Runtime overrides
 */
export class ConfigService extends BaseService implements IConfigService {
  private _jamVersion: JamVersion = DEFAULT_JAM_VERSION
  private _ancestryEnabled = true
  private _forkingEnabled = true

  readonly _mode:
    | 'tiny'
    | 'small'
    | 'medium'
    | 'large'
    | 'xlarge'
    | '2xlarge'
    | '3xlarge'
    | 'full'

  constructor(
    readonly mode:
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
    this._mode = mode
  }

  /**
   * Get JAM version
   * Defaults to DEFAULT_JAM_VERSION if not set
   */
  get jamVersion(): JamVersion {
    return this._jamVersion
  }

  /**
   * Set JAM version
   * Used to configure version-aware behavior (e.g., codec encoding, nextfreeid calculation)
   */
  set jamVersion(version: JamVersion) {
    this._jamVersion = version
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

  /**
   * Get maximum lookup anchorage
   * Gray Paper: Cmaxlookupanchorage = 14400 (full config)
   * Tiny config uses 24
   */
  get maxLookupAnchorage(): number {
    switch (this.mode) {
      case 'tiny':
        return 24
      case 'small':
      case 'medium':
      case 'large':
      case 'xlarge':
      case '2xlarge':
      case '3xlarge':
      case 'full':
        return TIME_CONSTANTS.C_MAXLOOKUPANCHORAGE // 14400
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Get erasure coding piece size
   * Gray Paper: Cecpiecesize = 684 (full config)
   * Tiny config uses 4
   */
  get ecPieceSize(): number {
    switch (this.mode) {
      case 'tiny':
        return 4
      case 'small':
      case 'medium':
      case 'large':
      case 'xlarge':
      case '2xlarge':
      case '3xlarge':
      case 'full':
        return SEGMENT_CONSTANTS.C_ECPIECESIZE // 684
      default:
        throw new Error('Invalid mode')
    }
  }

  /**
   * Whether ancestry feature is enabled
   * jam-conformance: When disabled, lookup anchor validation is skipped
   */
  get ancestryEnabled(): boolean {
    return this._ancestryEnabled
  }

  set ancestryEnabled(enabled: boolean) {
    this._ancestryEnabled = enabled
  }

  /**
   * Whether forking feature is enabled
   * jam-conformance: When enabled, mutations (sibling blocks) are tracked
   */
  get forkingEnabled(): boolean {
    return this._forkingEnabled
  }

  set forkingEnabled(enabled: boolean) {
    this._forkingEnabled = enabled
  }
}
