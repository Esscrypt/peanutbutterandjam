/**
 * Rust PVM Executor
 *
 * Wraps the Rust native PVM (@pbnjam/pvm-rust-native) to provide the same interface
 * and return format as WasmPVMExecutor. Matches pvm-rust lib.rs NAPI bindings:
 * setupAccumulateInvocation (single call with encoded_accumulate_inputs), nextStep,
 * getStatus, getGasLeft, getResult, getAccumulationContext.
 *
 * Build with: cd packages/pvm-rust && bun run build
 */

import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

import {
  decodeImplicationsPair,
  encodeAccumulateInput,
  encodeImplicationsPair,
  encodeVariableSequence,
} from '@pbnjam/codec'
import { getInstructionName, writeTraceDump } from '@pbnjam/pvm'
import type {
  AccumulateInput,
  IConfigService,
  IEntropyService,
  ImplicationsPair,
  SafePromise,
} from '@pbnjam/types'
import { RESULT_CODES, safeError, safeResult } from '@pbnjam/types'

/** NAPI binding: camelCase exports from @pbnjam/pvm-rust-native (matches lib.rs). */
export type NativeBinding = {
  init: (ramType: number) => void
  reset: () => void
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
    encodedAccumulateInputs: Buffer[] | null | undefined,
    configPreimageExpungePeriod: number,
    configEpochDuration: number,
    configMaxBlockGas: number,
    configMaxRefineGas: number,
    configMaxTicketsPerExtrinsic: number,
    configTicketsPerValidator: number,
    configSlotDuration: number,
    configRotationPeriod: number,
    configNumEcPiecesPerSegment: number,
    configContestDuration: number,
    configMaxLookupAnchorage: number,
    configEcPieceSize: number,
  ) => void
  nextStep: () => boolean
  getStatus: () => number
  getGasLeft: () => number
  getProgramCounter?: () => number
  getRegisters?: () => Buffer
  getLastOpcode?: () => number
  getHostCallId?: () => number
  getLastLoadAddress?: () => number
  getLastLoadValue?: () => bigint
  getLastStoreAddress?: () => number
  getLastStoreValue?: () => bigint
  getResult: () => Buffer
  getYieldHash: () => Buffer
  getAccumulationContext: (
    numCores: number,
    numValidators: number,
    authQueueSize: number,
  ) => Buffer
}

function loadNative(): NativeBinding | null {
  try {
    return require('@pbnjam/pvm-rust-native/native') as NativeBinding
  } catch {
    return null
  }
}

const AUTH_QUEUE_SIZE = 80
const RAM_TYPE_PVM_RAM = 0

export class RustPVMExecutor {
  private readonly native: NativeBinding | null
  private readonly configService: IConfigService
  private readonly entropyService: IEntropyService
  private readonly traceSubfolder: string | undefined

  constructor(
    configService: IConfigService,
    entropyService: IEntropyService,
    traceSubfolder?: string,
  ) {
    this.configService = configService
    this.entropyService = entropyService
    this.traceSubfolder = traceSubfolder
    const binding = loadNative()
    if (
      !binding?.setupAccumulateInvocation ||
      !binding?.getAccumulationContext
    ) {
      this.native = null
      return
    }
    this.native = binding
    this.native.init(RAM_TYPE_PVM_RAM)
  }

