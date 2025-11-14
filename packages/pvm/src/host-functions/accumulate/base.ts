import type {
  HostFunctionResult,
  ImplicationsPair,
  RAM,
  RegisterState,
} from '@pbnj/types'
import { ACCUMULATE_ERROR_CODES } from '../../config'

export interface AccumulateHostFunctionContext {
  gasCounter: bigint
  registers: RegisterState
  ram: RAM
  implications: ImplicationsPair
  timeslot: bigint
  expungePeriod: bigint
  log: (message: string, data?: Record<string, unknown>) => void
}

/**
 * Base abstract class for all accumulation host functions
 *
 * Accumulation host functions operate on accumulation context (implications)
 * and can mutate service accounts, manage transfers, and handle blockchain operations.
 * They are different from general host functions as they work with accumulation context
 * rather than just PVM state.
 */
export abstract class BaseAccumulateHostFunction {
  public abstract readonly functionId: bigint
  public abstract readonly name: string
  public abstract readonly gasCost: bigint

  public abstract execute(
    context: AccumulateHostFunctionContext,
  ): HostFunctionResult

  // Helper methods for accumulation-specific operations
  protected setAccumulateError(
    registers: RegisterState,
    errorCode: keyof typeof ACCUMULATE_ERROR_CODES,
  ): void {
    registers[7] = ACCUMULATE_ERROR_CODES[errorCode]
  }

  protected setAccumulateSuccess(
    registers: RegisterState,
    value: bigint = ACCUMULATE_ERROR_CODES.OK,
  ): void {
    registers[7] = value
  }

  protected isMemoryRangeReadable(
    ram: RAM,
    offset: bigint,
    length: bigint,
  ): boolean {
    return ram.isReadableWithFault(offset, length)[0]
  }

  protected isMemoryRangeWritable(
    ram: RAM,
    offset: bigint,
    length: bigint,
  ): boolean {
    return ram.isWritableWithFault(offset, length)[0]
  }
}
