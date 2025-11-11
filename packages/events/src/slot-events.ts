/**
 * Slot Events for Event-Driven Architecture
 *
 * Defines slot-based events that services can subscribe to
 */

  /**
 * Base slot event interface
 */
export interface SlotEvent {
  timestamp: number
  slot: bigint
  epoch: bigint
  phase: bigint
}

/**
 * Slot change event - emitted when a new slot begins
 */
export interface SlotChangeEvent extends SlotEvent {
  previousSlot: bigint
  isEpochTransition: boolean
}

/**
 * Slot callback function type
 */
export type SlotCallback = (event: SlotChangeEvent) => void | Promise<void>
