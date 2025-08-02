import { logger } from '@pbnj/core'
import type {
  CommandOptions,
  GenKeysOptions,
  GenSpecOptions,
  ListKeysOptions,
  PrintSpecOptions,
  RunOptions,
  TestStfOptions,
} from './parser'

export interface ICommand {
  execute(options: CommandOptions): Promise<void>
}

export class GenKeysCommand implements ICommand {
  async execute(options: GenKeysOptions): Promise<void> {
    // Empty implementation
    logger.info('gen-keys command called with options:', options)
  }
}

export class GenSpecCommand implements ICommand {
  async execute(options: GenSpecOptions): Promise<void> {
    // Empty implementation
    logger.info('gen-spec command called with options:', options)
  }
}

export class ListKeysCommand implements ICommand {
  async execute(options: ListKeysOptions): Promise<void> {
    // Empty implementation
    logger.info('list-keys command called with options:', options)
  }
}

export class PrintSpecCommand implements ICommand {
  async execute(options: PrintSpecOptions): Promise<void> {
    // Empty implementation
    logger.info('print-spec command called with options:', options)
  }
}

export class RunCommand implements ICommand {
  async execute(options: RunOptions): Promise<void> {
    // Empty implementation
    logger.info('run command called with options:', options)
  }
}

export class TestStfCommand implements ICommand {
  async execute(options: TestStfOptions): Promise<void> {
    // Empty implementation
    logger.info('test-stf command called with options:', options)
  }
}

export class CommandHandler {
  private commands: Map<string, ICommand> = new Map()

  constructor() {
    this.commands.set('gen-keys', new GenKeysCommand())
    this.commands.set('gen-spec', new GenSpecCommand())
    this.commands.set('list-keys', new ListKeysCommand())
    this.commands.set('print-spec', new PrintSpecCommand())
    this.commands.set('run', new RunCommand())
    this.commands.set('test-stf', new TestStfCommand())
  }

  async execute(command: string, options: CommandOptions): Promise<void> {
    const commandHandler = this.commands.get(command)
    if (!commandHandler) {
      throw new Error(`Unknown command: ${command}`)
    }

    await commandHandler.execute(options)
  }
}
