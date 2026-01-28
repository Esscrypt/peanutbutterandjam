/**
 * Worker thread for executing PVM accumulate invocations
 *
 * This worker runs in a separate thread and executes accumulate invocations
 * in parallel with other workers.
 */

import { parentPort, workerData } from 'node:worker_threads'
import { EventBusService } from '@pbnjam/core'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'
import type {
  AccumulateInput,
  AccumulateInvocationResult,
  PartialState,
  ServiceAccount,
  WorkExecutionResult,
} from '@pbnjam/types'
import { ConfigService } from '../config-service'
import { EntropyService } from '../entropy'
import type { WorkerData } from './pvm-worker-pool'

let accumulatePVM: AccumulatePVM | null = null

interface WorkerTask {
  partialState: SerializedPartialState
  currentSlot: string
  serviceId: string
  gasLimit: string
  inputs: SerializedAccumulateInput[]
  invocationIndex: number
  entropyAccumulator?: { data: number[] }
}

interface WorkerMessage {
  type: 'execute' | 'ready' | 'result' | 'error' | 'shutdown'
  messageId?: string
  task?: WorkerTask
  result?: SerializedAccumulateInvocationResult
  error?: string
  metrics?: {
    deserializeTimeMs: number
    executeTimeMs: number
    serializeTimeMs: number
    totalTimeMs: number
    serviceId: string
    invocationIndex: number
    inputsCount: number
    gasLimit: string
  }
}

// Reuse serialization types from pool
interface SerializedPartialState {
  accounts: [string, SerializedServiceAccount][]
  stagingset: { data: number[] }[]
  authqueue: { data: number[] }[][]
  manager: string
  assigners: string[]
  delegator: string
  registrar: string
  alwaysaccers: [string, string][]
}

interface SerializedServiceAccount {
  codehash: string
  balance: string
  minaccgas: string
  minmemogas: string
  octets: string
  gratis: string
  items: string
  created: string
  lastacc: string
  parent: string
  rawCshKeyvals: Record<string, string>
}

interface SerializedAccumulateInput {
  type: 0 | 1
  value: unknown
}

interface SerializedAccumulateInvocationResult {
  ok: boolean
  value?: {
    poststate: SerializedPartialState
    gasused: string
    defxfers: SerializedDeferredTransfer[]
    yield?: { data: number[] } | null
    provisions: [string, { data: number[] }][]
    resultCode: string
  }
  err?: string
}

interface SerializedDeferredTransfer {
  source: string
  dest: string
  amount: string
  memo: { data: number[] }
  gasLimit: string
}

function initializePVM(): AccumulatePVM {
  // Get configuration from workerData and recreate real services
  // Following the pattern from wasm-pvm-executor.ts which receives services as constructor params
  const data = workerData as WorkerData
  if (!data || !data.configMode) {
    throw new Error('Worker data must include configMode')
  }

  // Recreate real services (same as wasm-pvm-executor.ts pattern)
  const configService = new ConfigService(data.configMode)

  // Create EventBusService for EntropyService (required dependency)
  const eventBusService = new EventBusService()
  const entropyService = new EntropyService(eventBusService)

  // WASM execution doesn't need host function registries - host functions are handled internally in AssemblyScript
  // See wasm-pvm-executor.ts: "Host function handling is now done internally in AssemblyScript, so no registries are needed."
  const traceSubfolder = data.traceSubfolder

  return new AccumulatePVM({
    hostFunctionRegistry: null,
    accumulateHostFunctionRegistry: null,
    configService,
    entropyService,
    pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) },
    useWasm: true, // Always use WASM
    traceSubfolder,
  })
}

function deserializePartialState(
  serialized: SerializedPartialState,
): PartialState {
  return {
    accounts: new Map(
      serialized.accounts.map(([id, account]) => [
        BigInt(id),
        {
          codehash: account.codehash,
          balance: BigInt(account.balance),
          minaccgas: BigInt(account.minaccgas),
          minmemogas: BigInt(account.minmemogas),
          octets: BigInt(account.octets),
          gratis: BigInt(account.gratis),
          items: BigInt(account.items),
          created: BigInt(account.created),
          lastacc: BigInt(account.lastacc),
          parent: BigInt(account.parent),
          rawCshKeyvals: account.rawCshKeyvals,
        } as ServiceAccount,
      ]),
    ),
    stagingset: serialized.stagingset.map((arr) => new Uint8Array(arr.data)),
    authqueue: serialized.authqueue.map((queue) =>
      queue.map((item) => new Uint8Array(item.data)),
    ),
    manager: BigInt(serialized.manager),
    assigners: serialized.assigners.map((id) => BigInt(id)),
    delegator: BigInt(serialized.delegator),
    registrar: BigInt(serialized.registrar),
    alwaysaccers: new Map(
      serialized.alwaysaccers.map(([id, gas]) => [BigInt(id), BigInt(gas)]),
    ),
  }
}

