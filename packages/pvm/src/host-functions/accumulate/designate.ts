import { logger } from '@pbnjam/core'
import type { HostFunctionResult, IConfigService } from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
} from './base'

/**
 * DESIGNATE accumulation host function (Ω_D)
 *
 * Designates validators (only delegator can do this)
 *
 * Gray Paper Specification:
 * - Function ID: 16 (designate)
 * - Gas Cost: 10
 * - Parameters: registers[7] = o
 *   - o: validators array offset in memory
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read validators array from memory (336 bytes per validator, up to Cvalcount validators)
 * 2. Check if current service is the delegator (imX.id === imX.state.ps_delegator)
 * 3. Update staging set with new validators
 * 4. Return OK on success, HUH if not delegator, PANIC on error
 */
export class DesignateHostFunction extends BaseAccumulateHostFunction {
  readonly functionId = ACCUMULATE_FUNCTIONS.DESIGNATE
  readonly name = 'designate'
  readonly gasCost = 10n
  readonly configService: IConfigService

  constructor(configService: IConfigService) {
    super()
    this.configService = configService
  }

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications } = context

    // Extract parameters from registers
    const validatorsOffset = registers[7]

    // Get the current implications context
    const [imX] = implications

    // Read validators array from memory (336 bytes per validator, up to Cvalcount validators)
    // Gray Paper: sequence[Cvalcount]{valkey} where Cvalcount = 1023
    const C_VALCOUNT = this.configService.numValidators // 1023 validators
    const VALIDATOR_SIZE = 336 // bytes per validator
    const totalSize = VALIDATOR_SIZE * C_VALCOUNT

    // Log all input parameters
    logger.info('DESIGNATE host function invoked', {
      validatorsOffset: validatorsOffset.toString(),
      validatorCount: C_VALCOUNT.toString(),
      validatorSize: VALIDATOR_SIZE.toString(),
      totalSize: totalSize.toString(),
      currentServiceId: imX.id.toString(),
      delegator: imX.state.delegator.toString(),
    })

    // Gray Paper pvm_invocations.tex lines 736-739:
    // v = sequence{memory[o+336i:336] for i in valindex} when Nrange(o,336*Cvalcount) ⊆ readable(memory), error otherwise
    // IMPORTANT: Memory read happens FIRST per Gray Paper order
    const [validatorsData, faultAddress] = ram.readOctets(
      validatorsOffset,
      BigInt(totalSize),
    )

    // Gray Paper: (panic, registers_7, stagingset) when v = error
    // Check memory read FIRST (before delegator check) per Gray Paper order
    // DO NOT modify registers[7] - it must remain unchanged on panic
    if (faultAddress || !validatorsData) {
      logger.error(
        'DESIGNATE host function invoked but validators data read failed',
        {
          totalSize: totalSize.toString(),
          validatorsOffset: validatorsOffset.toString(),
          C_VALCOUNT: C_VALCOUNT.toString(),
          VALIDATOR_SIZE: VALIDATOR_SIZE.toString(),
        },
      )
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Gray Paper: v = sequence{memory[o+336i:336] for i in valindex}
    // Split raw bytes into 336-byte chunks (one per validator)
    const stagingSet: Uint8Array[] = []
    for (let i = 0; i < C_VALCOUNT; i++) {
      const validatorData = validatorsData.slice(
        i * VALIDATOR_SIZE,
        (i + 1) * VALIDATOR_SIZE,
      )
      stagingSet.push(validatorData)
    }

    // Gray Paper: (continue, HUH, stagingset) otherwhen imX_id ≠ (imX_state)_ps_delegator
    // Check delegator AFTER successful memory read per Gray Paper order
    if (imX.id !== imX.state.delegator) {
      this.setAccumulateError(registers, 'HUH')
      logger.warn('DESIGNATE host function invoked but not the delegator', {
        currentServiceId: imX.id.toString(),
        delegator: imX.state.delegator.toString(),
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper: (continue, OK, v) otherwise
    // Update staging set with new validators
    // Gray Paper: (imX'.state).ps_stagingset = v
    // Assign raw bytes directly per Gray Paper specification
    imX.state.stagingset = stagingSet

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }
}
