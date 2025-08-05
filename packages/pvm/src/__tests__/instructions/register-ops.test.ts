import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../../config'
import { InstructionRegistry } from '../../instructions/registry'

describe('Register Operations Instructions', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('MOVE_REG Instruction', () => {
    it('should move value from one register to another', () => {
      const handler = registry.getHandler(0x100)!
      const context = {
        instruction: { opcode: 0x100, operands: [0, 1], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 42n,
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
      expect(result.newRegisters!.r0).toBe(42n)
    })

    it('should validate operands correctly', () => {
      const handler = registry.getHandler(0x100)!
      expect(handler.validate([0, 1])).toBe(true)
      expect(handler.validate([0])).toBe(false)
      expect(handler.validate([0, 1, 2])).toBe(true) // MOVE_REG allows multiple operands
    })
  })

  describe('SBRK Instruction', () => {
    it('should allocate memory and return pointer', () => {
      const handler = registry.getHandler(0x101)!
      const context = {
        instruction: { opcode: 0x101, operands: [0, 1], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 64n,
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
      expect(result.newRegisters!.r0).toBeGreaterThan(0n) // Should return allocated pointer
    })
  })

  describe('Bit Counting Instructions', () => {
    describe('COUNT_SET_BITS_64', () => {
      it('should count set bits in 64-bit register', () => {
        const handler = registry.getHandler(0x102)!
        const context = {
          instruction: { opcode: 0x102, operands: [0, 1], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0b1101n,
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
        expect(result.newRegisters!.r0).toBe(3n) // 1101 has 3 set bits
      })
    })

    describe('COUNT_SET_BITS_32', () => {
      it('should count set bits in 32-bit register', () => {
        const handler = registry.getHandler(0x103)!
        const context = {
          instruction: { opcode: 0x103, operands: [0, 1], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0b1010n,
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
        expect(result.newRegisters!.r0).toBe(2n) // 1010 has 2 set bits
      })
    })

    describe('LEADING_ZERO_BITS_64', () => {
      it('should count leading zero bits in 64-bit register', () => {
        const handler = registry.getHandler(0x104)!
        const context = {
          instruction: { opcode: 0x104, operands: [0, 1], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0b0001n,
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
        expect(result.newRegisters!.r0).toBe(63n) // 64-bit value with 1 at LSB has 63 leading zeros
      })
    })

    describe('TRAILING_ZERO_BITS_64', () => {
      it('should count trailing zero bits in 64-bit register', () => {
        const handler = registry.getHandler(0x106)!
        const context = {
          instruction: { opcode: 0x106, operands: [0, 1], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0b1000n,
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
        expect(result.newRegisters!.r0).toBe(3n) // 1000 has 3 trailing zeros
      })
    })
  })

  describe('Sign Extension Instructions', () => {
    describe('SIGN_EXTEND_8', () => {
      it('should sign extend 8-bit value', () => {
        const handler = registry.getHandler(0x108)!
        const context = {
          instruction: { opcode: 0x108, operands: [0, 1], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0xfen,
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
        expect(result.newRegisters!.r0).toBe(-2n) // 0xFE sign extended to 64-bit
      })
    })

    describe('SIGN_EXTEND_16', () => {
      it('should sign extend 16-bit value', () => {
        const handler = registry.getHandler(0x109)!
        const context = {
          instruction: { opcode: 0x109, operands: [0, 1], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0xfffen,
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
        expect(result.newRegisters!.r0).toBe(-2n) // 0xFFFE sign extended to 64-bit
      })
    })

    describe('ZERO_EXTEND_16', () => {
      it('should zero extend 16-bit value', () => {
        const handler = registry.getHandler(0x110)!
        const context = {
          instruction: { opcode: 0x110, operands: [0, 1], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0xfffe,
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
        expect(result.newRegisters!.r0).toBe(0xfffe) // 0xFFFE zero extended to 64-bit
      })
    })
  })

  describe('REVERSE_BYTES Instruction', () => {
    it('should reverse byte order of register value', () => {
      const handler = registry.getHandler(0x111)!
      const context = {
        instruction: { opcode: 0x111, operands: [0, 1], address: 0 },
        instructionPointer: 0,
        gasCounter: 100n,
        registers: {
          r0: 0n,
          r1: 0x1234567890abcdefn,
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
      expect(result.newRegisters!.r0).toBe(0xefcdab9078563412n) // Byte-reversed
    })
  })

  describe('Register Operations Validation', () => {
    it('should have correct opcodes for register operations', () => {
      expect(registry.getHandler(0x100)?.name).toBe('MOVE_REG')
      expect(registry.getHandler(0x101)?.name).toBe('SBRK')
      expect(registry.getHandler(0x102)?.name).toBe('COUNT_SET_BITS_64')
      expect(registry.getHandler(0x103)?.name).toBe('COUNT_SET_BITS_32')
      expect(registry.getHandler(0x104)?.name).toBe('LEADING_ZERO_BITS_64')
      expect(registry.getHandler(0x106)?.name).toBe('TRAILING_ZERO_BITS_64')
      expect(registry.getHandler(0x108)?.name).toBe('SIGN_EXTEND_8')
      expect(registry.getHandler(0x109)?.name).toBe('SIGN_EXTEND_16')
      expect(registry.getHandler(0x10a)?.name).toBe('ZERO_EXTEND_16')
      expect(registry.getHandler(0x111)?.name).toBe('REVERSE_BYTES')
    })
  })
})
