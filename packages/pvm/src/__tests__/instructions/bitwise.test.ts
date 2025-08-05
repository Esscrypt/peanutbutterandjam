import { beforeEach, describe, expect, it } from 'vitest'
import { RESULT_CODES } from '../../config'
import { InstructionRegistry } from '../../instructions/registry'

describe('Bitwise Instructions', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('Basic Bitwise Operations', () => {
    describe('AND', () => {
      it('should perform bitwise AND between registers', () => {
        const handler = registry.getHandler(0x210)!
        const context = {
          instruction: { opcode: 0x210, operands: [0, 1, 2], address: 0 },
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
        expect(result.newRegisters!.r0).toBe(0b1000n)
      })
    })

    describe('OR', () => {
      it('should perform bitwise OR between registers', () => {
        const handler = registry.getHandler(0x212)!
        const context = {
          instruction: { opcode: 0x212, operands: [0, 1, 2], address: 0 },
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
        expect(result.newRegisters!.r0).toBe(0b1110n)
      })
    })

    describe('XOR', () => {
      it('should perform bitwise XOR between registers', () => {
        const handler = registry.getHandler(0x211)!
        const context = {
          instruction: { opcode: 0x211, operands: [0, 1, 2], address: 0 },
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
        expect(result.newRegisters!.r0).toBe(0b0110n)
      })
    })

    describe('XNOR', () => {
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
        expect(result.newRegisters!.r0).toBe(0b1001n) // XNOR of 1100 and 1010
      })
    })
  })

  describe('Immediate Bitwise Operations', () => {
    describe('AND_IMM', () => {
      it('should perform bitwise AND with immediate', () => {
        const handler = registry.getHandler(0x12c)!
        const context = {
          instruction: { opcode: 0x12c, operands: [0, 0b1010], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0b1100n,
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
        expect(result.newRegisters!.r0).toBe(0b1000n)
      })
    })

    describe('OR_IMM', () => {
      it('should perform bitwise OR with immediate', () => {
        const handler = registry.getHandler(0x12e)!
        const context = {
          instruction: { opcode: 0x12e, operands: [0, 0b1010], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0b1100n,
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
        expect(result.newRegisters!.r0).toBe(0b1110n)
      })
    })

    describe('XOR_IMM', () => {
      it('should perform bitwise XOR with immediate', () => {
        const handler = registry.getHandler(0x12d)!
        const context = {
          instruction: { opcode: 0x12d, operands: [0, 0b1010], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0b1100n,
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
        expect(result.newRegisters!.r0).toBe(0b0110n)
      })
    })
  })

  describe('Shift Operations', () => {
    describe('SHLO_L_32', () => {
      it('should perform logical left shift on 32-bit register', () => {
        const handler = registry.getHandler(0x197)!
        const context = {
          instruction: { opcode: 0x197, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0b0001n,
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
        expect(result.newRegisters!.r0).toBe(0b0100n)
      })
    })

    describe('SHLO_R_32', () => {
      it('should perform logical right shift on 32-bit register', () => {
        const handler = registry.getHandler(0x198)!
        const context = {
          instruction: { opcode: 0x198, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0b0100n,
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
        expect(result.newRegisters!.r0).toBe(0b0001n)
      })
    })

    describe('SHAR_R_32', () => {
      it('should perform arithmetic right shift on 32-bit register', () => {
        const handler = registry.getHandler(0x199)!
        const context = {
          instruction: { opcode: 0x199, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0x80000000n,
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
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(0xc0000000n) // Sign bit preserved
      })
    })
  })

  describe('Immediate Shift Operations', () => {
    describe('SHLO_L_IMM_32', () => {
      it('should perform logical left shift by immediate on 32-bit register', () => {
        const handler = registry.getHandler(0x132)!
        const context = {
          instruction: { opcode: 0x132, operands: [0, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0b0001n,
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
        expect(result.newRegisters!.r0).toBe(0b0100n)
      })
    })

    describe('SHLO_R_IMM_32', () => {
      it('should perform logical right shift by immediate on 32-bit register', () => {
        const handler = registry.getHandler(0x133)!
        const context = {
          instruction: { opcode: 0x133, operands: [0, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0b0100n,
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
        expect(result.newRegisters!.r0).toBe(0b0001n)
      })
    })
  })

  describe('Rotation Operations', () => {
    describe('ROT_L_32', () => {
      it('should perform left rotation on 32-bit register', () => {
        const handler = registry.getHandler(0x221)!
        const context = {
          instruction: { opcode: 0x221, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0x80000001n,
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
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(0x00000003n) // Rotated left by 1
      })
    })

    describe('ROT_R_32', () => {
      it('should perform right rotation on 32-bit register', () => {
        const handler = registry.getHandler(0x223)!
        const context = {
          instruction: { opcode: 0x223, operands: [0, 1, 2], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0x00000003n,
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
        expect(result.resultCode).toBe(RESULT_CODES.HALT)
        expect(result.newInstructionPointer).toBe(1)
        expect(result.newRegisters!.r0).toBe(0x80000001n) // Rotated right by 1
      })
    })
  })

  describe('Bit Counting Operations', () => {
    describe('COUNT_SET_BITS_32', () => {
      it('should count set bits in 32-bit register', () => {
        const handler = registry.getHandler(0x103)!
        const context = {
          instruction: { opcode: 0x103, operands: [0, 1], address: 0 },
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
        expect(result.newRegisters!.r0).toBe(3n) // 3 bits set in 1101
      })
    })

    describe('LEADING_ZERO_BITS_32', () => {
      it('should count leading zero bits in 32-bit register', () => {
        const handler = registry.getHandler(0x105)!
        const context = {
          instruction: { opcode: 0x105, operands: [0, 1], address: 0 },
          instructionPointer: 0,
          gasCounter: 100n,
          registers: {
            r0: 0n,
            r1: 0x00000008n,
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
        expect(result.newRegisters!.r0).toBe(28n) // 28 leading zeros before the 1
      })
    })
  })
})
