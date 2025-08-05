import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../../config'
import { InstructionRegistry } from '../../instructions/registry'

describe('Branching Instructions', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('Unconditional Jumps', () => {
    describe('JUMP', () => {
      it('should jump to specified address', () => {
        const handler = registry.getHandler(0x40)!
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

        const result = handler.execute(context)
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(100)
      })
    })

    describe('JUMP_IND', () => {
      it('should jump to address in register plus immediate', () => {
        const handler = registry.getHandler(0x50)!
        const context = {
          instruction: { opcode: 0x50, operands: [0, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 100n,
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
        expect(result.newInstructionPointer).toBe(110) // 100 + 10
      })
    })
  })

  describe('Conditional Branches with Immediate', () => {
    describe('BRANCH_EQ_IMM', () => {
      it('should branch when register equals immediate', () => {
        const handler = registry.getHandler(0x81)!
        const context = {
          instruction: { opcode: 0x81, operands: [0, 42, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 42n,
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
        expect(result.newInstructionPointer).toBe(10) // Should branch
      })

      it('should not branch when register does not equal immediate', () => {
        const handler = registry.getHandler(0x81)!
        const context = {
          instruction: { opcode: 0x81, operands: [0, 42, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 50n,
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
        expect(result.newInstructionPointer).toBe(1) // Should not branch
      })
    })

    describe('BRANCH_NE_IMM', () => {
      it('should branch when register does not equal immediate', () => {
        const handler = registry.getHandler(0x82)!
        const context = {
          instruction: { opcode: 0x82, operands: [0, 42, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 50n,
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
        expect(result.newInstructionPointer).toBe(10) // Should branch
      })
    })

    describe('BRANCH_LT_U_IMM', () => {
      it('should branch when register is less than immediate (unsigned)', () => {
        const handler = registry.getHandler(0x83)!
        const context = {
          instruction: { opcode: 0x83, operands: [0, 50, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 30n,
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
        expect(result.newInstructionPointer).toBe(10) // Should branch
      })
    })

    describe('BRANCH_LT_S_IMM', () => {
      it('should branch when register is less than immediate (signed)', () => {
        const handler = registry.getHandler(0x87)!
        const context = {
          instruction: { opcode: 0x87, operands: [0, 50, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: -10n,
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
        expect(result.newInstructionPointer).toBe(10) // Should branch
      })
    })
  })

  describe('Conditional Branches between Registers', () => {
    describe('BRANCH_EQ', () => {
      it('should branch when two registers are equal', () => {
        const handler = registry.getHandler(0x170)!
        const context = {
          instruction: { opcode: 0x170, operands: [0, 1, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 42n,
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
        expect(result.newInstructionPointer).toBe(10) // Should branch
      })
    })

    describe('BRANCH_NE', () => {
      it('should branch when two registers are not equal', () => {
        const handler = registry.getHandler(0x171)!
        const context = {
          instruction: { opcode: 0x171, operands: [0, 1, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 42n,
            r1: 50n,
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
        expect(result.newInstructionPointer).toBe(10) // Should branch
      })
    })

    describe('BRANCH_LT_U', () => {
      it('should branch when first register is less than second (unsigned)', () => {
        const handler = registry.getHandler(0x172)!
        const context = {
          instruction: { opcode: 0x172, operands: [0, 1, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 30n,
            r1: 50n,
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
        expect(result.newInstructionPointer).toBe(10) // Should branch
      })
    })

    describe('BRANCH_LT_S', () => {
      it('should branch when first register is less than second (signed)', () => {
        const handler = registry.getHandler(0x173)!
        const context = {
          instruction: { opcode: 0x173, operands: [0, 1, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: -10n,
            r1: 50n,
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
        expect(result.newInstructionPointer).toBe(10) // Should branch
      })
    })
  })

  describe('Load and Jump Instructions', () => {
    describe('LOAD_IMM_JUMP', () => {
      it('should load immediate and jump', () => {
        const handler = registry.getHandler(0x80)!
        const context = {
          instruction: { opcode: 0x80, operands: [0, 42, 10], address: 0 },
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
        expect(result.newInstructionPointer).toBe(10)
        expect(result.newRegisters!.r0).toBe(42n)
      })
    })

    describe('LOAD_IMM_JUMP_IND', () => {
      it('should load immediate and jump indirect', () => {
        const handler = registry.getHandler(0x180)!
        const context = {
          instruction: { opcode: 0x180, operands: [0, 1, 42, 10], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 100n,
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
        expect(result.newInstructionPointer).toBe(110) // 100 + 10
        expect(result.newRegisters!.r0).toBe(42n)
      })
    })
  })
})
