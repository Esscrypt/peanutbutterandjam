/**
 * Debug gas consumption issue
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { PVM } from '../../pvm'
import { PVMParser } from '../../parser'
import { InstructionRegistry } from '../registry'
import type { PVMOptions } from '@pbnj/types'
import { PVMRAM } from '../../ram'

beforeAll(() => {
  logger.init()
})

describe('Debug Gas Consumption', () => {
  it('should debug gas_basic_consume_all test', () => {
    // Create PVM instance
    const registry = new InstructionRegistry()
    const parser = new PVMParser(registry)

    // Parse the program: [0, 0, 2, 100, 0, 1]
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
      gasCounter: 2n, // Start with 2 gas
      registerState: new Array(13).fill(0n),
      ram: ram,
    }

    // Test with run() method
    const pvm1 = new PVM(options)
    pvm1.loadInstructions(parseResult.instructions, parseResult.jumpTable)
    const result1 = pvm1.run()
    console.log('Run() result:', {
      resultCode: result1,
      finalGas: pvm1.getState().gasCounter.toString(),
      finalPC: pvm1.getState().instructionPointer.toString()
    })

    // Test with step() method
    const pvm2 = new PVM(options)
    pvm2.loadInstructions(parseResult.instructions, parseResult.jumpTable)
    
    let stepCount = 0
    const maxSteps = 10
    let resultCode: number | null = null
    
    while (stepCount < maxSteps) {
      resultCode = pvm2.step()
      stepCount++
      console.log(`Step ${stepCount}:`, {
        resultCode,
        gas: pvm2.getState().gasCounter.toString(),
        pc: pvm2.getState().instructionPointer.toString()
      })
      
      if (resultCode !== null) {
        break
      }
    }

    console.log('Step() result:', {
      resultCode,
      finalGas: pvm2.getState().gasCounter.toString(),
      finalPC: pvm2.getState().instructionPointer.toString(),
      steps: stepCount
    })

    // Compare results
    expect(pvm1.getState().gasCounter).toBe(pvm2.getState().gasCounter)
    expect(result1).toBe(resultCode)
  })
})
