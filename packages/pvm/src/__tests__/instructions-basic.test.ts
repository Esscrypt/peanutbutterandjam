import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../config'
import { InstructionRegistry } from '../instructions/registry'

describe('Basic Instruction Tests', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('Instruction Registry', () => {
    it('should have 139 instructions registered', () => {
      const handlers = registry.getAllHandlers()
      expect(handlers.length).toBe(139)
    })

    it('should have correct opcodes for key instructions', () => {
      expect(registry.getHandler(0)?.name).toBe('TRAP')
      expect(registry.getHandler(1)?.name).toBe('FALLTHROUGH')
      expect(registry.getHandler(0x10)?.name).toBe('ECALLI')
      expect(registry.getHandler(0x40)?.name).toBe('JUMP')
      expect(registry.getHandler(0x100)?.name).toBe('MOVE_REG')
      expect(registry.getHandler(0x190)?.name).toBe('ADD_32')
      expect(registry.getHandler(0x22a)?.name).toBe('MIN_U')
    })

    it('should have unique opcodes', () => {
      const opcodes = registry.getRegisteredOpcodes()
      const uniqueOpcodes = new Set(opcodes)
      expect(uniqueOpcodes.size).toBe(139)
    })
  })

  describe('TRAP Instruction', () => {
    it('should panic the PVM', () => {
      const handler = registry.getHandler(0)
      expect(handler).toBeDefined()
      expect(handler!.name).toBe('TRAP')

      // Create a minimal context for testing
      const context = {
        instruction: { opcode: 0, operands: [], address: 0 },
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

      const result = handler!.execute(context)
      expect(result.resultCode).toBe(RESULT_CODES.PANIC)
    })
  })

  describe('FALLTHROUGH Instruction', () => {
    it('should perform no operation and advance', () => {
      const handler = registry.getHandler(1)
      expect(handler).toBeDefined()
      expect(handler!.name).toBe('FALLTHROUGH')

      const context = {
        instruction: { opcode: 1, operands: [], address: 0 },
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

      const result = handler!.execute(context)
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
    })
  })

  describe('JUMP Instruction', () => {
    it('should jump to specified address', () => {
      const handler = registry.getHandler(0x40)
      expect(handler).toBeDefined()
      expect(handler!.name).toBe('JUMP')

      const context = {
        instruction: { opcode: 0x40, operands: [100], address: 0 },
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

      const result = handler!.execute(context)
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(100)
    })
  })

  describe('ADD_32 Instruction', () => {
    it('should add 32-bit registers', () => {
      const handler = registry.getHandler(0x190)
      expect(handler).toBeDefined()
      expect(handler!.name).toBe('ADD_32')

      const context = {
        instruction: { opcode: 0x190, operands: [0, 1, 2], address: 0 }, // r0 = r1 + r2
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 10n,
          r2: 20n,
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

      const result = handler!.execute(context)
      expect(result.resultCode).toBe(RESULT_CODES.HALT)
      expect(result.newInstructionPointer).toBe(1)
      expect(result.newRegisters!.r0).toBe(30n) // r0 should contain the result
    })
  })

  describe('Instruction Validation', () => {
    it('should validate instruction operands correctly', () => {
      const ecalli = registry.getHandler(0x10)!
      expect(ecalli.validate([42])).toBe(true)
      expect(ecalli.validate([])).toBe(false)

      const add32 = registry.getHandler(0x190)!
      expect(add32.validate([0, 1, 2])).toBe(true)
      expect(add32.validate([0, 1])).toBe(false)

      const jump = registry.getHandler(0x40)!
      expect(jump.validate([100])).toBe(true)
      expect(jump.validate([])).toBe(false)
    })
  })

  describe('Instruction Disassembly', () => {
    it('should disassemble instructions correctly', () => {
      const ecalli = registry.getHandler(0x10)!
      expect(ecalli.disassemble([42])).toBe('ECALLI 0x2a')

      const add32 = registry.getHandler(0x190)!
      expect(add32.disassemble([0, 1, 2])).toBe('ADD_32 r0 r1 r2')

      const jump = registry.getHandler(0x40)!
      expect(jump.disassemble([100])).toBe('JUMP 0x64')

      const move = registry.getHandler(0x100)!
      expect(move.disassemble([0, 1])).toBe('MOVE_REG r0 r1')
    })
  })
})