function deserializeInputs(
  serialized: SerializedAccumulateInput[],
): AccumulateInput[] {
  return serialized.map((input) => {
    if (input.type === 0) {
      // OperandTuple
      const value = input.value as {
        packageHash: string
        segmentRoot: string
        authorizer: string
        payloadHash: string
        gasLimit: string
        result: unknown
        authTrace: { data: number[] }
      }
      return {
        type: 0,
        value: {
          packageHash: value.packageHash as `0x${string}`,
          segmentRoot: value.segmentRoot as `0x${string}`,
          authorizer: value.authorizer as `0x${string}`,
          payloadHash: value.payloadHash as `0x${string}`,
          gasLimit: BigInt(value.gasLimit),
          result: value.result as WorkExecutionResult,
          authTrace: new Uint8Array(value.authTrace.data),
        },
      }
    } else {
      // DeferredTransfer
      const value = input.value as {
        source: string
        dest: string
        amount: string
        memo: { data: number[] }
        gasLimit: string
      }
      return {
        type: 1,
        value: {
          source: BigInt(value.source),
          dest: BigInt(value.dest),
          amount: BigInt(value.amount),
          memo: new Uint8Array(value.memo.data),
          gasLimit: BigInt(value.gasLimit),
        },
      }
    }
  })
}

function serializeResult(
  result: AccumulateInvocationResult,
): SerializedAccumulateInvocationResult {
  if (!result.ok) {
    return {
      ok: false,
      err: result.err as string,
    }
  }

  return {
    ok: true,
    value: {
      poststate: serializePartialState(result.value.poststate),
      gasused: result.value.gasused.toString(),
      defxfers: result.value.defxfers.map((d) => ({
        source: d.source.toString(),
        dest: d.dest.toString(),
        amount: d.amount.toString(),
        memo: { data: Array.from(d.memo) },
        gasLimit: d.gasLimit.toString(),
      })),
      yield: result.value.yield
        ? { data: Array.from(result.value.yield) }
        : null,
      provisions: Array.from(result.value.provisions).map(([sid, blob]) => [
        sid.toString(),
        { data: Array.from(blob) },
      ]),
      resultCode: String(result.value.resultCode),
    },
  }
}

function serializePartialState(state: PartialState): SerializedPartialState {
  return {
    accounts: Array.from(state.accounts.entries()).map(([id, account]) => [
      id.toString(),
      {
        codehash: account.codehash,
        balance: account.balance.toString(),
        minaccgas: account.minaccgas.toString(),
        minmemogas: account.minmemogas.toString(),
        octets: account.octets.toString(),
        gratis: account.gratis.toString(),
        items: account.items.toString(),
        created: account.created.toString(),
        lastacc: account.lastacc.toString(),
        parent: account.parent.toString(),
        rawCshKeyvals: account.rawCshKeyvals,
      },
    ]),
    stagingset: state.stagingset.map((arr) => ({ data: Array.from(arr) })),
    authqueue: state.authqueue.map((queue) =>
      queue.map((item) => ({ data: Array.from(item) })),
    ),
    manager: state.manager.toString(),
    assigners: state.assigners.map((id) => id.toString()),
    delegator: state.delegator.toString(),
    registrar: state.registrar.toString(),
    alwaysaccers: Array.from(state.alwaysaccers.entries()).map(([id, gas]) => [
      id.toString(),
      gas.toString(),
    ]),
  }
}

// Initialize PVM on worker startup
if (parentPort) {
  // Lazy initialization - create PVM on first use
  parentPort.on('message', async (message: WorkerMessage) => {
    try {
      if (message.type === 'shutdown') {
        accumulatePVM?.dispose()
        accumulatePVM = null
        process.exit(0)
        return
      }
      if (message.type === 'execute' && message.task) {
        // Initialize PVM if not already done
        if (!accumulatePVM) {
          accumulatePVM = initializePVM()
        }

        const { task, messageId } = message

        // Deserialize inputs
        const deserializeStart = Date.now()
        const partialState = deserializePartialState(task.partialState)
        const currentSlot = BigInt(task.currentSlot)
        const serviceId = BigInt(task.serviceId)
        const gasLimit = BigInt(task.gasLimit)
        const inputs = deserializeInputs(task.inputs)
        const invocationIndex = task.invocationIndex
        const entropyOverride = task.entropyAccumulator
          ? new Uint8Array(task.entropyAccumulator.data)
          : undefined
        const deserializeTime = Date.now() - deserializeStart

        // Execute accumulate invocation (entropyOverride so gas matches in-process)
        const executeStart = Date.now()
        const result = await accumulatePVM.executeAccumulate(
          partialState,
          currentSlot,
          serviceId,
          gasLimit,
          inputs,
          invocationIndex,
          entropyOverride,
        )
        const executeTime = Date.now() - executeStart

        // Serialize result
        const serializeStart = Date.now()
        const serializedResult = serializeResult(result)
        const serializeTime = Date.now() - serializeStart

        const totalTime = Date.now() - deserializeStart

        // Log performance metrics
        if (parentPort) {
          parentPort.postMessage({
            type: 'result',
            messageId,
            result: serializedResult,
            metrics: {
              deserializeTimeMs: deserializeTime,
              executeTimeMs: executeTime,
              serializeTimeMs: serializeTime,
              totalTimeMs: totalTime,
              serviceId: task.serviceId,
              invocationIndex,
              inputsCount: inputs.length,
              gasLimit: task.gasLimit,
            },
          } as WorkerMessage)
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      if (parentPort) {
        parentPort.postMessage({
          type: 'error',
          messageId: message.messageId,
          error: errorMessage,
        } as WorkerMessage)
      }
    }
  })

  // Signal that worker is ready
  if (parentPort) {
    parentPort.postMessage({ type: 'ready' } as WorkerMessage)
  }
}
