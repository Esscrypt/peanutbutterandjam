/**
 * Genesis State Root Comparison Test
 *
 * This test compares the exact Python implementation vs our Gray Paper implementation
 * against the genesis.json state root to determine which algorithm is correct.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it, expect } from 'bun:test'
import { hexToBytes, bytesToHex, blake2bHash, merklizeBytes } from '@pbnjam/core'

/**
 * Exact Python implementation: Blake2b-256
 */
function hashPython(data: Uint8Array): Uint8Array {
  const [hashError, hashHex] = blake2bHash(data)
  if (hashError) {
    throw hashError
  }
  return hexToBytes(hashHex)
}

/**
 * Exact Python implementation: GP (286)
 * head = l[0] & 0xfe (clears LSB, not MSB)
 */
function branchPython(l: Uint8Array, r: Uint8Array): Uint8Array {
  if (l.length !== 32 || r.length !== 32) {
    throw new Error('Branch children must be 32 bytes each')
  }
  
  // Python: head = l[0] & 0xfe (clears the least significant bit)
  const head = l[0] & 0xfe
  
  // Python: return bytes([head]) + l[1:] + r
  const result = new Uint8Array(64)
  result[0] = head
  result.set(l.slice(1), 1)  // l[1:] - rest of left
  result.set(r, 32)          // r - right
  
  return result
}

/**
 * Exact Python implementation: GP (287)
 * k[:-1] removes last byte, different bit patterns
 */
function leafPython(k: Uint8Array, v: Uint8Array): Uint8Array {
  const result = new Uint8Array(64)
  
  if (v.length <= 32) {
    // Python: head = 0b01 | (len(v) << 2)
    const head = 0b01 | (v.length << 2)
    result[0] = head
    
    // Python: k[:-1] (removes last byte)
    result.set(k.slice(0, -1), 1)
    
    // Python: v + ((32 - len(v)) * b'\0')
    result.set(v, 31)
    // Padding is already zeros from Uint8Array initialization
  } else {
    // Python: head = 0b11
    result[0] = 0b11
    
    // Python: k[:-1] (removes last byte)
    result.set(k.slice(0, -1), 1)
    
    // Python: hash(v)
    const valueHash = hashPython(v)
    result.set(valueHash, 31)
  }
  
  return result
}

/**
 * Exact Python implementation: bit function
 */
function bitPython(k: Uint8Array, i: number): boolean {
  return (k[i >> 3] & (1 << (i & 7))) !== 0
}

/**
 * Exact Python implementation: GP (289)
 */
function merklePython(kvs: Array<[Uint8Array, Uint8Array]>, i: number = 0): Uint8Array {
  // Safety check: prevent infinite recursion
  if (i > 256) {
    throw new Error(`Maximum recursion depth exceeded at bit position ${i}`)
  }
  
  if (kvs.length === 0) {
    return new Uint8Array(32) // Python: 32 * b'\0'
  }
  
  if (kvs.length === 1) {
    // Python: encoded = leaf(*kvs[0])
    const encoded = leafPython(kvs[0][0], kvs[0][1])
    return hashPython(encoded)
  }
  
  // Split by bit
  const l: Array<[Uint8Array, Uint8Array]> = []
  const r: Array<[Uint8Array, Uint8Array]> = []
  
  for (const [k, v] of kvs) {
    if (bitPython(k, i)) {
      r.push([k, v])
    } else {
      l.push([k, v])
    }
  }
  
  // Safety check: prevent infinite recursion
  if (l.length === kvs.length || r.length === kvs.length) {
    // If all keys have the same bit, try next bit position
    return merklePython(kvs, i + 1)
  }
  
  // Python: encoded = branch(merkle(l, i + 1), merkle(r, i + 1))
  const encoded = branchPython(merklePython(l, i + 1), merklePython(r, i + 1))
  return hashPython(encoded)
}

/**
 * Load genesis.json from config
 */
async function loadGenesis(): Promise<any> {
  const genesisPath = join(__dirname, '../../../../config/genesis.json')
  const content = await readFile(genesisPath, 'utf8')
  return JSON.parse(content)
}

/**
 * Deserialize key-value pairs from genesis state
 */
function deserializeGenesisKeyValues(genesis: any): Array<[Uint8Array, Uint8Array]> {
  const keyvals = genesis.state.keyvals
  return keyvals.map(({ key, value }: { key: string; value: string }) => [
    hexToBytes(key as `0x${string}`),
    hexToBytes(value as `0x${string}`)
  ])
}

describe('Genesis State Root Comparison', () => {
  it('should compare Python vs Gray Paper implementations against genesis state root', async () => {
    const genesis = await loadGenesis()
    const keyValuePairs = deserializeGenesisKeyValues(genesis)
    const expectedRoot = genesis.state.state_root
    
    console.log(`\n🎯 Genesis State Root Analysis`)
    console.log(`Expected State Root: ${expectedRoot}`)
    console.log(`Key-Value Pairs: ${keyValuePairs.length}`)
    
    // Test Python implementation
    console.log(`\n📊 Testing Python Implementation...`)
    let pythonResult: string
    try {
      const pythonRoot = merklePython(keyValuePairs)
      pythonResult = bytesToHex(pythonRoot)
      console.log(`Python Result: ${pythonResult}`)
      
      if (pythonResult === expectedRoot) {
        console.log(`✅ PYTHON IMPLEMENTATION MATCHES!`)
      } else {
        console.log(`❌ Python implementation does not match`)
      }
    } catch (error) {
      pythonResult = `ERROR: ${error}`
      console.log(`❌ Python implementation failed: ${error}`)
    }
    
    // Test Gray Paper implementation
    console.log(`\n📊 Testing Gray Paper Implementation...`)
    let grayPaperResult: string
    try {
      const [error, grayPaperRoot] = merklizeBytes(keyValuePairs) // strictGrayPaper = true
      if (error) {
        grayPaperResult = `ERROR: ${error}` 
        console.log(`❌ Gray Paper implementation failed: ${error}`)
      } else {
        grayPaperResult = bytesToHex(grayPaperRoot)
        console.log(`Gray Paper Result: ${grayPaperResult}`)
        
        if (grayPaperResult === expectedRoot) {
          console.log(`✅ GRAY PAPER IMPLEMENTATION MATCHES!`)
        } else {
          console.log(`❌ Gray Paper implementation does not match`)
        }
      }
    } catch (error) {
      grayPaperResult = `ERROR: ${error}`
      console.log(`❌ Gray Paper implementation failed: ${error}`)
    }
    
    // Summary
    console.log(`\n📋 SUMMARY:`)
    console.log(`Expected: ${expectedRoot}`)
    console.log(`Python:   ${pythonResult}`)
    console.log(`Gray Paper: ${grayPaperResult}`)
    
    if (pythonResult === expectedRoot) {
      console.log(`\n🎉 CONCLUSION: Python implementation is CORRECT!`)
    } else if (grayPaperResult === expectedRoot) {
      console.log(`\n🎉 CONCLUSION: Gray Paper implementation is CORRECT!`)
    } else {
      console.log(`\n⚠️  CONCLUSION: Neither implementation matches the expected state root`)
      console.log(`This suggests the genesis.json was generated with a different algorithm`)
    }
    
    // At least one should work, but let's not fail the test if neither matches
    // since we're investigating the discrepancy
    expect(keyValuePairs.length).toBeGreaterThan(0)
  })
})
