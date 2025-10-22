import {
  ExportHostFunction,
  ExpungeHostFunction,
  FetchHostFunction,
  GasHostFunction,
  HistoricalLookupHostFunction,
  InfoHostFunction,
  InvokeHostFunction,
  LookupHostFunction,
  MachineHostFunction,
  PagesHostFunction,
  PeekHostFunction,
  PokeHostFunction,
  ReadHostFunction,
  WriteHostFunction,
} from '.'
import type { BaseHostFunction } from './base'

/**
 * Registry for managing all host functions
 *
 * Similar to the instruction registry, this maintains a mapping of
 * function IDs to their corresponding implementations.
 */
export class HostFunctionRegistry {
  private readonly functions = new Map<bigint, BaseHostFunction>()

  constructor() {
    this.registerHostFunctions()
  }

  private registerHostFunctions(): void {
    this.register(new GasHostFunction())
    this.register(new FetchHostFunction())
    this.register(new HistoricalLookupHostFunction())
    this.register(new LookupHostFunction())
    this.register(new ReadHostFunction())
    this.register(new WriteHostFunction())
    this.register(new InfoHostFunction())
    this.register(new ExportHostFunction())
    this.register(new MachineHostFunction())
    this.register(new PeekHostFunction())
    this.register(new PokeHostFunction())
    this.register(new PagesHostFunction())
    this.register(new InvokeHostFunction())
    this.register(new ExpungeHostFunction())
  }

  register(hostFunction: BaseHostFunction): void {
    this.functions.set(hostFunction.functionId, hostFunction)
  }

  get(functionId: bigint): BaseHostFunction | undefined {
    return this.functions.get(functionId)
  }
}
