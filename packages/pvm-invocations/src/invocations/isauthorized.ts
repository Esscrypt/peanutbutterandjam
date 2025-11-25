// /**
//  * Polkadot Virtual Machine (PVM) Implementation
//  *
//  * Simplified Gray Paper compliant implementation
//  * Gray Paper Reference: pvm.tex
//  */

// import { logger } from '@pbnj/core'
// import type {
//   IServiceAccountService,
//   PVMOptions,
//   RAM,
//   ResultCode,
//   WorkError,
//   WorkPackage,
// } from '@pbnj/types'
// import {
//   ACCUMULATE_ERROR_CODES,
//   GENERAL_FUNCTIONS,
//   IS_AUTHORIZED_CONFIG,
//   RESULT_CODES,
// } from '@pbnj/pvm'
// import { PVM, HostFunctionRegistry } from '@pbnj/pvm'

// /**
//  * Simplified PVM implementation
//  *
//  * Gray Paper Ψ function: Executes instructions until a halting condition
//  */
// export class IsAuthorizedPVM extends PVM {
//   private readonly serviceAccountService: IServiceAccountService

//   constructor(options: {
//     hostFunctionRegistry: HostFunctionRegistry
//     serviceAccountService: IServiceAccountService
//     pvmOptions?: PVMOptions
//   }) {
//     super(options.hostFunctionRegistry, options.pvmOptions)
//     this.serviceAccountService = options.serviceAccountService
//   }

//   /**
//    * Ψ_I - Is-Authorized Invocation
//    * Gray Paper equation 37-38: Ψ_I(workpackage, coreindex) → (blob | workerror, gas)
//    *
//    * @param workPackage - The work package containing authorization code
//    * @param coreIndex - The core index on which to execute
//    * @returns Tuple of (result, gasUsed)
//    */
//   public async executeIsAuthorized(
//     workPackage: WorkPackage,
//     coreIndex: bigint,
//   ): Promise<{
//     result: Uint8Array | WorkError
//     gasUsed: bigint
//   }> {
//     // Check if auth code exists (Gray Paper eq:isauthinvocation)
//     if (!workPackage.authCodeHash) {
//       return { result: 'BAD', gasUsed: 0n }
//     }

//     const [serviceAccountError, serviceAccount] =
//       this.serviceAccountService.getServiceAccount(workPackage.authCodeHost)
//     if (serviceAccountError) {
//       return { result: 'BAD', gasUsed: 0n }
//     }
//     if (!serviceAccount) {
//       return { result: 'BAD', gasUsed: 0n }
//     }
//     // do a lookup in the service account service
//     const [authCodeError, authCode] =
//       this.serviceAccountService.histLookupServiceAccount(
//         serviceAccount,
//         workPackage.authCodeHash,
//         workPackage.context.lookup_anchor_slot,
//       )
//     if (authCodeError) {
//       return { result: 'BAD', gasUsed: 0n }
//     }
//     if (!authCode) {
//       return { result: 'BAD', gasUsed: 0n }
//     }

//     // Check for oversized auth code (Gray Paper eq:isauthinvocation)
//     if (authCode.length > IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE) {
//       return { result: 'BIG', gasUsed: 0n }
//     }

//     // Encode core index as 2-byte argument
//     const encodedArgs = new ArrayBuffer(2)
//     const view = new DataView(encodedArgs)
//     view.setUint16(0, Number(coreIndex), true) // Little endian

//     // Create Is-Authorized context mutator F
//     const isAuthorizedContextMutator =
//       this.createIsAuthorizedContextMutator(workPackage)

//     // Execute Ψ_M(authCode, 0, Cpackageauthgas, encode[2]{c}, F, none)
//     const [error, marshallingResult] = await this.executeMarshallingInvocation(
//       authCode,
//       0n, // Initial PC = 0 (Gray Paper)
//       IS_AUTHORIZED_CONFIG.PACKAGE_AUTH_GAS,
//       new Uint8Array(encodedArgs),
//       isAuthorizedContextMutator,
//       null, // Context is none for Is-Authorized
//     )

//     if (error) {
//       return {
//         gasUsed: 0n,
//         result: 'BAD',
//       }
//     }

//     // Extract values from Ψ_M return: (gas consumed, result, updated context)
//     const { gasConsumed, result: marshallingResultValue } = marshallingResult

//     // Handle result based on marshalling result
//     let result: Uint8Array | 'PANIC' | 'OOG' | 'BAD'
//     if (marshallingResultValue === 'PANIC') {
//       result = 'PANIC'
//     } else if (marshallingResultValue === 'OOG') {
//       result = 'OOG'
//     } else {
//       // Valid blob result or empty
//       result =
//         marshallingResultValue.length === 0 ? 'BAD' : marshallingResultValue
//     }

//     return {
//       gasUsed: gasConsumed,
//       result,
//     }
//   }

