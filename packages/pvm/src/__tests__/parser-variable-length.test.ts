/**
 * PVM Parser Test - Variable Length Instructions
 * 
 * Tests the corrected parser against known test vectors
 */

import { describe, expect, it } from 'vitest'
import { PVMParser } from '../parser'

describe('PVM Parser - Variable Length Instructions', () => {
  const parser = new PVMParser()

  it('should parse inst_add_32 test vector correctly', () => {
    // Test vector: inst_add_32.json
    // Program: [0, 0, 3, 190, 135, 9, 1]
    // Expected: 0: be 87 09 (3 bytes total)
    
    const instructionData = new Uint8Array([0, 0, 3, 190, 135, 9, 1])
    
    const result = parser.parseProgramFromBytes(instructionData)

    expect(result.success).toBe(true)
    expect(result.instructions).toHaveLength(2)
    
    // First instruction: trap (opcode 0) - 1 byte
    expect(result.instructions[0].opcode).toBe(0n)
    expect(result.instructions[0].operands).toHaveLength(0)
    expect(result.instructions[0].address).toBe(0n)
    
    // Second instruction: add_imm_32 (opcode 190 = 0xBE) - 3 bytes total
    expect(result.instructions[1].opcode).toBe(190n)
    expect(result.instructions[1].operands).toHaveLength(2) // 2 operand bytes
    expect(result.instructions[1].operands[0]).toBe(135) // 0x87
    expect(result.instructions[1].operands[1]).toBe(9)   // 0x09
    expect(result.instructions[1].address).toBe(1n) // Next instruction starts at position 3
  })

  it('should parse gas_basic_consume_all test vector correctly', () => {
    // Test vector: gas_basic_consume_all.json
    // Program: [0, 0, 2, 100, 0, 1]
    // Expected: 0: 64 00 (2 bytes total)
    
    const instructionData = new Uint8Array([0, 0, 2, 100, 0, 1])
    
    const result = parser.parseProgramFromBytes(instructionData)

    expect(result.success).toBe(true)
    expect(result.instructions).toHaveLength(2)
    
    // First instruction: trap (opcode 0) - 1 byte
    expect(result.instructions[0].opcode).toBe(0n)
    expect(result.instructions[0].operands).toHaveLength(0)
    expect(result.instructions[0].address).toBe(0n)
    
    // Second instruction: move_reg (opcode 100 = 0x64) - 2 bytes total
    expect(result.instructions[1].opcode).toBe(100n)
    expect(result.instructions[1].operands).toHaveLength(1) // 1 operand byte
    expect(result.instructions[1].operands[0]).toBe(0) // 0x00
    expect(result.instructions[1].address).toBe(1n) // Next instruction starts at position 2
  })

  it('should handle instructions without arguments', () => {
    const instructionData = new Uint8Array([0, 1]) // trap, fallthrough
    const opcodeBitmask = new Uint8Array([1, 1])
    
    const result = parser.parseProgram({
      instructionData,
      opcodeBitmask,
      dynamicJumpTable: new Map(),
    })

    expect(result.success).toBe(true)
    expect(result.instructions).toHaveLength(2)
    
    expect(result.instructions[0].opcode).toBe(0n)
    expect(result.instructions[0].operands).toHaveLength(0)
    
    expect(result.instructions[1].opcode).toBe(1n)
    expect(result.instructions[1].operands).toHaveLength(0)
  })

  it('should handle ecalli instruction with variable immediate length', () => {
    const instructionData = new Uint8Array([10, 0x12, 0x34]) // ecalli with 2-byte immediate
    const opcodeBitmask = new Uint8Array([1, 0, 0])
    
    const result = parser.parseProgram({
      instructionData,
      opcodeBitmask,
      dynamicJumpTable: new Map(),
    })

    expect(result.success).toBe(true)
    expect(result.instructions).toHaveLength(1)
    
    expect(result.instructions[0].opcode).toBe(10n)
    expect(result.instructions[0].operands).toHaveLength(2) // 2-byte immediate
    expect(result.instructions[0].operands[0]).toBe(0x12)
    expect(result.instructions[0].operands[1]).toBe(0x34)
  })

  it('should validate instruction operands correctly', () => {
    // Test trap instruction (should have no operands)
    const trapInstruction = {
      opcode: 0n,
      operands: new Uint8Array(0),
      address: 0n,
    }
    
    const trapErrors = parser.validateInstruction(trapInstruction)
    expect(trapErrors).toHaveLength(0)
    
    // Test trap with invalid operands
    const invalidTrapInstruction = {
      opcode: 0n,
      operands: new Uint8Array([1, 2, 3]),
      address: 0n,
    }
    
    const invalidTrapErrors = parser.validateInstruction(invalidTrapInstruction)
    expect(invalidTrapErrors.length).toBeGreaterThan(0)
    expect(invalidTrapErrors[0]).toContain('should have no operands')
  })

  it('should get correct opcode names', () => {
    expect(parser.disassemble({
      opcode: 0n,
      operands: new Uint8Array(0),
      address: 0n,
    })).toBe('trap ')
    
    expect(parser.disassemble({
      opcode: 1n,
      operands: new Uint8Array(0),
      address: 0n,
    })).toBe('fallthrough ')
    
    expect(parser.disassemble({
      opcode: 10n,
      operands: new Uint8Array([0x12]),
      address: 0n,
    })).toBe('ecalli 18')
  })
})
