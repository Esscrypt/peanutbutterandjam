import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../../config'
import { InstructionRegistry } from '../../instructions/registry'

describe('Conditional Instructions', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('Immediate Conditional Operations', () => {
    describe('CMOV_IZ_IMM', () => {
      it('should move immediate to register if source register is zero', () => {
        const handler = registry.getHandler(0x13b)!
        const context = {
          instruction: { opcode: 0x13b, operands: [0, 1, 42], address: 0 },
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
        expect(result.newRegisters!.r0).toBe(42n) // Should move immediate since r1 is zero
      })

      it('should not move immediate to register if source register is not zero', () => {
        const handler = registry.getHandler(0x13b)!
        const context = {
          instruction: { opcode: 0x13b, operands: [0, 1, 42], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 5n,
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
        expect(result.newRegisters!.r0).toBe(0n) // Should not move since r1 is not zero
      })
    })

    describe('CMOV_NZ_IMM', () => {
      it('should move immediate to register if source register is not zero', () => {
        const handler = registry.getHandler(0x13c)!
        const context = {
          instruction: { opcode: 0x13c, operands: [0, 1, 42], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 5n,
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
        expect(result.newRegisters!.r0).toBe(42n) // Should move immediate since r1 is not zero
      })

      it('should not move immediate to register if source register is zero', () => {
        const handler = registry.getHandler(0x13c)!
        const context = {
          instruction: { opcode: 0x13c, operands: [0, 1, 42], address: 0 },
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
        expect(result.newRegisters!.r0).toBe(0n) // Should not move since r1 is zero
      })
    })
  })

  describe('Register-based Conditional Operations', () => {
    describe('CMOV_IZ', () => {
      it('should move source register to destination if condition register is zero', () => {
        const handler = registry.getHandler(0x218)!
        const context = {
          instruction: { opcode: 0x218, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 42n,
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
        expect(result.newRegisters!.r0).toBe(42n) // Should move r2 since r1 is zero
      })

      it('should not move source register to destination if condition register is not zero', () => {
        const handler = registry.getHandler(0x218)!
        const context = {
          instruction: { opcode: 0x218, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 5n,
            r2: 42n,
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
        expect(result.newRegisters!.r0).toBe(0n) // Should not move since r1 is not zero
      })
    })

    describe('CMOV_NZ', () => {
      it('should move source register to destination if condition register is not zero', () => {
        const handler = registry.getHandler(0x219)!
        const context = {
          instruction: { opcode: 0x219, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 5n,
            r2: 42n,
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
        expect(result.newRegisters!.r0).toBe(42n) // Should move r2 since r1 is not zero
      })

      it('should not move source register to destination if condition register is zero', () => {
        const handler = registry.getHandler(0x219)!
        const context = {
          instruction: { opcode: 0x219, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 42n,
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
        expect(result.newRegisters!.r0).toBe(0n) // Should not move since r1 is zero
      })
    })
  })

  describe('Edge Cases', () => {
    describe('Negative Values', () => {
      it('should handle negative values correctly for CMOV_IZ', () => {
        const handler = registry.getHandler(0x218)!
        const context = {
          instruction: { opcode: 0x218, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: -42n,
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
        expect(result.newRegisters!.r0).toBe(-42n) // Should move negative value since r1 is zero
      })

      it('should handle negative values correctly for CMOV_NZ', () => {
        const handler = registry.getHandler(0x219)!
        const context = {
          instruction: { opcode: 0x219, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: -5n,
            r2: 42n,
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
        expect(result.newRegisters!.r0).toBe(42n) // Should move since r1 is not zero (negative is not zero)
      })
    })

    describe('Large Values', () => {
      it('should handle large immediate values correctly', () => {
        const handler = registry.getHandler(0x13b)!
        const context = {
          instruction: {
            opcode: 0x13b,
            operands: [0, 1, 0xffffffff],
            address: 0,
          },
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
        expect(result.newRegisters!.r0).toBe(0xffffffffn) // Should move large immediate since r1 is zero
      })
    })
  })
})
