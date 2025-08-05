import type { CallStack, CallStackFrame } from './types'

/**
 * PVM Call Stack Implementation
 *
 * Manages function call stack for the PVM runtime
 */
export class PVMCallStack implements CallStack {
  public frames: CallStackFrame[] = []

  pushFrame(frame: CallStackFrame): void {
    this.frames.push(frame)
  }

  popFrame(): CallStackFrame | undefined {
    return this.frames.pop()
  }

  getCurrentFrame(): CallStackFrame | undefined {
    return this.frames[this.frames.length - 1]
  }

  isEmpty(): boolean {
    return this.frames.length === 0
  }

  getDepth(): number {
    return this.frames.length
  }
}
