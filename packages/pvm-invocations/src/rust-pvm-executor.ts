/**
 * Rust PVM Executor
 *
 * Wraps the Rust native PVM implementation (pvm-rust NAPI addon) with the same
 * interface as WasmPVMExecutor. Use when useRust is true in AccumulatePVM options.
 *
 * Uses NAPI bindings like bandersnatch-vrf: createRequire(import.meta.url) to load
 * @pbnjam/pvm-rust-native/native in ESM. Build with: cd packages/pvm-rust && bun run build
 */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

import {
  decodeImplicationsPair,
  encodeAccumulateInput,
  encodeImplicationsPair,
  encodeVariableSequence,
} from '@pbnjam/codec'
import { logger } from '@pbnjam/core'
import { writeTraceDump } from '@pbnjam/pvm'
import type {
  AccumulateInput,
  IConfigService,
  IEntropyService,
  ImplicationsPair,
  PVMInstruction,
  PVMState,
  RAM,
  ResultCode,
  SafePromise,
} from '@pbnjam/types'
import { RESULT_CODES, safeError, safeResult } from '@pbnjam/types'
import { InstructionRegistry } from '../../pvm/src/instructions/registry'

type NativeBinding = {
  init: (ramType: number) => void
  reset: () => void
  /** Matches pvm-rust lib.rs setup_accumulate_invocation (camelCase). Order and types must stay in sync. */
  setupAccumulateInvocation: (
    gasLimit: number,
    program: Buffer,
    args: Buffer,
    context: Buffer,
    numCores: number,
    numValidators: number,
    authQueueSize: number,
    entropyAccumulator: Buffer,
    encodedWorkItems: Buffer,
    configNumCores: number,
    configPreimageExpungePeriod: number,
    configEpochDuration: number,
    configMaxBlockGas: number,
    configMaxRefineGas: number,
    configMaxTicketsPerExtrinsic: number,
    configTicketsPerValidator: number,
    configSlotDuration: number,
    configRotationPeriod: number,
    configNumValidators: number,
    configNumEcPiecesPerSegment: number,
    configContestDuration: number,
    configMaxLookupAnchorage: number,
    configEcPieceSize: number,
    jamVersionMajor: number,
    jamVersionMinor: number,
    jamVersionPatch: number,
  ) => void
  setAccumulateInputs: (inputs: Buffer[] | null) => void
  setFetchWorkPackage: (encoded: Buffer | null) => void
  setFetchAuthConfig: (data: Buffer | null) => void
  setFetchAuthToken: (data: Buffer | null) => void
  setFetchRefineContext: (encoded: Buffer | null) => void
  setFetchWorkItemSummaries: (summaries: Buffer[] | null) => void
  setFetchWorkItemPayloads: (payloads: Buffer[] | null) => void
  nextStep: () => boolean
  getProgramCounter: () => number
  getGasLeft: () => number
  getStatus: () => number
  getRegisters: () => Buffer
  getResult: () => Buffer
  getAccumulationContext: (
    numCores: number,
    numValidators: number,
    authQueueSize: number,
  ) => Buffer
  clearLastMemoryOp: () => void
  getCode: () => Buffer
  getBitmask: () => Buffer
  getLastLoadAddress: () => number
  getLastLoadValue: () => number
  getLastStoreAddress: () => number
  getLastStoreValue: () => number
  getRamTypePvmRam: () => number
  getHostCallId: () => number
  getExitArg: () => number
  setNextProgramCounter: (pc: number) => void
  getAndClearLogMessages: () => string[]
}

function loadNativeBinding(): NativeBinding {
  const binding = require('@pbnjam/pvm-rust-native/native') as NativeBinding
  if (!binding?.init) {
    throw new Error(
      'Rust PVM native module not available. Build with: cd packages/pvm-rust && bun run build.',
    )
  }
  return binding
}

/** Treat native getGasLeft() as u32 so values >= 2^31 are not negative in JS. */
function gasLeftAsUnsigned(native: NativeBinding): number {
  const raw = native.getGasLeft()
  return raw < 0 ? raw + 0x1_0000_0000 : raw
}

