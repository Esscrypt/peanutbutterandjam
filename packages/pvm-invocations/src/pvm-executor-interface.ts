/**
 * Common PVM Executor Interface
 * 
 * Provides a unified interface for both TypeScript and WASM PVM implementations.
 * This allows AccumulatePVM to work with either implementation seamlessly.
 */

import type {
  ContextMutator,
  ImplicationsPair,
  PVMState,
  RefineInvocationContext,
  SafePromise,
} from '@pbnj/types'

/**
 * Common interface for PVM execution
 * 
 * Both TypeScript PVM and WASM PVM implementations must implement this interface
 * to be used by AccumulatePVM.
 */
export interface IPVMExecutor {
  /**
   * Execute marshalling invocation (Ψ_M)
   * 
   * Gray Paper: Ψ_M(blob, pvmreg, gas, blob, contextmutator, X) → (gas, blob ∪ {panic, oog}, X)
   * 
   * @param programBlob - Service code blob
   * @param initialPC - Initial program counter (typically 0 for refine, 5 for accumulate)
   * @param gasLimit - Gas limit for execution
   * @param encodedArgs - Encoded arguments blob
   * @param contextMutator - Context mutator function F
   * @param context - Context X (ImplicationsPair for accumulate, RefineContext for refine)
   * @param buildPanicDump - Optional flag to build panic dump on panic/OOG
   * @param serviceId - Optional service ID for panic dump and host function logs (required if buildPanicDump or writeHostFunctionLogs is true)
   * @param writeHostFunctionLogs - Optional flag to write host function logs to file
   * @returns Tuple of (gas consumed, result, updated context) where result is blob ∪ {panic, oog}
   */
  executeMarshallingInvocation(
    programBlob: Uint8Array,
    initialPC: bigint,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    contextMutator: ContextMutator,
    context: RefineInvocationContext | ImplicationsPair,
    buildPanicDump?: boolean,
    serviceId?: bigint,
    writeHostFunctionLogs?: boolean,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: RefineInvocationContext | ImplicationsPair
  }>

  /**
   * Get current PVM state
   * 
   * @returns Current PVM state
   */
  getState(): PVMState

  /**
   * Direct access to PVM state
   */
  readonly state: PVMState

}