//   /**
//    * Create Is-Authorized context mutator F
//    * Gray Paper equation 46-54: F ∈ contextmutator{emptyset}
//    *
//    * Supports only:
//    * - gas (ID = 0): Ω_G
//    * - fetch (ID = 1): Ω_Y(..., wpX, none, none, none, none, none, none, none)
//    *
//    * For unknown host calls:
//    * - Set registers[7] = WHAT
//    * - Subtract 10 gas
//    * - If gas < 0: return oog
//    * - Otherwise: continue
//    */
//   private createIsAuthorizedContextMutator(workPackage: WorkPackage): (
//     hostCallId: bigint,
//     gasCounter: bigint,
//     registers: bigint[],
//     memory: RAM,
//     context: null,
//   ) => {
//     resultCode: ResultCode
//     gasCounter: bigint
//     registers: bigint[]
//     memory: RAM
//     context: null
//   } {
//     return (
//       hostCallId: bigint,
//       gasCounter: bigint,
//       registers: bigint[],
//       memory: RAM,
//       _context: null,
//     ) => {
//       try {
//         // Gray Paper eq 46-54: Only support gas (0) and fetch (1)
//         if (hostCallId === GENERAL_FUNCTIONS.GAS) {
//           // Ω_G(gascounter, registers, memory)
//           const hostFunction = this.hostFunctionRegistry.get(
//             GENERAL_FUNCTIONS.GAS,
//           )
//           if (!hostFunction) {
//             logger.error('Gas host function not found in registry')
//             return {
//               resultCode: RESULT_CODES.PANIC,
//               gasCounter,
//               registers,
//               memory,
//               context: null,
//             }
//           }

//           // Create log function for is-authorized GAS host function context
//           const isAuthorizedGasHostFunctionLog = (
//             message: string,
//             data?: Record<string, unknown>,
//           ) => {
//             if (!this.executionLogs) {
//               this.executionLogs = []
//             }
//             this.executionLogs.push({
//               pc: this.state.programCounter,
//               instructionName: `HOST_${hostFunction.name}`,
//               opcode: `0x${hostCallId.toString(16)}`,
//               message,
//               data,
//               timestamp: Date.now(),
//             })
//           }

//           const hostContext = {
//             gasCounter,
//             registers,
//             ram: memory,
//             log: isAuthorizedGasHostFunctionLog,
//           }

//           const result = hostFunction.execute(hostContext, null)

//           // Host function mutates context directly, resultCode is null if continue
//           return {
//             resultCode:
//               result instanceof Promise
//                 ? RESULT_CODES.PANIC
//                 : (result.resultCode ?? RESULT_CODES.HALT),
//             gasCounter: hostContext.gasCounter,
//             registers: hostContext.registers,
//             memory: hostContext.ram,
//             context: null,
//           }
//         }

//         if (hostCallId === GENERAL_FUNCTIONS.FETCH) {
//           // Ω_Y(gascounter, registers, memory, wpX, none, none, none, none, none, none, none)
//           const hostFunction = this.hostFunctionRegistry.get(
//             GENERAL_FUNCTIONS.FETCH,
//           )
//           if (!hostFunction) {
//             logger.error('Fetch host function not found in registry')
//             return {
//               resultCode: RESULT_CODES.PANIC,
//               gasCounter,
//               registers,
//               memory,
//               context: null,
//             }
//           }

//           // Create refine context with work package and all other params as null/none
//           // Gray Paper: Ω_Y(..., wpX, none, none, none, none, none, none, none)
//           const refineContext = {
//             machines: new Map(),
//             exportSegments: [],
//             coreIndex: 0n,
//             workItemIndex: 0n,
//             workPackage,
//             authorizerTrace: '0x' as const,
//             importSegments: [],
//             exportSegmentOffset: 0n,
//             accountsDictionary: new Map(),
//             lookupTimeslot: workPackage.context.lookup_anchor_slot,
//             currentServiceId: 0n,
//           }

//           // Create log function for is-authorized host function context
//           const isAuthorizedHostFunctionLog = (
//             message: string,
//             data?: Record<string, unknown>,
//           ) => {
//             if (!this.executionLogs) {
//               this.executionLogs = []
//             }
//             this.executionLogs.push({
//               pc: this.state.programCounter,
//               instructionName: `HOST_${hostFunction.name}`,
//               opcode: `0x${hostCallId.toString(16)}`,
//               message,
//               data,
//               timestamp: Date.now(),
//             })
//           }

//           const hostContext = {
//             gasCounter,
//             registers,
//             ram: memory,
//             log: isAuthorizedHostFunctionLog,
//           }

//           const result = hostFunction.execute(hostContext, refineContext)

//           // Host function mutates context directly, resultCode is null if continue
//           return {
//             resultCode:
//               result instanceof Promise
//                 ? RESULT_CODES.PANIC
//                 : (result.resultCode ?? RESULT_CODES.HALT),
//             gasCounter: hostContext.gasCounter,
//             registers: hostContext.registers,
//             memory: hostContext.ram,
//             context: null,
//           }
//         }

//         // Unknown host call: Gray Paper default behavior
//         // registers' = registers except registers'[7] = WHAT
//         // gascounter' = gascounter - 10
//         const newRegisters = [...registers]
//         newRegisters[7] = ACCUMULATE_ERROR_CODES.WHAT

//         const gasCost = 10n
//         const newGasCounter = gasCounter - gasCost

//         // If gas < 0: return oog
//         if (newGasCounter < 0n) {
//           return {
//             resultCode: RESULT_CODES.OOG,
//             gasCounter: newGasCounter,
//             registers: newRegisters,
//             memory,
//             context: null,
//           }
//         }

//         // Otherwise: continue (Gray Paper: continue means execution continues)
//         // Use HALT as default - execution will continue if resultCode allows
//         return {
//           resultCode: RESULT_CODES.HALT,
//           gasCounter: newGasCounter,
//           registers: newRegisters,
//           memory,
//           context: null,
//         }
//       } catch (error) {
//         logger.error('Is-Authorized host function execution failed', {
//           error,
//           hostCallId,
//         })
//         return {
//           resultCode: RESULT_CODES.PANIC,
//           gasCounter,
//           registers,
//           memory,
//           context: null,
//         }
//       }
//     }
//   }
// }
