/**
 * Debug host function execution
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { PVM } from '../../pvm'
import { PVMParser } from '../../parser'
import { InstructionRegistry } from '../registry'
import type { PVMOptions } from '@pbnj/types'
import { PVMRAM } from '../../ram'
import { GENERAL_FUNCTIONS } from '../../config'

beforeAll(() => {
  logger.init()
})

describe('Debug Host Function Execution', () => {
  it('should debug gas host function execution', () => {
    // Create PVM instance
    const registry = new InstructionRegistry()
    const parser = new PVMParser(registry)

    // Parse the program: [0, 0, 2, 100, 0, 1] (ECALLI with host function ID 0)
    const programBytes = new Uint8Array([0, 0, 2, 100, 0, 1])
    const parseResult = parser.parseProgram(programBytes)

    console.log('Parse result:', parseResult)
    console.log('Instructions:', parseResult.instructions)

    if (!parseResult.success) {
      throw new Error(`Failed to parse program: ${parseResult.errors.join(', ')}`)
    }

    const ram = new PVMRAM()
    const options: PVMOptions = {
      pc: 0n,
      gasCounter: 20n, // Start with 20 gas (enough for ECALLI + GasHostFunction)
      registerState: new Array(13).fill(0n),
      ram: ram,
    }

    const pvm = new PVM(options)
    
    // Check what host function ID 0 is
    console.log('GENERAL_FUNCTIONS.GAS:', GENERAL_FUNCTIONS.GAS)
    
    // Execute step by step
    let stepCount = 0
    const maxSteps = 10
    let resultCode: number | null = null
    
    while (stepCount < maxSteps) {
      resultCode = pvm.step()
      stepCount++
      console.log(`Step ${stepCount}:`, {
        resultCode,
        gas: pvm.getState().gasCounter.toString(),
        pc: pvm.getState().instructionPointer.toString(),
        r0: pvm.getState().registerState[0].toString(),
        r7: pvm.getState().registerState[7].toString()
      })
      
      if (resultCode !== null) {
        break
      }
    }

    console.log('Final result:', {
      resultCode,
      finalGas: pvm.getState().gasCounter.toString(),
      finalPC: pvm.getState().instructionPointer.toString(),
      steps: stepCount
    })

    // Expected behavior:
    // - Start with 20 gas
    // - ECALLI consumes 1 gas (19 remaining)
    // - GasHostFunction consumes 10 gas (9 remaining)
    // - Status: halt (because GasHostFunction returns null/continue)
    
    console.log('Expected: ECALLI(1) + GasHostFunction(10) = 11 gas consumed')
    console.log('Expected remaining gas: 20 - 11 = 9')
    
    expect(pvm.getState().gasCounter).toBe(9n) // Should have 9 gas remaining
    expect(resultCode).toBe(0) // Should be HALT (normal completion)
  })
})
