import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../../config'
import { InstructionRegistry } from '../../instructions/registry'

describe('Advanced Bitwise Instructions', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('AND_INV Instruction', () => {
    it('should perform bitwise AND with inverted second operand', () => {
      const handler = registry.getHandler(0x224)!
      const context = {
        instruction: { opcode: 0x224, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0b1100n,
          r2: 0b1010n,
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
      // r1 & ~r2 = 1100 & ~1010 = 1100 & 0101 = 0100
      expect(result.newRegisters!.r0).toBe(0b0100n)
    })

    it('should handle all ones and zeros', () => {
      const handler = registry.getHandler(0x224)!
      const context = {
        instruction: { opcode: 0x224, operands: [0, 1, 2], address: 0 },
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
      // All ones & ~all ones = all ones & all zeros = all zeros
      expect(result.newRegisters!.r0).toBe(0n)
    })

    it('should validate operands correctly', () => {
      const handler = registry.getHandler(0x224)!
      expect(handler.validate([0, 1, 2])).toBe(true)
      expect(handler.validate([0, 1])).toBe(false)
      expect(handler.validate([0, 1, 2, 3])).toBe(false)
    })
  })

  describe('OR_INV Instruction', () => {
    it('should perform bitwise OR with inverted second operand', () => {
      const handler = registry.getHandler(0x225)!
      const context = {
        instruction: { opcode: 0x225, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0b1100n,
          r2: 0b1010n,
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
      // r1 | ~r2 = 1100 | ~1010 = 1100 | 0101 = 1101
      expect(result.newRegisters!.r0).toBe(0b1101n)
    })

    it('should handle zero and all ones', () => {
      const handler = registry.getHandler(0x225)!
      const context = {
        instruction: { opcode: 0x225, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0n,
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
      // Zero | ~all ones = zero | all zeros = zero
      expect(result.newRegisters!.r0).toBe(0n)
    })
  })

  describe('XNOR Instruction', () => {
    it('should perform bitwise XNOR between registers', () => {
      const handler = registry.getHandler(0x226)!
      const context = {
        instruction: { opcode: 0x226, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0b1100n,
          r2: 0b1010n,
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
      // XNOR(1100, 1010) = ~(1100 ^ 1010) = ~(0110) = 1001
      expect(result.newRegisters!.r0).toBe(0b1001n)
    })

    it('should handle identical operands', () => {
      const handler = registry.getHandler(0x226)!
      const context = {
        instruction: { opcode: 0x226, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0b1100n,
          r2: 0b1100n,
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
      // XNOR(1100, 1100) = ~(1100 ^ 1100) = ~(0000) = 1111
      expect(result.newRegisters!.r0).toBe(0b1111n)
    })

    it('should handle complementary operands', () => {
      const handler = registry.getHandler(0x226)!
      const context = {
        instruction: { opcode: 0x226, operands: [0, 1, 2], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0b1100n,
          r2: 0b0011n,
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
      // XNOR(1100, 0011) = ~(1100 ^ 0011) = ~(1111) = 0000
      expect(result.newRegisters!.r0).toBe(0b0000n)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero operands for all advanced bitwise instructions', () => {
      const andInv = registry.getHandler(0x224)!
      const orInv = registry.getHandler(0x225)!
      const xnor = registry.getHandler(0x226)!

      const context = {
        instruction: { opcode: 0x224, operands: [0, 1, 2], address: 0 },
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

      // Test AND_INV with zeros
      const result1 = andInv.execute(context)
      expect(result1.resultCode).toBe(RESULT_CODES.HALT)
      expect(result1.newRegisters!.r0).toBe(0n)

      // Test OR_INV with zeros
      const context2 = {
        ...context,
        instruction: { ...context.instruction, opcode: 0x225 },
      }
      const result2 = orInv.execute(context2)
      expect(result2.resultCode).toBe(RESULT_CODES.HALT)
      expect(result2.newRegisters!.r0).toBe(0xffffffffffffffffn) // Zero | ~zero = zero | all ones = all ones

      // Test XNOR with zeros
      const context3 = {
        ...context,
        instruction: { ...context.instruction, opcode: 0x226 },
      }
      const result3 = xnor.execute(context3)
      expect(result3.resultCode).toBe(RESULT_CODES.HALT)
      expect(result3.newRegisters!.r0).toBe(0xffffffffffffffffn) // XNOR(0, 0) = ~(0 ^ 0) = ~0 = all ones
    })

    it('should handle maximum values for all advanced bitwise instructions', () => {
      const andInv = registry.getHandler(0x224)!
      const orInv = registry.getHandler(0x225)!
      const xnor = registry.getHandler(0x226)!

      const context = {
        instruction: { opcode: 0x224, operands: [0, 1, 2], address: 0 },
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

      // Test AND_INV with all ones
      const result1 = andInv.execute(context)
      expect(result1.resultCode).toBe(RESULT_CODES.HALT)
      expect(result1.newRegisters!.r0).toBe(0n) // All ones & ~all ones = all ones & all zeros = all zeros

      // Test OR_INV with all ones
      const context2 = {
        ...context,
        instruction: { ...context.instruction, opcode: 0x225 },
      }
      const result2 = orInv.execute(context2)
      expect(result2.resultCode).toBe(RESULT_CODES.HALT)
      expect(result2.newRegisters!.r0).toBe(0xffffffffffffffffn) // All ones | ~all ones = all ones | all zeros = all ones

      // Test XNOR with all ones
      const context3 = {
        ...context,
        instruction: { ...context.instruction, opcode: 0x226 },
      }
      const result3 = xnor.execute(context3)
      expect(result3.resultCode).toBe(RESULT_CODES.HALT)
      expect(result3.newRegisters!.r0).toBe(0xffffffffffffffffn) // XNOR(all ones, all ones) = ~(all ones ^ all ones) = ~0 = all ones
    })
  })

  describe('Instruction Validation', () => {
    it('should have correct opcodes for advanced bitwise instructions', () => {
      expect(registry.getHandler(0x224)?.name).toBe('AND_INV')
      expect(registry.getHandler(0x225)?.name).toBe('OR_INV')
      expect(registry.getHandler(0x226)?.name).toBe('XNOR')
    })

    it('should validate operands correctly for all advanced bitwise instructions', () => {
      const andInv = registry.getHandler(0x224)!
      const orInv = registry.getHandler(0x225)!
      const xnor = registry.getHandler(0x226)!

      expect(andInv.validate([0, 1, 2])).toBe(true)
      expect(orInv.validate([0, 1, 2])).toBe(true)
      expect(xnor.validate([0, 1, 2])).toBe(true)

      expect(andInv.validate([0, 1])).toBe(false)
      expect(orInv.validate([0, 1])).toBe(false)
      expect(xnor.validate([0, 1])).toBe(false)
    })

    it('should disassemble correctly', () => {
      const andInv = registry.getHandler(0x224)!
      const orInv = registry.getHandler(0x225)!
      const xnor = registry.getHandler(0x226)!

      expect(andInv.disassemble([0, 1, 2])).toBe('AND_INV r0 r1 r2')
      expect(orInv.disassemble([0, 1, 2])).toBe('OR_INV r0 r1 r2')
      expect(xnor.disassemble([0, 1, 2])).toBe('XNOR r0 r1 r2')
    })
  })
})
