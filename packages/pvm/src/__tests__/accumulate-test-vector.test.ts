import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PVM } from '../pvm'
import type { 
  PartialState, 
  ServiceAccount, 
  AccumulateInput,
} from '@pbnj/types'

interface AccumulateTestVector {
  input: {
    slot: number
    reports: Array<{
      package_spec: {
        hash: string
        length: number
        erasure_root: string
        exports_root: string
        exports_count: number
      }
      context: {
        anchor: string
        state_root: string
        beefy_root: string
        lookup_anchor: string
        lookup_anchor_slot: number
        prerequisites: any[]
      }
      core_index: number
      authorizer_hash: string
      auth_gas_used: number
      auth_output: string
      segment_root_lookup: any[]
      results: Array<{
        service_id: number
        code_hash: string
        payload_hash: string
        accumulate_gas: number
        result: {
          ok?: string
          err?: null
        }
        refine_load: {
          gas_used: number
          imports: number
          extrinsic_count: number
          extrinsic_size: number
          exports: number
          accumulate_count: number
          accumulate_gas_used: number
        }
      }>
    }>
  }
  pre_state: {
    slot: number
    entropy: string
    ready_queue: any[][]
    accumulated: any[][]
    privileges: {
      bless: number
      assign: number[]
      designate: number
      register: number
      always_acc: number[]
    }
    statistics: any[]
    accounts: Array<{
      id: number
      data: {
        service: {
          version: number
          code_hash: string
          balance: number
          min_item_gas: number
          min_memo_gas: number
          bytes: number
          deposit_offset: number
          items: number
          creation_slot: number
          last_accumulation_slot: number
          parent_service: number
        }
        storage: Array<{
          key: string
          value: string
        }>
        preimages_blob: Array<{
          hash: string
          blob: string
        }>
        preimages_status: Array<{
          hash: string
          status: number[]
        }>
      }
    }>
  }
  output: {
    ok?: string
    err?: null
  }
  post_state: any
}

describe('Accumulate Test Vector Execution', () => {
  test('should execute accumulate test vector from JSON', async () => {
    // Read the test vector JSON file
    const testVectorPath = join(__dirname, '../../../../submodules/jam-test-vectors/stf/accumulate/tiny/process_one_immediate_report-1.json')
    const testVectorData = readFileSync(testVectorPath, 'utf-8')
    const testVector: AccumulateTestVector = JSON.parse(testVectorData)

    // Create PVM instance
    const pvm = new PVM()

    // Convert test vector data to our types
    const partialState = convertToPartialState(testVector.pre_state)
    const timeslot = BigInt(testVector.input.slot)
    const serviceId = BigInt(testVector.pre_state.accounts[0].id) // Use first service
    const gas = 1_000_000n // Set a reasonable gas limit
    const inputs = convertToAccumulateInputs(testVector.input.reports)

    // Execute accumulate invocation
    const result = pvm.executeAccumulate(
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
    
    const serviceAccount: ServiceAccount = {
    //   version: BigInt(serviceInfo.version),
      codehash: `0x${serviceInfo.code_hash}`,
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
      serviceAccount.storage.set(`0x${storageEntry.key}`, new TextDecoder().decode(Uint8Array.from(storageEntry.value.split(',').map(Number))))
    }

    // Convert preimages
    for (const preimageEntry of accountData.data.preimages_blob) {
      serviceAccount.preimages.set(`0x${preimageEntry.hash}`, new TextDecoder().decode(Uint8Array.from(preimageEntry.blob.split(',').map(Number))))
    }

    // Convert preimage status (requests)
    for (const statusEntry of accountData.data.preimages_status) {
      serviceAccount.requests.set(`0x${statusEntry.hash}`, new Map(statusEntry.status.map(BigInt).map(status => [BigInt(status), new Uint8Array(0)])))
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
    type: 0n, // Work report type
    value: report, // Raw report data
  }))
}
