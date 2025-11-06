import type { IConfigService, IServiceAccountService } from '@pbnj/types'
import type { BaseHostFunction } from './base'
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
/**
 * Registry for managing all host functions
 *
 * Similar to the instruction registry, this maintains a mapping of
 * function IDs to their corresponding implementations.
 */
export class HostFunctionRegistry {
  private readonly functions = new Map<bigint, BaseHostFunction>()
  constructor(
    serviceAccountService: IServiceAccountService,
    configService: IConfigService,
  ) {
    this.registerHostFunctions(serviceAccountService, configService)
  }

  private registerHostFunctions(
    serviceAccountService: IServiceAccountService,
    configService: IConfigService,
  ): void {
    this.register(new GasHostFunction())
    this.register(new FetchHostFunction(configService))
    this.register(new HistoricalLookupHostFunction(serviceAccountService))
    this.register(new LookupHostFunction(serviceAccountService))
    this.register(new ReadHostFunction())
    this.register(new WriteHostFunction())
    this.register(new InfoHostFunction(serviceAccountService))
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

  get(functionId: bigint): BaseHostFunction | undefined {
    return this.functions.get(functionId)
  }
}
