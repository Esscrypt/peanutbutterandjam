import type {
  HostFunctionContext,
  HostFunctionResult,
} from '@pbnj/types'

/**
 * Base abstract class for all host functions
 *
 * Host functions are called by PVM programs via host call instructions.
 * They provide access to system resources, storage, and other PVM instances.
 */
export abstract class BaseHostFunction {
  /**
   * The unique identifier for this host function
   * Must match the ID in GENERAL_FUNCTIONS, REFINE_FUNCTIONS, or ACCUMULATE_FUNCTIONS
   */
  abstract readonly functionId: bigint

  /**
   * Human-readable name for this host function
   */
  abstract readonly name: string

  /**
   * Execute the host function
   *
   * @param context - Host function context (will be mutated)
   * @param refineContext - Refine context for PVM machines and segments (will be mutated)
   * @returns Result code
   */
  abstract execute(
    context: HostFunctionContext,
    params: any,
  ): HostFunctionResult
}
