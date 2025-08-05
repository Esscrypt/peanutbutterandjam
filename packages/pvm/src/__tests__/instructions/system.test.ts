import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../../config'
import { InstructionRegistry } from '../../instructions/registry'

describe('System Instructions', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('ECALLI Instruction', () => {
    it('should execute host call with immediate value', () => {
      const handler = registry.getHandler(0x10)!
      expect(handler).toBeDefined()
      expect(handler.name).toBe('ECALLI')

      const context = {
        instruction: { opcode: 0x10, operands: [0], address: 0 }, // Use function ID 0 (gas)
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0n,
          r2: 0n,
          r3: 0n,
          r4: 0n,
          r5: 0n,
          r6: 0n,
          r7: 0n,
          r8: 0,
          r9: 0,
          r10: 0,
          r11: 0,
          r12: 0,
        },
        ram: {
          cells: new Map(),
          readOctet: () => 0,
          writeOctet: () => {},
          readOctets: () => [],
          writeOctets: () => {},
          isReadable: () => true,
          isWritable: () => true,
          getMemoryLayout: () => ({
            stackStart: 0,
            heapStart: 0,
            totalSize: 0,
          }),
        },
        callStack: {
          frames: [],
          pushFrame: () => {},
          popFrame: () => undefined,
          getCurrentFrame: () => undefined,
          isEmpty: () => true,
          getDepth: () => 0,
        },
        stackPointer: 0,
      }

      const result = handler.execute(context)
      expect(result.resultCode).toBe(RESULT_CODES.HALT) // Successful function call returns HALT
      expect(result.newInstructionPointer).toBe(1)
    })

    it('should validate operands correctly', () => {
      const handler = registry.getHandler(0x10)!
      expect(handler.validate([42])).toBe(true)
      expect(handler.validate([])).toBe(false)
      expect(handler.validate([42, 43])).toBe(true) // ECALLI allows multiple operands
    })

    it('should disassemble correctly', () => {
      const handler = registry.getHandler(0x10)!
      expect(handler.disassemble([42])).toBe('ECALLI 42')
      expect(handler.disassemble([0x1234])).toBe('ECALLI 4660')
    })

    it('should handle different immediate values', () => {
      const handler = registry.getHandler(0x10)!

      // Test with zero (gas function)
      const context1 = {
        instruction: { opcode: 0x10, operands: [0], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0n,
          r2: 0n,
          r3: 0n,
          r4: 0n,
          r5: 0n,
          r6: 0n,
          r7: 0n,
          r8: 0,
          r9: 0,
          r10: 0,
          r11: 0,
          r12: 0,
        },
        ram: {
          cells: new Map(),
          readOctet: () => 0,
          writeOctet: () => {},
          readOctets: () => [],
          writeOctets: () => {},
          isReadable: () => true,
          isWritable: () => true,
          getMemoryLayout: () => ({
            stackStart: 0,
            heapStart: 0,
            totalSize: 0,
          }),
        },
        callStack: {
          frames: [],
          pushFrame: () => {},
          popFrame: () => undefined,
          getCurrentFrame: () => undefined,
          isEmpty: () => true,
          getDepth: () => 0,
        },
        stackPointer: 0,
      }

      const result1 = handler.execute(context1)
      expect(result1.resultCode).toBe(RESULT_CODES.HALT) // Successful function call returns HALT
      expect(result1.newInstructionPointer).toBe(1)

      // Test with invalid function ID (should return PANIC)
      const context2 = {
        instruction: { opcode: 0x10, operands: [999], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0n,
          r2: 0n,
          r3: 0n,
          r4: 0n,
          r5: 0n,
          r6: 0n,
          r7: 0n,
          r8: 0,
          r9: 0,
          r10: 0,
          r11: 0,
          r12: 0,
        },
        ram: {
          cells: new Map(),
          readOctet: () => 0,
          writeOctet: () => {},
          readOctets: () => [],
          writeOctets: () => {},
          isReadable: () => true,
          isWritable: () => true,
          getMemoryLayout: () => ({
            stackStart: 0,
            heapStart: 0,
            totalSize: 0,
          }),
        },
        callStack: {
          frames: [],
          pushFrame: () => {},
          popFrame: () => undefined,
          getCurrentFrame: () => undefined,
          isEmpty: () => true,
          getDepth: () => 0,
        },
        stackPointer: 0,
      }

      const result2 = handler.execute(context2)
      expect(result2.resultCode).toBe(RESULT_CODES.PANIC) // Unknown function ID returns PANIC
      expect(result2.newInstructionPointer).toBe(1)
    })
  })

  describe('System Instruction Validation', () => {
    it('should have correct opcode for ECALLI', () => {
      expect(registry.getHandler(0x10)?.name).toBe('ECALLI')
    })

    it('should have unique opcodes for system instructions', () => {
      const systemOpcodes = [0x10] // ECALLI
      const uniqueOpcodes = new Set(systemOpcodes)
      expect(uniqueOpcodes.size).toBe(systemOpcodes.length)
    })
  })
})
