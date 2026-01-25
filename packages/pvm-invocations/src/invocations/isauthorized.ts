/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { logger } from '@pbnjam/core'
import type {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { IS_AUTHORIZED_CONFIG } from '@pbnjam/pvm'
import type {
  IConfigService,
  IServiceAccountService,
  PVMOptions,
  WorkError,
  WorkPackage,
} from '@pbnjam/types'
import {
  TypeScriptPVMExecutor,
  WasmPVMExecutor,
} from '../pvm-executor-adapters'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class IsAuthorizedPVM {
  private readonly serviceAccountService: IServiceAccountService
  //   private readonly configService: IConfigService
  private readonly pvmExecutor: TypeScriptPVMExecutor | WasmPVMExecutor
  private readonly useWasm: boolean

  constructor(options: {
    hostFunctionRegistry: HostFunctionRegistry
    serviceAccountService: IServiceAccountService
    configService: IConfigService
    pvmOptions?: PVMOptions
    useWasm: boolean
    traceSubfolder?: string
  }) {
    this.useWasm = options.useWasm
    this.serviceAccountService = options.serviceAccountService
    //     this.configService = options.configService

    // Create PVM executor based on useWasm flag
    if (options.useWasm) {
      // Create WASM executor - module will be loaded from pvm-assemblyscript/build/pvm.wasm
      // and instantiated lazily on first use
      this.pvmExecutor = new WasmPVMExecutor(
        options.configService,
        null, // entropyService not needed for is-authorized
        options.serviceAccountService,
        options.traceSubfolder,
      )
    } else {
      this.pvmExecutor = new TypeScriptPVMExecutor(
        options.hostFunctionRegistry,
        null as unknown as AccumulateHostFunctionRegistry, // accumulateHostFunctionRegistry not needed for is-authorized
        options.configService,
        null, // entropyService not needed for is-authorized
        options.serviceAccountService,
        {
          ...options.pvmOptions,
          gasCounter:
            options.pvmOptions?.gasCounter ||
            BigInt(options.configService.maxBlockGas),
        },
        options.traceSubfolder,
      )
    }
  }

  /**
   * Ψ_I - Is-Authorized Invocation
   * Gray Paper equation 37-38: Ψ_I(workpackage, coreindex) → (blob | workerror, gas)
   *
   * @param workPackage - The work package containing authorization code
   * @param coreIndex - The core index on which to execute
   * @returns Tuple of (result, gasUsed)
   */
  public async executeIsAuthorized(
    workPackage: WorkPackage,
    coreIndex: bigint,
  ): Promise<{
    result: Uint8Array | WorkError
    gasUsed: bigint
  }> {
    // Check if auth code exists (Gray Paper eq:isauthinvocation)
    if (!workPackage.authCodeHash) {
      return { result: 'BAD', gasUsed: 0n }
    }

    const [serviceAccountError, serviceAccount] =
      this.serviceAccountService.getServiceAccount(workPackage.authCodeHost)
    if (serviceAccountError) {
      return { result: 'BAD', gasUsed: 0n }
    }
    if (!serviceAccount) {
      return { result: 'BAD', gasUsed: 0n }
    }

    // Do a lookup in the service account service
    const [authCodeError, authCode] =
      this.serviceAccountService.histLookupServiceAccount(
        workPackage.authCodeHost,
        serviceAccount,
        workPackage.authCodeHash,
        workPackage.context.lookup_anchor_slot,
      )
    if (authCodeError) {
      logger.error('[IsAuthorizedPVM] Auth code not found', {
        error: authCodeError.message,
      })
      return { result: 'BAD', gasUsed: 0n }
    }
    if (!authCode) {
      logger.error('[IsAuthorizedPVM] Auth code not found', {
        authCodeHost: workPackage.authCodeHost,
        authCodeHash: workPackage.authCodeHash,
        lookupAnchorSlot: workPackage.context.lookup_anchor_slot,
      })
      return { result: 'BAD', gasUsed: 0n }
    }

    // Check for oversized auth code (Gray Paper eq:isauthinvocation)
    if (authCode.length > IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE) {
      logger.error('[IsAuthorizedPVM] Auth code too large', {
        authCodeLength: authCode.length,
        maxAuthCodeSize: IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE,
      })
      return { result: 'BIG', gasUsed: 0n }
    }

    // Encode core index as 2-byte argument
    const encodedArgs = new ArrayBuffer(2)
    const view = new DataView(encodedArgs)
    view.setUint16(0, Number(coreIndex), true) // Little endian

    // Execute is-authorized invocation
    // Use the useWasm flag to determine which executor method to call
    let error: Error | undefined
    let marshallingResult:
      | {
          gasConsumed: bigint
          result: Uint8Array | 'PANIC' | 'OOG'
        }
      | undefined

    if (this.useWasm) {
      // WASM executor - use direct is-authorized method
      const [wasmError, wasmResult] = await (
        this.pvmExecutor as WasmPVMExecutor
      ).executeIsAuthorizedInvocation(
        authCode,
        IS_AUTHORIZED_CONFIG.PACKAGE_AUTH_GAS,
        new Uint8Array(encodedArgs),
        workPackage,
      )
      error = wasmError
      marshallingResult = wasmResult
    } else {
      // TypeScript executor - use executeIsAuthorizedInvocation
      const [tsError, tsResult] = await (
        this.pvmExecutor as TypeScriptPVMExecutor
      ).executeIsAuthorizedInvocation(
        authCode,
        IS_AUTHORIZED_CONFIG.PACKAGE_AUTH_GAS,
        new Uint8Array(encodedArgs),
        workPackage,
      )
      error = tsError
      marshallingResult = tsResult
    }

    if (error || !marshallingResult) {
      logger.error('[IsAuthorizedPVM] Is-authorized invocation failed', {
        error: error?.message,
      })
      return {
        gasUsed: 0n,
        result: 'BAD',
      }
    }

    // Extract values from execution return: (gas consumed, result)
    const { gasConsumed, result: marshallingResultValue } = marshallingResult

    // Handle result based on marshalling result
    // Gray Paper equation 37-38: result is blob | workerror
    let result: Uint8Array | WorkError
    if (marshallingResultValue === 'PANIC') {
      result = 'BAD' // PANIC maps to BAD
    } else if (marshallingResultValue === 'OOG') {
      result = 'BAD' // OOG maps to BAD
    } else {
      // Valid blob result or empty
      result =
        marshallingResultValue.length === 0 ? 'BAD' : marshallingResultValue
    }

    return {
      gasUsed: gasConsumed,
      result,
    }
  }
}
