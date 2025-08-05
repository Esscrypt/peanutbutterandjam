import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../../config'
import { InstructionRegistry } from '../../instructions/registry'

describe('Arithmetic Instructions', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('32-bit Arithmetic Instructions', () => {
    describe('ADD_32', () => {
      it('should add two 32-bit registers', () => {
        const handler = registry.getHandler(0x190)!
        const context = {
          instruction: { opcode: 0x190, operands: [0, 1, 2], address: 0 },
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

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(30n)
      })

      it('should handle 32-bit overflow correctly', () => {
        const handler = registry.getHandler(0x190)!
        const context = {
          instruction: { opcode: 0x190, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0xffffffffn,
            r2: 1n,
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
        expect(result.newRegisters!.r0).toBe(0n) // Overflow wraps to 0
      })
    })

    describe('SUB_32', () => {
      it('should subtract two 32-bit registers', () => {
        const handler = registry.getHandler(0x191)!
        const context = {
          instruction: { opcode: 0x191, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 30n,
            r2: 10n,
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
        expect(result.newRegisters!.r0).toBe(20n)
      })

      it('should handle 32-bit underflow correctly', () => {
        const handler = registry.getHandler(0x191)!
        const context = {
          instruction: { opcode: 0x191, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0n,
            r2: 1n,
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
        expect(result.newRegisters!.r0).toBe(0xffffffffn) // Underflow wraps to max
      })
    })

    describe('MUL_32', () => {
      it('should multiply two 32-bit registers', () => {
        const handler = registry.getHandler(0x192)!
        const context = {
          instruction: { opcode: 0x192, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 6n,
            r2: 7n,
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
    })

    describe('DIV_U_32', () => {
      it('should perform unsigned division of 32-bit registers', () => {
        const handler = registry.getHandler(0x193)!
        const context = {
          instruction: { opcode: 0x193, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 20n,
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
        expect(result.newRegisters!.r0).toBe(6n)
      })

      it('should handle division by zero', () => {
        const handler = registry.getHandler(0x193)!
        const context = {
          instruction: { opcode: 0x193, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 20n,
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
        expect(result.resultCode).toBe(RESULT_CODES.PANIC) // Division by zero should panic
      })
    })

    describe('REM_U_32', () => {
      it('should perform unsigned remainder of 32-bit registers', () => {
        const handler = registry.getHandler(0x195)!
        const context = {
          instruction: { opcode: 0x195, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 23n,
            r2: 7n,
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
        expect(result.newRegisters!.r0).toBe(2n)
      })
    })
  })

  describe('64-bit Arithmetic Instructions', () => {
    describe('ADD_64', () => {
      it('should add two 64-bit registers', () => {
        const handler = registry.getHandler(0x200)!
        const context = {
          instruction: { opcode: 0x200, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 1000000000000n,
            r2: 2000000000000n,
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
        expect(result.newRegisters!.r0).toBe(3000000000000n)
      })
    })

    describe('SUB_64', () => {
      it('should subtract two 64-bit registers', () => {
        const handler = registry.getHandler(0x201)!
        const context = {
          instruction: { opcode: 0x201, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 3000000000000n,
            r2: 1000000000000n,
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
        expect(result.newRegisters!.r0).toBe(2000000000000n)
      })
    })

    describe('MUL_64', () => {
      it('should multiply two 64-bit registers', () => {
        const handler = registry.getHandler(0x202)!
        const context = {
          instruction: { opcode: 0x202, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 1000n,
            r2: 2000n,
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
        expect(result.newRegisters!.r0).toBe(2000000n)
      })
    })
  })

  describe('Immediate Arithmetic Instructions', () => {
    describe('ADD_IMM_32', () => {
      it('should add immediate to 32-bit register', () => {
        const handler = registry.getHandler(0x12b)!
        const context = {
          instruction: { opcode: 0x12b, operands: [0, 42], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 10n,
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
        expect(result.newRegisters!.r0).toBe(52n)
      })
    })

    describe('ADD_IMM_64', () => {
      it('should add immediate to 64-bit register', () => {
        const handler = registry.getHandler(0x13d)!
        const context = {
          instruction: { opcode: 0x13d, operands: [0, 42], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 1000000000000n,
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
        expect(result.newRegisters!.r0).toBe(1000000000042n)
      })
    })
  })
})
