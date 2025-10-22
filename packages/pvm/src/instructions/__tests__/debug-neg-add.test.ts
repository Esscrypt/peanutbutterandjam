/**
 * Debug NEG_ADD_IMM_32 parsing
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

describe('Debug NEG_ADD_IMM_32', () => {
  it('should debug operand parsing', () => {
    const registry = new InstructionRegistry()
    const parser = new PVMParser(registry)

    // Parse the program: [0, 0, 3, 141, 137, 1, 1]
    const programBytes = new Uint8Array([0, 0, 3, 141, 137, 1, 1])
    const parseResult = parser.parseProgram(programBytes)

    console.log('Parse result:', parseResult)
    console.log('Instructions:', parseResult.instructions)

    if (!parseResult.success) {
      throw new Error(`Failed to parse program: ${parseResult.errors.join(', ')}`)
    }

    const instruction = parseResult.instructions[0]
    console.log('Instruction details:', {
      opcode: instruction.opcode.toString(),
      operands: Array.from(instruction.operands),
      fskip: instruction.fskip,
      address: instruction.address.toString()
    })

    // Parse operands manually to see what we get
    const operands = instruction.operands
    console.log('Manual parsing:')
    console.log('operands[0] =', operands[0], '(0x' + operands[0].toString(16) + ')')
    console.log('operands[1] =', operands[1])
    console.log('operands[2] =', operands[2])
    
    // Parse registers
    const registerA = operands[0] & 0x0f // low nibble
    const registerB = (operands[0] >> 4) & 0x0f // high nibble
    console.log('registerA (destination) =', registerA)
    console.log('registerB (source) =', registerB)
    
    // Parse immediate as 2 bytes
    const immediate2Bytes = operands[1] | (operands[2] << 8)
    console.log('immediate (2 bytes) =', immediate2Bytes)
    
    // Parse immediate as 1 byte
    const immediate1Byte = operands[1]
    console.log('immediate (1 byte) =', immediate1Byte)

    // Expected: register 12 should be modified (contains 2)
    // Operation: -2 + immediate = -1
    // So immediate should be 1
    
    expect(registerA).toBe(12) // Should be register 12
    expect(immediate1Byte).toBe(1) // Should be immediate 1
  })
})
