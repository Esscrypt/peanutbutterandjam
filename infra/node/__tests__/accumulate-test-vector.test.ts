import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { Hex } from 'viem'
import type { 
  PartialState, 
  ServiceAccount, 
  AccumulateInput,
  AccumulateTestVector,
  OperandTuple,
  ServiceAccountCore,
} from '@pbnj/types'
import { ConfigService } from '../services/config-service'
import { HostFunctionRegistry, AccumulateHostFunctionRegistry, AccumulatePVM } from '@pbnj/pvm'
import { hexToBytes } from '../../../packages/core/src/utils/crypto'
import { ServiceAccountService } from '../services/service-account-service'
import { EventBusService } from '@pbnj/core'
import { ClockService } from '../services/clock-service'
import { PreimageRequestProtocol } from '@pbnj/networking'
import { AccumulationService } from '../services/accumulation-service'


describe('Accumulate Test Vector Execution', () => {
  test('should execute accumulate test vector from JSON', async () => {
    // Read the test vector JSON file
    const testVectorPath = join(__dirname, '../../../../submodules/jam-test-vectors/stf/accumulate/tiny/process_one_immediate_report-1.json')
    const testVectorData = readFileSync(testVectorPath, 'utf-8')
    const testVector: AccumulateTestVector = JSON.parse(testVectorData)
    
    // Create PVM instance
    const configService = new ConfigService('tiny')
    const eventBusService = new EventBusService()
    const clockService = new ClockService({eventBusService: eventBusService, configService: configService})
    const preimageRequestProtocol = new PreimageRequestProtocol(eventBusService)
    const serviceAccountService = new ServiceAccountService({preimageStore: null, configService: configService, eventBusService: eventBusService, clockService: clockService, networkingService: null, preimageRequestProtocol: preimageRequestProtocol})
    const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry()
    const pvm = new AccumulatePVM({hostFunctionRegistry: new HostFunctionRegistry(null, configService), accumulateHostFunctionRegistry: accumulateHostFunctionRegistry, configService: configService, pvmOptions: {gasCounter: 1_000_000n}})
    const accumulationService = new AccumulationService({configService: configService, clockService: clockService, serviceAccountService: serviceAccountService, privilegesService: null, validatorSetManager: null, authQueueService: null, accumulatePVM: pvm})

    // Convert test vector data to our types
    const partialState = convertToPartialState(testVector.pre_state)
    const timeslot = BigInt(testVector.input.slot)
    const serviceId = BigInt(testVector.pre_state.accounts[0].id) // Use first service
    const gas = 1_000_000n // Set a reasonable gas limit
    const inputs = convertToAccumulateInputs(testVector.input.reports)

    // Execute accumulate invocation
    const result = await pvm.executeAccumulate(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs
    )

    // Verify the result
    expect(result).toBeDefined()
    console.log('Accumulate execution result:', result)
    
    // The test vector expects success (ok output)
    if (testVector.output.ok !== undefined) {
      // Should return AccumulateOutput object, not 'BAD'
      expect(typeof result).toBe('object')
      expect(result).toHaveProperty('poststate')
      expect(result).toHaveProperty('defxfers')
      expect(result).toHaveProperty('yield')
      expect(result).toHaveProperty('gasused')
      expect(result).toHaveProperty('provisions')
    } else if (testVector.output.err !== undefined) {
      // Should return WorkError string
      expect(typeof result).toBe('string')
      expect(result).toBe('BAD')
    }
  })
})

function convertToPartialState(preState: AccumulateTestVector['pre_state']): PartialState {
  const accounts = new Map<bigint, ServiceAccount>()
  
  for (const accountData of preState.accounts) {
    const serviceId = BigInt(accountData.id)
    const serviceInfo = accountData.data.service
    
    const serviceAccount: ServiceAccountCore = {
    //   version: BigInt(serviceInfo.version),
      codehash: serviceInfo.code_hash as Hex,
      balance: BigInt(serviceInfo.balance),
      minaccgas: BigInt(serviceInfo.min_item_gas),
      minmemogas: BigInt(serviceInfo.min_memo_gas),
      octets: BigInt(serviceInfo.bytes),
      gratis: BigInt(0),
      items: BigInt(serviceInfo.items),
      created: BigInt(serviceInfo.creation_slot),
      lastacc: BigInt(serviceInfo.last_accumulation_slot),
      parent: BigInt(serviceInfo.parent_service),
      storage: new Map(),
      requests: new Map(),
      preimages: new Map(),
    }

    // Convert storage
    for (const storageEntry of accountData.data.storage) {
      serviceAccount.storage.set(storageEntry.key as Hex, hexToBytes(storageEntry.value as Hex))
    }

    // Convert preimages
    for (const preimageEntry of accountData.data.preimages_blob) {
      serviceAccount.preimages.set(preimageEntry.hash as Hex, hexToBytes(preimageEntry.blob as Hex))
    }

    // Convert preimage status (requests)
    for (const statusEntry of accountData.data.preimages_status) {
      serviceAccount.requests.set(statusEntry.hash as Hex, new Map(statusEntry.status.map(BigInt).map(status => [BigInt(status), new Uint8Array(0)])))
    }

    accounts.set(serviceId, serviceAccount)
  }

  return {
    accounts: new Map<bigint, ServiceAccount>(Array.from(accounts.entries()).map(([serviceId, serviceAccount]) => [BigInt(serviceId), serviceAccount])),
    nextfreeid: 65536n,
    xfers: [],
    yield: new Uint8Array(0),
    provisions: new Map<bigint, Uint8Array>(),
  }
}

function convertToAccumulateInputs(reports: AccumulateTestVector['input']['reports']): AccumulateInput[] {
  return reports.map(report => ({
    type: 0n, // Work report type // for operand tuple
    value: {
      packageHash: report.package_spec.hash,
      segmentRoot: report.package_spec.erasure_root,
      authorizer: report.authorizer_hash,
      payloadHash: report.results[0].payload_hash,
      gasLimit: BigInt(report.results[0].accumulate_gas),
      result: report.results[0].result as WorkExecutionResult,
      authTrace: report.auth_output,
    } as OperandTuple, // Raw report data
  }))
}