/** Status codes: 0=Ok, 1=Halt, 2=Panic, 3=Fault, 4=Host, 5=Oog. */
function statusMeaning(status: number): string {
  const m: Record<number, string> = {
    0: 'Ok',
    1: 'Halt',
    2: 'Panic',
    3: 'Fault',
    4: 'Host',
    5: 'Oog',
  }
  return m[status] ?? `Unknown(${status})`
}

export class RustPVMExecutor {
  private native: NativeBinding
  private readonly configService: IConfigService
  private readonly entropyService: IEntropyService
  private readonly workspaceRoot: string
  private readonly traceSubfolder?: string

  private currentState: PVMState | null = null
  private executionLogs: Array<{
    step: number
    pc: bigint
    instructionName: string
    opcode: string
    gas: bigint
    registers: string[]
    loadAddress: number
    loadValue: bigint
    storeAddress: number
    storeValue: bigint
  }> = []
  private traceHostFunctionLogs: Array<{
    step: number
    hostCallId: bigint
    gasBefore: bigint
    gasAfter: bigint
    serviceId?: bigint
  }> = []
  private readonly instructionRegistry: InstructionRegistry =
    new InstructionRegistry()
  private code: Uint8Array = new Uint8Array(0)
  private bitmask: Uint8Array = new Uint8Array(0)

  constructor(
    configService: IConfigService,
    entropyService: IEntropyService,
    traceSubfolder?: string,
  ) {
    this.native = loadNativeBinding()
    this.configService = configService
    this.entropyService = entropyService
    this.traceSubfolder = traceSubfolder

    const currentDir =
      typeof __dirname !== 'undefined'
        ? __dirname
        : dirname(fileURLToPath(import.meta.url))
    let searchDir = currentDir
    let found = false
    for (let i = 0; i < 10; i++) {
      if (
        existsSync(join(searchDir, 'turbo.json')) ||
        (existsSync(join(searchDir, 'package.json')) &&
          existsSync(join(searchDir, 'packages')))
      ) {
        found = true
        break
      }
      const parent = dirname(searchDir)
      if (parent === searchDir) break
      searchDir = parent
    }
    this.workspaceRoot = found ? searchDir! : process.cwd()
  }

