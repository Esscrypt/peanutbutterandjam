import {
  decodeValidatorPublicKeys,
  encodeValidatorPublicKeys,
} from '@pbnj/codec'
import type {
  HostFunctionResult,
  IConfigService,
  ValidatorPublicKeys,
} from '@pbnj/types'
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

    // Read validators array from memory (336 bytes per validator, up to Cvalcount validators)
    // Gray Paper: sequence[Cvalcount]{valkey} where Cvalcount = 1023
    const C_VALCOUNT = this.configService.numValidators // 1023 validators
    const VALIDATOR_SIZE = 336 // bytes per validator
    const totalSize = VALIDATOR_SIZE * C_VALCOUNT

    // Log all input parameters
    context.log('DESIGNATE host function invoked', {
      validatorsOffset: validatorsOffset.toString(),
      validatorCount: C_VALCOUNT.toString(),
      validatorSize: VALIDATOR_SIZE.toString(),
      totalSize: totalSize.toString(),
      currentServiceId: implications[0].id.toString(),
      delegator: implications[0].state.delegator.toString(),
    })

    const [validatorsData, faultAddress] = ram.readOctets(
      validatorsOffset,
      BigInt(totalSize),
    )
    if (faultAddress) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }
    if (!validatorsData) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Parse validators array (336 bytes per validator)
    const validators: ValidatorPublicKeys[] = []
    for (let i = 0; i < C_VALCOUNT; i++) {
      const validatorData = validatorsData.slice(
        i * VALIDATOR_SIZE,
        (i + 1) * VALIDATOR_SIZE,
      )
      const [error, validator] = decodeValidatorPublicKeys(validatorData)
      if (error) {
        this.setAccumulateError(registers, 'WHAT')
        return {
          resultCode: RESULT_CODES.PANIC,
        }
      }
      validators.push(validator.value)
    }

    // Get the current implications context
    const [imX] = implications

    // Check if current service is the delegator
    // Gray Paper: imX.id !== imX.state.ps_delegator
    if (imX.id !== imX.state.delegator) {
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Update staging set with new validators
    // Gray Paper: (imX'.state).ps_stagingset = v
    imX.state.stagingset = validators.map(encodeValidatorPublicKeys)

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }
}
