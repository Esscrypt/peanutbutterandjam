/**
 * Test to identify which method throws in the initializePage call chain
 * 
 * This test systematically tests each method in the call chain to identify
 * where the abort is occurring.
 */

// import { instantiate } from './wasmAsInit'
import { instantiate } from '@assemblyscript/loader'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Identify which method throws', () => {
  let wasmModule: any = null

  beforeAll(async () => {
    const wasmPath = join(__dirname, '../build/debug.wasm')
    const wasmBuffer = readFileSync(wasmPath)
    wasmModule = await instantiate(wasmBuffer)
  })

  it('should test each method in the call chain', async () => {
    const { exports } = wasmModule
    const address = 131072 // 0x20000
    const length = 4096
    const accessType = 2 // WRITE

    console.log('\n=== Testing Method Call Chain ===')
    console.log('Address:', address, `(0x${address.toString(16)})`)
    console.log('Length:', length)
    console.log('Access Type:', accessType)

    // Step 1: Initialize with MockRAM
    console.log('\n1. Testing init(2)...')
    try {
      exports.init(2) // RAMType.MockRAM
      console.log('✅ init(2) succeeded')
    } catch (error) {
      console.error('❌ init(2) failed:', error?.message)
      throw error
    }

    // Step 2: Test getProgramCounter (accesses pvmInstance)
    console.log('\n2. Testing getProgramCounter()...')
    try {
      const pc = exports.getProgramCounter()
      console.log('✅ getProgramCounter() succeeded, PC:', pc)
    } catch (error) {
      console.error('❌ getProgramCounter() failed:', error?.message)
      throw error
    }

    // Step 3: Test getStatus (accesses pvmInstance)
    console.log('\n3. Testing getStatus()...')
    try {
      const status = exports.getStatus()
      console.log('✅ getStatus() succeeded, Status:', status)
    } catch (error) {
      console.error('❌ getStatus() failed:', error?.message)
      throw error
    }

    // Step 4: Test getGasLeft (accesses pvmInstance)
    console.log('\n4. Testing getGasLeft()...')
    try {
      const gas = exports.getGasLeft()
      console.log('✅ getGasLeft() succeeded, Gas:', gas)
    } catch (error) {
      console.error('❌ getGasLeft() failed:', error?.message)
      throw error
    }

    // Step 5: Test setMemory (calls ram.writeOctetsDuringInitialization)
    console.log('\n5. Testing setMemory()...')
    try {
      const testData = new Uint8Array([1, 2, 3, 4])
      exports.setMemory(address, testData)
      console.log('✅ setMemory() succeeded')
    } catch (error) {
      console.error('❌ setMemory() failed:', error?.message)
      console.error('Full error:', error)
    }

    // Step 6: Test initPage (the problematic method)
    console.log('\n6. Testing initPage()...')
    try {
      exports.initPage(address, length, accessType)
      console.log('✅ initPage() succeeded')
    } catch (error) {
      console.error('❌ initPage() failed:')
      console.error('Error type:', error?.constructor?.name)
      console.error('Error message:', error?.message)
      console.error('Error stack:', error?.stack)
      
      // Check if it's the garbled error
      if (error?.message?.includes('ڐ') || error?.message?.includes('ٰ')) {
        console.error('\n⚠️  This is the garbled memory corruption error!')
      }
      throw error
    }

    console.log('\n✅ All methods succeeded!')
  })

  it('should test initPage with different parameters', async () => {
    const { exports } = wasmModule

    console.log('\n=== Testing initPage with Different Parameters ===')

    // Reinitialize
    exports.init(2) // MockRAM

    const testCases = [
      { name: 'Zero address', address: 0, length: 4096, accessType: 2 },
      { name: 'Small length', address: 131072, length: 1, accessType: 2 },
      { name: 'Zero length', address: 131072, length: 0, accessType: 2 },
      { name: 'READ access', address: 131072, length: 4096, accessType: 1 },
      { name: 'NONE access', address: 131072, length: 4096, accessType: 0 },
    ]

    for (const testCase of testCases) {
      console.log(`\nTesting: ${testCase.name}`)
      console.log(`  Address: ${testCase.address}, Length: ${testCase.length}, AccessType: ${testCase.accessType}`)
      try {
        exports.initPage(testCase.address, testCase.length, testCase.accessType)
        console.log(`  ✅ ${testCase.name} succeeded`)
      } catch (error) {
        console.error(`  ❌ ${testCase.name} failed:`, error?.message)
        if (error?.message?.includes('ڐ') || error?.message?.includes('ٰ')) {
          console.error(`  ⚠️  Memory corruption detected!`)
        }
      }
    }
  })

  it('should test direct RAM method access pattern', async () => {
    const { exports } = wasmModule

    console.log('\n=== Testing RAM Method Access Pattern ===')

    // Reinitialize
    exports.init(2) // MockRAM

    // Test if we can access pvmInstance properties
    console.log('\n1. Testing pvmInstance access...')
    try {
      const pc = exports.getProgramCounter()
      console.log('✅ Can access pvmInstance, PC:', pc)
    } catch (error) {
      console.error('❌ Cannot access pvmInstance:', error?.message)
      throw error
    }

    // Test if calling initPage with same instance works multiple times
    console.log('\n2. Testing multiple initPage calls...')
    try {
      exports.initPage(131072, 4096, 2)
      console.log('✅ First initPage call succeeded')
      
      exports.initPage(262144, 4096, 2)
      console.log('✅ Second initPage call succeeded')
      
      exports.initPage(393216, 4096, 2)
      console.log('✅ Third initPage call succeeded')
    } catch (error) {
      console.error('❌ Multiple initPage calls failed:', error?.message)
      console.error('Full error:', error)
      throw error
    }
  })
})

