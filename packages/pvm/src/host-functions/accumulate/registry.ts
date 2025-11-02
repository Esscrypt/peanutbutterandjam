import type { IConfigService } from '@pbnj/types'
import { AssignHostFunction } from './assign'
import type { BaseAccumulateHostFunction } from './base'
import { BlessHostFunction } from './bless'
import { CheckpointHostFunction } from './checkpoint'
import { DesignateHostFunction } from './designate'
import { EjectHostFunction } from './eject'
import { ForgetHostFunction } from './forget'
import { NewHostFunction } from './new'
import { ProvideHostFunction } from './provide'
import { QueryHostFunction } from './query'
import { SolicitHostFunction } from './solicit'
import { TransferHostFunction } from './transfer'
import { UpgradeHostFunction } from './upgrade'
import { YieldHostFunction } from './yield'

/**
 * Registry for managing all accumulation host functions
 *
 * Similar to the general host function registry, this maintains a mapping of
 * function IDs to their corresponding implementations for accumulation operations.
 */
export class AccumulateHostFunctionRegistry {
  private readonly handlers: Map<bigint, BaseAccumulateHostFunction> = new Map()

  constructor(configService: IConfigService) {
    this.registerAccumulateHostFunctions(configService)
  }

  private registerAccumulateHostFunctions(configService: IConfigService): void {
    this.register(new AssignHostFunction(configService))
    this.register(new BlessHostFunction(configService))
    this.register(new CheckpointHostFunction())
    this.register(new DesignateHostFunction(configService))
    this.register(new EjectHostFunction())
    this.register(new ForgetHostFunction())
    this.register(new NewHostFunction())
    this.register(new ProvideHostFunction())
    this.register(new QueryHostFunction())
    this.register(new SolicitHostFunction())
    this.register(new TransferHostFunction())
    this.register(new UpgradeHostFunction())
    this.register(new YieldHostFunction())
  }

  register(hostFunction: BaseAccumulateHostFunction): void {
    this.handlers.set(hostFunction.functionId, hostFunction)
  }

  get(functionId: bigint): BaseAccumulateHostFunction | undefined {
    return this.handlers.get(functionId)
  }
}
