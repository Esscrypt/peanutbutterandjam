import { BaseHostFunction } from './base'
import { ExportHostFunction } from './export'
import { ExpungeHostFunction } from './expunge'
import { FetchHostFunction } from './fetch'
import { GasHostFunction } from './gas'
import { HistoricalLookupHostFunction } from './historical-lookup'
import { InfoHostFunction } from './info'
import { InvokeHostFunction } from './invoke'
import { LogHostFunction } from './log'
import { LookupHostFunction } from './lookup'
import { MachineHostFunction } from './machine'
import { PagesHostFunction } from './pages'
import { PeekHostFunction } from './peek'
import { PokeHostFunction } from './poke'
import { ReadHostFunction } from './read'
import { WriteHostFunction } from './write'
import { IConfigService, IServiceAccountService } from '../../pbnj-types-compat'

/**
 * Registry for managing all host functions
 *
 * Similar to the instruction registry, this maintains a mapping of
 * function IDs to their corresponding implementations.
 */
export class HostFunctionRegistry {
  functions: Map<u64, BaseHostFunction> = new Map<u64, BaseHostFunction>()
  configService: IConfigService
  serviceAccountService: IServiceAccountService

  constructor() {
    // Create service instances
    this.configService = new IConfigService()
    this.serviceAccountService = new IServiceAccountService()
    this.registerHostFunctions()
  }

  registerHostFunctions(): void {
    this.register(new GasHostFunction())
    this.register(new FetchHostFunction(this.configService))
    this.register(new HistoricalLookupHostFunction(this.serviceAccountService))
    this.register(new LookupHostFunction())
    this.register(new ReadHostFunction())
    this.register(new WriteHostFunction())
    this.register(new InfoHostFunction())
    this.register(new ExportHostFunction())
    this.register(new MachineHostFunction(this))
    this.register(new PeekHostFunction())
    this.register(new PokeHostFunction())
    this.register(new PagesHostFunction())
    this.register(new InvokeHostFunction())
    this.register(new ExpungeHostFunction())
    this.register(new LogHostFunction())
  }

  register(hostFunction: BaseHostFunction): void {
    this.functions.set(hostFunction.functionId, hostFunction)
  }

  get(functionId: u64): BaseHostFunction | null {
    if (this.functions.has(functionId)) {
      return this.functions.get(functionId)!
    }
    return null
  }
}
