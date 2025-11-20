/**
 * Test to isolate initializePage issue with MockRAM
 * 
 * This test specifically tests initializePage with MockRAM using the inst_load_i16 test vector
 * to debug why it throws when using MockRAM.
 */

import { instantiate } from './wasmAsInit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTestVectorsDir, parseJsonSafe, type PVMTestVector } from './test-vector-helper'

describe('InitializePage with MockRAM', () => {
  let wasmModule: any = null

  beforeAll(async () => {
    const wasmPath = join(__dirname, '../build/pvm.wasm')
    const wasmBuffer = readFileSync(wasmPath)
    wasmModule = await instantiate(wasmBuffer)
  })

  it('should call initializePage with MockRAM using inst_load_i16 test vector', async () => {
    // Load the test vector
    const testVectorsDir = getTestVectorsDir()
    const filePath = join(testVectorsDir, 'inst_load_i16.json')
    const fileContents = readFileSync(filePath, 'utf-8')
    const testVector = parseJsonSafe(fileContents) as PVMTestVector

    const { exports } = wasmModule

    console.log('\n=== Test: initializePage with MockRAM ===')
    console.log('Test Vector:', testVector.name)

    // Initialize with MockRAM (RAMType: 0=PVMRAM, 1=SimpleRAM, 2=MockRAM)
    console.log('Initializing with MockRAM (ramType=2)...')
    try {
      exports.init(2) // RAMType.MockRAM
      console.log('✅ init(2) succeeded')
    } catch (error) {
      console.error('❌ init(2) failed:', error)
      throw error
    }

    // Verify pvmInstance was created
    const pc = exports.getProgramCounter()
    console.log('PVM initialized, PC:', pc)

    // Get the initial-page-map from test vector
    if (!testVector['initial-page-map'] || testVector['initial-page-map'].length === 0) {
      throw new Error('Test vector has no initial-page-map')
    }

    const page = testVector['initial-page-map'][0]
    const address = Number(page.address)
    const length = Number(page.length)
    const isWritable = page['is-writable']

    console.log('\n=== Calling initializePage ===')
    console.log('Address:', address, `(0x${address.toString(16)})`)
    console.log('Length:', length)
    console.log('Is Writable:', isWritable)

    // Convert boolean to access type (0=NONE, 1=READ, 2=WRITE)
    const accessType = isWritable ? 2 : 1 // WRITE=2, READ=1

    console.log('Access Type:', accessType, `(${isWritable ? 'WRITE' : 'READ'})`)

    // Call initializePage - this is where it should throw with MockRAM
    try {
      console.log('Calling exports.initializePage...')
      exports.initPage(address, length, accessType)
      console.log('✅ initializePage succeeded (no-op with MockRAM)')
    } catch (error) {
      console.error('❌ initializePage threw an error:')
      console.error('Error type:', error?.constructor?.name)
      console.error('Error message:', error?.message)
      console.error('Error stack:', error?.stack)
      
      // Check if it's the abort error with corrupted strings
      if (error?.message?.includes('undefined is not an object') || 
          error?.message?.includes('slot.length')) {
        console.error('\n⚠️  This looks like the memory corruption issue!')
        console.error('The error suggests corrupted memory when trying to create error messages.')
      }
      
      throw error
    }

    // If we get here, initializePage succeeded
    console.log('\n✅ Test passed: initializePage works with MockRAM')
  })

  it('should compare initializePage behavior across RAM types', async () => {
    // Load the test vector
    const testVectorsDir = getTestVectorsDir()
    const filePath = join(testVectorsDir, 'inst_load_i16.json')
    const fileContents = readFileSync(filePath, 'utf-8')
    const testVector = parseJsonSafe(fileContents) as PVMTestVector

    const page = testVector['initial-page-map']![0]
    const address = Number(page.address)
    const length = Number(page.length)
    const accessType = page['is-writable'] ? 2 : 1

    console.log('\n=== Comparing RAM types ===')

    // Test with PVMRAM
    console.log('\n1. Testing with PVMRAM (ramType=0)...')
    try {
      const wasm1 = await instantiate(readFileSync(join(__dirname, '../build/pvm.wasm')))
      wasm1.exports.init(0) // RAMType.PVMRAM
      wasm1.exports.initPage(address, length, accessType)
      console.log('✅ PVMRAM: initializePage succeeded')
    } catch (error) {
      console.error('❌ PVMRAM: initializePage failed:', error?.message)
    }

    // Test with SimpleRAM
    console.log('\n2. Testing with SimpleRAM (ramType=1)...')
    try {
      const wasm2 = await instantiate(readFileSync(join(__dirname, '../build/pvm.wasm')))
      wasm2.exports.init(1) // RAMType.SimpleRAM
      wasm2.exports.initPage(address, length, accessType)
      console.log('✅ SimpleRAM: initializePage succeeded')
    } catch (error) {
      console.error('❌ SimpleRAM: initializePage failed:', error?.message)
    }

    // Test with MockRAM
    console.log('\n3. Testing with MockRAM (ramType=2)...')
    try {
      const wasm3 = await instantiate(readFileSync(join(__dirname, '../build/pvm.wasm')))
      wasm3.exports.init(2) // RAMType.MockRAM
      wasm3.exports.initPage(address, length, accessType)
      console.log('✅ MockRAM: initializePage succeeded')
    } catch (error) {
      console.error('❌ MockRAM: initializePage failed:', error?.message)
      console.error('Full error:', error)
      throw error
    }
  })
})

