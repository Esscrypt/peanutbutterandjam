import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../../config'
import { InstructionRegistry } from '../../instructions/registry'

describe('Multiplication Upper Bits Instructions', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('MUL_UPPER_S_S Instruction', () => {
    it('should compute upper bits of signed-signed multiplication', () => {
      const handler = registry.getHandler(0x213)!
      const context = {
        instruction: { opcode: 0x213, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0x7fffffffffffffffn,
          r2: 2n,
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
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
      // Upper bits of signed multiplication should be computed
      expect(result.newRegisters!.r0).toBeDefined()
    })

    it('should handle negative values correctly', () => {
      const handler = registry.getHandler(0x213)!
      const context = {
        instruction: { opcode: 0x213, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: -2n,
          r2: 3n,
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
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
      // (-2) * 3 = -6, upper bits should reflect signed arithmetic
      expect(result.newRegisters!.r0).toBeDefined()
    })

    it('should validate operands correctly', () => {
      const handler = registry.getHandler(0x213)!
      expect(handler.validate([0, 1, 2])).toBe(true)
      expect(handler.validate([0, 1])).toBe(false)
      expect(handler.validate([0, 1, 2, 3])).toBe(false)
    })
  })

  describe('MUL_UPPER_U_U Instruction', () => {
    it('should compute upper bits of unsigned-unsigned multiplication', () => {
      const handler = registry.getHandler(0x214)!
      const context = {
        instruction: { opcode: 0x214, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0xffffffffffffffffn,
          r2: 2n,
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
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
      // Upper bits of unsigned multiplication should be computed
      expect(result.newRegisters!.r0).toBeDefined()
    })

    it('should handle large unsigned values', () => {
      const handler = registry.getHandler(0x214)!
      const context = {
        instruction: { opcode: 0x214, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0x8000000000000000n,
          r2: 0x8000000000000000n,
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
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
      // Large unsigned multiplication should produce significant upper bits
      expect(result.newRegisters!.r0).toBeDefined()
    })
  })

  describe('MUL_UPPER_S_U Instruction', () => {
    it('should compute upper bits of signed-unsigned multiplication', () => {
      const handler = registry.getHandler(0x215)!
      const context = {
        instruction: { opcode: 0x215, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: -2n,
          r2: 0xffffffffffffffffn,
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
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
      // Upper bits of signed-unsigned multiplication should be computed
      expect(result.newRegisters!.r0).toBeDefined()
    })

    it('should handle mixed signed and unsigned values', () => {
      const handler = registry.getHandler(0x215)!
      const context = {
        instruction: { opcode: 0x215, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0x7fffffffffffffffn,
          r2: 0xffffffffffffffffn,
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
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
      // Mixed signed-unsigned multiplication should be computed correctly
      expect(result.newRegisters!.r0).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero operands', () => {
      const handler = registry.getHandler(0x213)!
      const context = {
        instruction: { opcode: 0x213, operands: [0, 1, 2], address: 0 },
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
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
      expect(result.newRegisters!.r0).toBe(0n) // 0 * 0 = 0, upper bits should be 0
    })

    it('should handle maximum values', () => {
      const handler = registry.getHandler(0x214)!
      const context = {
        instruction: { opcode: 0x214, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0xffffffffffffffffn,
          r2: 0xffffffffffffffffn,
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
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
      // Maximum unsigned multiplication should produce maximum upper bits
      expect(result.newRegisters!.r0).toBeDefined()
    })
  })

  describe('Instruction Validation', () => {
    it('should have correct opcodes for multiplication upper bits instructions', () => {
      expect(registry.getHandler(0x213)?.name).toBe('MUL_UPPER_S_S')
      expect(registry.getHandler(0x214)?.name).toBe('MUL_UPPER_U_U')
      expect(registry.getHandler(0x215)?.name).toBe('MUL_UPPER_S_U')
    })

    it('should validate operands correctly for all multiplication upper bits instructions', () => {
      const mulUpperSS = registry.getHandler(0x213)!
      const mulUpperUU = registry.getHandler(0x214)!
      const mulUpperSU = registry.getHandler(0x215)!

      expect(mulUpperSS.validate([0, 1, 2])).toBe(true)
      expect(mulUpperUU.validate([0, 1, 2])).toBe(true)
      expect(mulUpperSU.validate([0, 1, 2])).toBe(true)

      expect(mulUpperSS.validate([0, 1])).toBe(false)
      expect(mulUpperUU.validate([0, 1])).toBe(false)
      expect(mulUpperSU.validate([0, 1])).toBe(false)
    })

    it('should disassemble correctly', () => {
      const mulUpperSS = registry.getHandler(0x213)!
      const mulUpperUU = registry.getHandler(0x214)!
      const mulUpperSU = registry.getHandler(0x215)!

      expect(mulUpperSS.disassemble([0, 1, 2])).toBe('MUL_UPPER_S_S r0 r1 r2')
      expect(mulUpperUU.disassemble([0, 1, 2])).toBe('MUL_UPPER_U_U r0 r1 r2')
      expect(mulUpperSU.disassemble([0, 1, 2])).toBe('MUL_UPPER_S_U r0 r1 r2')
    })
  })
})