  /**
   * Execute accumulation invocation. Returns the same format as WasmPVMExecutor:
   * { gasConsumed, result, context } with context from getAccumulationContext.
   */
  async executeAccumulationInvocation(
    preimageBlob: Uint8Array,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    implicationsPair: ImplicationsPair,
    _timeslot: bigint,
    _inputs: AccumulateInput[],
    _serviceId: bigint,
    _invocationIndex?: number,
    entropyOverride?: Uint8Array,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: ImplicationsPair
  }> {
    if (!this.native) {
      return safeError(
        new Error(
          'Rust native module not available. Build with: cd packages/pvm-rust && bun run build',
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
    const entropyAccumulator =
      entropyOverride && entropyOverride.length === 32
        ? Buffer.from(entropyOverride)
        : Buffer.from(this.entropyService.getEntropyAccumulator())

    if (entropyAccumulator.length !== 32) {
      return safeError(
        new Error(
          `Invalid entropy accumulator length: expected 32 bytes, got ${entropyAccumulator.length}`,
        ),
      )
    }

    const inputsToEncode = _inputs && _inputs.length > 0 ? _inputs : []
    const [encodeErr, encoded] = encodeVariableSequence(
      inputsToEncode,
      encodeAccumulateInput,
    )
    if (encodeErr || !encoded) {
      return safeError(
        new Error(`Failed to encode accumulate inputs: ${encodeErr?.message}`),
      )
    }
    const encodedAccumulateInputs: Buffer[] | null =
      inputsToEncode.length > 0
        ? (() => {
            const arr: Buffer[] = []
            for (const inp of inputsToEncode) {
              const [e, b] = encodeAccumulateInput(inp)
              if (!e && b) arr.push(Buffer.from(b))
            }
            return arr.length > 0 ? arr : null
          })()
        : null

    this.native.reset()
    this.native.setupAccumulateInvocation(
      Number(gasLimit),
      Buffer.from(preimageBlob),
      Buffer.from(encodedArgs),
      Buffer.from(encodedContext),
      numCores,
      numValidators,
      AUTH_QUEUE_SIZE,
      entropyAccumulator,
      Buffer.from(encoded),
      encodedAccumulateInputs ?? undefined,
      this.configService.preimageExpungePeriod,
      this.configService.epochDuration,
      Number(this.configService.maxBlockGas),
      Number(this.configService.maxRefineGas),
      this.configService.maxTicketsPerExtrinsic,
      this.configService.ticketsPerValidator,
      Math.floor(this.configService.slotDuration / 1000),
      this.configService.rotationPeriod,
      this.configService.numEcPiecesPerSegment,
      this.configService.contestDuration,
      this.configService.maxLookupAnchorage,
      this.configService.ecPieceSize,
    )

    const initialGas = gasLimit
    const maxSteps = Number(this.configService.maxBlockGas)
    let steps = 0
    const enableTrace =
      this.traceSubfolder && process.env['ENABLE_PVM_TRACE_DUMP'] === 'true'
    const executionLogs: Array<{
      step: number
      pc: bigint
      instructionName: string
      opcode: string
      gas: bigint
      registers: string[]
      loadAddress?: number
      loadValue?: bigint
      storeAddress?: number
      storeValue?: bigint
    }> = []
    const hostFunctionLogs: Array<{
      step: number
      hostCallId: bigint
      gasBefore: bigint
      gasAfter: bigint
      serviceId?: bigint
    }> = []

    while (steps < maxSteps) {
      const gasBeforeStep = this.native.getGasLeft()
      const shouldContinue = this.native.nextStep()
      steps++
      const status = this.native.getStatus()

      if (enableTrace) {
        const gasRaw = this.native.getGasLeft()
        const gasAfter =
          gasRaw >>> 0 === gasRaw
            ? BigInt(gasRaw)
            : BigInt(gasRaw >>> 0) + 0x1_0000_0000n
        const pc = this.native.getProgramCounter
          ? BigInt(this.native.getProgramCounter())
          : 0n
        const registers: string[] = []
        if (this.native.getRegisters) {
          const buf = this.native.getRegisters()
          for (let i = 0; i < 13; i++) {
            registers.push((buf as Buffer).readBigUInt64LE(i * 8).toString())
          }
        }
        const loadAddress = this.native.getLastLoadAddress?.() ?? 0
        const loadValue = this.native.getLastLoadValue?.() ?? 0n
        const storeAddress = this.native.getLastStoreAddress?.() ?? 0
        const storeValue = this.native.getLastStoreValue?.() ?? 0n
        const opcodeNum = this.native.getLastOpcode?.() ?? 0
        const instructionName = getInstructionName(opcodeNum)
        executionLogs.push({
          step: steps,
          pc,
          instructionName,
          opcode: instructionName,
          gas: gasAfter,
          registers,
          loadAddress,
          loadValue,
          storeAddress,
          storeValue,
        })
        const hostCallId = this.native.getHostCallId?.() ?? 0
        if (hostCallId !== 0) {
          hostFunctionLogs.push({
            step: steps,
            hostCallId: BigInt(hostCallId),
            gasBefore: BigInt(gasBeforeStep >>> 0),
            gasAfter,
            serviceId: _serviceId,
          })
        }
      }

      if (!shouldContinue) {
        if (status === 4) continue
        break
      }
      if (status !== 0 && status !== 4) break
    }

    const finalGasRaw = this.native.getGasLeft()
    const finalGas =
      finalGasRaw >>> 0 === finalGasRaw
        ? BigInt(finalGasRaw)
        : BigInt(finalGasRaw >>> 0) + 0x1_0000_0000n
    const status = this.native.getStatus()

    let gasConsumed: bigint
    if (status === 5) {
      gasConsumed = initialGas
    } else {
      const remaining = finalGas > initialGas ? 0n : finalGas
      gasConsumed = initialGas - remaining
    }
    if (gasConsumed < 0n) gasConsumed = 0n
    if (gasConsumed > initialGas) gasConsumed = initialGas

    let result: Uint8Array | 'PANIC' | 'OOG'
    if (status === 5) {
      result = 'OOG'
    } else if (status === 2 || status === 3) {
      result = 'PANIC'
    } else {
      result = Buffer.from(this.native.getResult())
    }

    const updatedEncodedContext = this.native.getAccumulationContext(
      numCores,
      numValidators,
      AUTH_QUEUE_SIZE,
    )

    const [decodeError, decodeResult] = decodeImplicationsPair(
      new Uint8Array(updatedEncodedContext),
      this.configService,
    )
    if (decodeError || !decodeResult) {
      return safeError(
        new Error(
          `Failed to decode updated implications: ${decodeError?.message}`,
        ),
      )
    }
    const updatedContext = decodeResult.value

    // Trace dump: per-step executionLogs when enableTrace, else single synthetic line. writeTraceDump requires executionLogs.length > 0.
    if (
      this.traceSubfolder &&
      process.env['ENABLE_PVM_TRACE_DUMP'] === 'true'
    ) {
      const traceOutputDir = join(
        process.cwd(),
        'pvm-traces',
        this.traceSubfolder,
      )
      const logsToWrite =
        executionLogs.length > 0
          ? executionLogs
          : [
              {
                step: steps,
                pc: 0n,
                instructionName: 'rust-summary',
                opcode: '',
                gas: gasConsumed,
                registers: [] as string[],
              },
            ]
      const hostLogsToWrite =
        executionLogs.length > 0 ? hostFunctionLogs : undefined
      let errorCode: number | undefined
      if (status === 2) errorCode = RESULT_CODES.PANIC
      else if (status === 3) errorCode = RESULT_CODES.FAULT
      else if (status === 5) errorCode = RESULT_CODES.OOG
      let yieldHash: Uint8Array | undefined
      if (result === 'PANIC' || result === 'OOG') {
        yieldHash = updatedContext[1]?.yield ?? undefined
      } else if (result instanceof Uint8Array && result.length === 32) {
        yieldHash = result
      } else {
        yieldHash = updatedContext[0]?.yield ?? undefined
      }
      const [encodeError, encodedInputs] = encodeVariableSequence(
        _inputs,
        encodeAccumulateInput,
      )
      writeTraceDump(
        logsToWrite,
        hostLogsToWrite,
        traceOutputDir,
        undefined,
        _timeslot,
        'rust',
        _serviceId,
        encodeError ? undefined : encodedInputs,
        _invocationIndex ?? 0,
        yieldHash,
        errorCode,
      )
    }

    return safeResult({
      gasConsumed,
      result,
      context: updatedContext,
    })
  }

  dispose(): void {
    // No persistent state to clear when using minimal NAPI binding
  }
}
