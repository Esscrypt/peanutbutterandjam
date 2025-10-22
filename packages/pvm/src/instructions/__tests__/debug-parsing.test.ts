/**
 * Debug program parsing
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { PVMParser } from '../../parser'
import { InstructionRegistry } from '../registry'

beforeAll(() => {
  logger.init()
})

describe('Debug Program Parsing', () => {
  it('should debug gas_basic_consume_all program parsing', () => {
    const registry = new InstructionRegistry()
    const parser = new PVMParser(registry)

    // Parse the program: [0, 0, 2, 100, 0, 1]
    const programBytes = new Uint8Array([0, 0, 2, 100, 0, 1])
    console.log('Program bytes:', Array.from(programBytes))
    
    const parseResult = parser.parseProgram(programBytes)

    console.log('Parse result:', parseResult)
    console.log('Instructions:', parseResult.instructions)
    console.log('Jump table:', parseResult.jumpTable)
    console.log('Bitmask:', parseResult.bitmask)

    if (!parseResult.success) {
      console.log('Parse errors:', parseResult.errors)
    }

    // The program should have 2 instructions:
    // 1. [0, 0, 2] - Some instruction that consumes 2 gas
    // 2. [100, 0, 1] - MOVE_REG instruction
    
    expect(parseResult.success).toBe(true)
    expect(parseResult.instructions.length).toBe(2)
    
    // First instruction should be opcode 0 (TRAP)
    expect(parseResult.instructions[0].opcode).toBe(0n)
    
    // Second instruction should be opcode 100 (MOVE_REG)
    expect(parseResult.instructions[1].opcode).toBe(100n)
  })
})