  async executeAccumulationInvocation(
    preimageBlob: Uint8Array,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    implicationsPair: ImplicationsPair,
    _timeslot: bigint,
    _inputs: AccumulateInput[],
    serviceId: bigint,
    invocationIndex?: number,
    entropyOverride?: Uint8Array,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: ImplicationsPair
  }> {
    // #region agent log
    fetch(
      'http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'rust-pvm-executor.ts:executeAccumulationInvocation',
          message: 'executor invocation started',
          data: {
            traceSubfolder: this.traceSubfolder,
            workspaceRoot: this.workspaceRoot,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'H2,H3',
        }),
      },
    ).catch(() => {})
    // #endregion
    this.native.reset()
    this.native.init(this.native.getRamTypePvmRam())

    if (!this.configService || !this.entropyService) {
      return safeError(
        new Error(
          'ConfigService and EntropyService required for accumulation invocation',
        ),
      )
    }

    const [contextError, encodedContext] = encodeImplicationsPair(
      implicationsPair,
      this.configService,
    )
    if (contextError || !encodedContext) {
      return safeError(
        new Error(`Failed to encode context: ${contextError?.message}`),
      )
    }

    const numCores = this.configService.numCores
    const numValidators = this.configService.numValidators
    const authQueueSize = 80
    const entropyAccumulator =
      entropyOverride && entropyOverride.length === 32
        ? entropyOverride
        : this.entropyService.getEntropyAccumulator()

    if (entropyAccumulator.length !== 32) {
      return safeError(
        new Error(
          `Invalid entropy accumulator length: expected 32 bytes, got ${entropyAccumulator.length}`,
        ),
      )
    }

    const inputsToEncode = _inputs && _inputs.length > 0 ? _inputs : []
    const [encodeError, encoded] = encodeVariableSequence(
      inputsToEncode,
      encodeAccumulateInput,
    )
    if (encodeError || !encoded) {
      return safeError(
        new Error(
          `Failed to encode accumulate inputs: ${encodeError?.message}`,
        ),
      )
    }

    const jamVersion = this.configService.jamVersion
    const accumulateInputsForFetch: Buffer[] = []
    for (const input of inputsToEncode) {
      const [err, encoded] = encodeAccumulateInput(input, jamVersion)
      if (err || !encoded) continue
      accumulateInputsForFetch.push(Buffer.from(encoded))
    }
    this.native.setAccumulateInputs(
      accumulateInputsForFetch.length > 0 ? accumulateInputsForFetch : null,
    )

    this.native.setupAccumulateInvocation(
      Number(gasLimit),
      Buffer.from(preimageBlob),
      Buffer.from(encodedArgs),
      Buffer.from(encodedContext),
      numCores,
      numValidators,
      authQueueSize,
      Buffer.from(entropyAccumulator),
      Buffer.from(encoded),
      this.configService.numCores,
      this.configService.preimageExpungePeriod,
      this.configService.epochDuration,
      Number(this.configService.maxBlockGas),
      Number(this.configService.maxRefineGas),
      this.configService.maxTicketsPerExtrinsic,
      this.configService.ticketsPerValidator,
      Math.floor(this.configService.slotDuration / 1000),
      this.configService.rotationPeriod,
      this.configService.numValidators,
      this.configService.numEcPiecesPerSegment,
      this.configService.contestDuration,
      this.configService.maxLookupAnchorage,
      this.configService.ecPieceSize,
      this.configService.jamVersion.major,
      this.configService.jamVersion.minor,
      this.configService.jamVersion.patch,
    )

    this.executionLogs = []
    this.traceHostFunctionLogs = []

    const initialGas = gasLimit
    let steps = 0
    const maxSteps = this.configService.maxBlockGas

    const debugRustPvm =
      process.env['PVM_RUST_DEBUG'] === '1' ||
      process.env['PVM_RUST_DEBUG'] === 'true'
    const initialCode = this.native.getCode()
    const initialPc = this.native.getProgramCounter()
    const initialGasLeft = gasLeftAsUnsigned(this.native)
    const initialStatus = this.native.getStatus()
    logger.debug('[RustPVMExecutor] executeAccumulationInvocation start', {
      gasLimit: gasLimit.toString(),
      preimageBlobLen: preimageBlob.length,
      encodedArgsLen: encodedArgs.length,
      encodedContextLen: encodedContext?.length ?? 0,
      maxSteps,
    })
    logger.debug(
      '[RustPVMExecutor] state after setup (before first nextStep)',
      {
        codeLength: initialCode?.length ?? 0,
        pc: initialPc,
        gasLeft: initialGasLeft,
        status: initialStatus,
        statusMeaning: statusMeaning(initialStatus),
      },
    )

    while (steps < maxSteps) {
      const pcBefore = BigInt(this.native.getProgramCounter())
      const gasBefore = BigInt(gasLeftAsUnsigned(this.native))

      if (steps === 0) {
        this.code = new Uint8Array(this.native.getCode())
        this.bitmask = new Uint8Array(this.native.getBitmask())
      }

      this.native.clearLastMemoryOp()
      const shouldContinue = this.native.nextStep()
      steps++
      const logMessages = this.native.getAndClearLogMessages()
      for (const msg of logMessages) {
        console.log(msg)
      }

      const loadAddress = this.native.getLastLoadAddress()
      const loadValue = BigInt(this.native.getLastLoadValue())
      const storeAddress = this.native.getLastStoreAddress()
      const storeValue = BigInt(this.native.getLastStoreValue())
      const gasAfter = BigInt(gasLeftAsUnsigned(this.native))
      const registersAfter = this.native.getRegisters()
      const registerStateAfter: bigint[] = []
      const registerViewAfter = new DataView(
        registersAfter.buffer,
        registersAfter.byteOffset,
        registersAfter.byteLength,
      )
      for (let i = 0; i < 13; i++) {
        registerStateAfter[i] = registerViewAfter.getBigUint64(i * 8, true)
      }

      const status = this.native.getStatus()

      if (debugRustPvm && steps === 1) {
        logger.debug('[RustPVMExecutor] after first nextStep', {
          pcBefore: pcBefore.toString(),
          gasBefore: gasBefore.toString(),
          gasAfter: gasAfter.toString(),
          status,
          statusMeaning: statusMeaning(status),
          shouldContinue,
        })
      }

      // Status 4 (Host) is used by WASM/TS executors; Rust PVM runs the host inside nextStep() and returns Ok.
      if (status === 4) {
        this.traceHostFunctionLogs.push({
          step: steps,
          hostCallId: BigInt(this.native.getHostCallId()),
          gasBefore: gasBefore - 1n,
          gasAfter,
          serviceId,
        })
      }

      const codeArray = this.code
      const bitmaskArray = this.bitmask
      const pcIndex = Number(pcBefore)
      let instructionName = 'UNKNOWN'
      let opcode = '0x00'
      if (
        pcIndex >= 0 &&
        pcIndex < codeArray.length &&
        pcIndex < bitmaskArray.length
      ) {
        if (bitmaskArray[pcIndex] === 1) {
          const instructionOpcode = codeArray[pcIndex]
          const handler = this.instructionRegistry.getHandler(
            BigInt(instructionOpcode),
          )
          instructionName = handler?.name ?? 'UNKNOWN'
          opcode = `0x${instructionOpcode.toString(16)}`
        }
      }

      // Rust PVM runs host functions inside nextStep() and returns status Ok, so we never see status 4.
      // Record host call when the instruction we just ran was ECALLI (getHostCallId() is still set).
      if (instructionName === 'ECALLI') {
        this.traceHostFunctionLogs.push({
          step: steps,
          hostCallId: BigInt(this.native.getHostCallId()),
          gasBefore: gasBefore - 1n,
          gasAfter,
          serviceId,
        })
      }

      this.executionLogs.push({
        step: steps,
        pc: pcBefore,
        instructionName,
        opcode,
        gas: gasAfter,
        registers: registerStateAfter.map((r) => r.toString()),
        loadAddress,
        loadValue,
        storeAddress,
        storeValue,
      })

      if (debugRustPvm) {
        logger.debug('[RustPVMExecutor] step', {
          step: steps,
          pc: pcBefore.toString(),
          opcode,
          instructionName,
          status: statusMeaning(status),
        })
      }

      if (!shouldContinue) {
        // #region agent log
        if (status !== 4)
          fetch(
            'http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'rust-pvm-executor.ts:loop exit halt',
                message: 'step loop exited !shouldContinue',
                data: {
                  steps,
                  executionLogsLength: this.executionLogs.length,
                  status,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                hypothesisId: 'H4',
              }),
            },
          ).catch(() => {})
        // #endregion
        if (status === 4) {
          // Advance PC past ECALLI so next iteration does not re-execute it (Rust PVM does not run host internally).
          const instructionLength = this.computeInstructionLength(
            pcIndex,
            this.code,
            this.bitmask,
          )
          this.native.setNextProgramCounter(pcIndex + instructionLength)

          if (debugRustPvm) {
            logger.debug('[RustPVMExecutor] host call, advancing PC', {
              pcIndex,
              instructionLength,
              newPc: pcIndex + instructionLength,
            })
          }
          continue
        }
        if (status === 3) {
          const faultAddress = this.native.getExitArg()
          logger.warn('[RustPVMExecutor] FAULT instrumentation', {
            step: steps,
            pc: pcBefore.toString(),
            opcode,
            instructionName,
            faultAddress: `0x${faultAddress.toString(16)}`,
            statusMeaning: statusMeaning(status),
          })
        }
        if (debugRustPvm) {
          logger.debug(
            '[RustPVMExecutor] break: shouldContinue=false, not host',
            {
              steps,
              status,
              statusMeaning: statusMeaning(status),
            },
          )
        }
        break
      }
      if (status !== 0 && status !== 4) {
        // #region agent log
        fetch(
          'http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'rust-pvm-executor.ts:loop exit',
              message: 'step loop exited',
              data: {
                steps,
                executionLogsLength: this.executionLogs.length,
                status,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              hypothesisId: 'H4',
            }),
          },
        ).catch(() => {})
        // #endregion
        if (status === 3) {
          const faultAddress = this.native.getExitArg()
          logger.warn('[RustPVMExecutor] FAULT instrumentation', {
            step: steps,
            pc: pcBefore.toString(),
            opcode,
            instructionName,
            faultAddress: `0x${faultAddress.toString(16)}`,
            statusMeaning: statusMeaning(status),
          })
        }
        if (debugRustPvm) {
          logger.debug('[RustPVMExecutor] break: status not Ok nor Host', {
            steps,
            status,
            statusMeaning: statusMeaning(status),
          })
        }
        break
      }
    }

    const finalGasRaw = gasLeftAsUnsigned(this.native)
    const finalGas = BigInt(finalGasRaw)
    const status = this.native.getStatus()

    logger.debug('[RustPVMExecutor] step loop finished', {
      steps,
      initialGas: initialGas.toString(),
      finalGasLeft: finalGas.toString(),
      status,
      statusMeaning: statusMeaning(status),
    })
    if (steps === 0) {
      logger.info('[RustPVMExecutor] no steps executed', {
        codeLength: initialCode?.length ?? 0,
        pc: initialPc,
        gasLeft: initialGasLeft,
        status: initialStatus,
        statusMeaning: statusMeaning(initialStatus),
      })
    }

    let gasConsumed: bigint
    if (status === 5) {
      gasConsumed = initialGas
    } else {
      const remaining = finalGas > initialGas ? 0n : finalGas
      gasConsumed = initialGas - remaining
    }
    if (gasConsumed < 0n) gasConsumed = 0n
    if (gasConsumed > initialGas) gasConsumed = initialGas

    logger.debug('[RustPVMExecutor] invocation result', {
      gasConsumed: gasConsumed.toString(),
      status,
      statusMeaning: statusMeaning(status),
    })
    if (gasConsumed === 0n && steps > 0) {
      logger.info('[RustPVMExecutor] steps executed but gas consumed is zero', {
        steps,
        status,
        statusMeaning: statusMeaning(status),
      })
    }

    let result: Uint8Array | 'PANIC' | 'OOG'
    if (status === 5) {
      result = 'OOG'
    } else if (status === 2 || status === 3) {
      result = 'PANIC'
    } else {
      const rawResult = this.native.getResult()
      result =
        rawResult && rawResult.length >= 0
          ? new Uint8Array(rawResult)
          : new Uint8Array(0)
    }

    this.updateStateFromNative()

    const updatedEncodedContext = this.native.getAccumulationContext(
      numCores,
      numValidators,
      authQueueSize,
    )

    let updatedContext: ImplicationsPair = implicationsPair
    if (updatedEncodedContext && updatedEncodedContext.length > 0) {
      if (updatedEncodedContext.length === 32) {
        // Rust native returns only the yield hash (no full ImplicationsPair encoding)
        updatedContext = [
          {
            ...implicationsPair[0],
            yield: new Uint8Array(updatedEncodedContext),
          },
          implicationsPair[1],
        ]
      } else {
        const [decodeError, decodeResult] = decodeImplicationsPair(
          new Uint8Array(updatedEncodedContext),
          this.configService,
        )
        if (!decodeError && decodeResult) {
          updatedContext = decodeResult.value
        } else {
          logger.warning(
            `[RustPVMExecutor] Failed to decode updated implications: ${decodeError?.message}`,
          )
        }
      }
    }

    // #region agent log
    fetch(
      'http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'rust-pvm-executor.ts:before writeTraceDump',
          message: 'check write path',
          data: {
            executionLogsLength: this.executionLogs.length,
            traceSubfolder: this.traceSubfolder,
            workspaceRoot: this.workspaceRoot,
            willWrite: this.executionLogs.length > 0 && !!this.traceSubfolder,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'H4,H5',
        }),
      },
    ).catch(() => {})
    // #endregion
    if (this.executionLogs.length > 0 && this.traceSubfolder) {
      const baseTraceDir = join(this.workspaceRoot, 'pvm-traces')
      const traceOutputDir = join(baseTraceDir, this.traceSubfolder)
      const [encodeErr, encodedInputs] = encodeVariableSequence(
        _inputs,
        encodeAccumulateInput,
      )
      let errorCode: number | undefined
      if (status === 2) errorCode = RESULT_CODES.PANIC
      else if (status === 3) errorCode = RESULT_CODES.FAULT
      else if (status === 5) errorCode = RESULT_CODES.OOG
      let yieldHash: Uint8Array | null | undefined
      if (result === 'PANIC' || result === 'OOG') {
        yieldHash = updatedContext?.[1]?.yield ?? undefined
      } else if (result instanceof Uint8Array && result.length === 32) {
        yieldHash = result
      } else {
        yieldHash = updatedContext?.[0]?.yield ?? undefined
      }
      writeTraceDump(
        this.executionLogs,
        this.traceHostFunctionLogs.length > 0
          ? this.traceHostFunctionLogs
          : undefined,
        traceOutputDir,
        undefined,
        _timeslot,
        'rust',
        serviceId,
        encodeErr ? undefined : encodedInputs,
        invocationIndex ?? 0,
        yieldHash ?? undefined,
        errorCode,
      )
    }

    return safeResult({
      gasConsumed,
      result,
      context: updatedContext,
    })
  }

  getState(): PVMState {
    if (!this.currentState) {
      this.updateStateFromNative()
    }
    return this.currentState!
  }

  get state(): PVMState {
    return this.getState()
  }

  private updateStateFromNative(): void {
    const registers = this.native.getRegisters()
    const registerState: bigint[] = []
    const registerView = new DataView(
      registers.buffer,
      registers.byteOffset,
      registers.byteLength,
    )
    for (let i = 0; i < 13; i++) {
      registerState[i] = registerView.getBigUint64(i * 8, true)
    }

    const status = this.native.getStatus()
    this.currentState = {
      instructions: new Map<number, PVMInstruction>(),
      resultCode: 0 as ResultCode,
      programCounter: BigInt(this.native.getProgramCounter()),
      registerState,
      ram: null as unknown as RAM,
      gasCounter: BigInt(gasLeftAsUnsigned(this.native)),
      jumpTable: [],
      code: new Uint8Array(0),
      bitmask: new Uint8Array(0),
      faultAddress: null,
      hostCallId: status === 4 ? BigInt(this.native.getHostCallId()) : null,
    }
  }

  /**
   * Compute instruction length at pc (Gray Paper Fskip: 1 + number of operand bytes).
   * Used to advance PC past ECALLI when handling host calls.
   */
  private computeInstructionLength(
    pc: number,
    codeArray: Uint8Array,
    bitmaskArray: Uint8Array,
  ): number {
    let fskip = -1
    for (let j = 0; j < 24 && pc + 1 + j < bitmaskArray.length; j++) {
      if (bitmaskArray[pc + 1 + j] === 1) {
        fskip = j
        break
      }
    }
    if (fskip === -1 && pc + 1 < codeArray.length) {
      fskip = Math.min(24, codeArray.length - pc - 1)
    } else if (fskip === -1) {
      fskip = 0
    }
    return 1 + fskip
  }

  dispose(): void {
    this.currentState = null
    this.executionLogs = []
    this.traceHostFunctionLogs = []
    this.code = new Uint8Array(0)
    this.bitmask = new Uint8Array(0)
  }
}
