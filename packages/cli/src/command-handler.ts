import {
  GenKeysCommand,
  GenSpecCommand,
  ListKeysCommand,
  PrintSpecCommand,
  RunCommand,
  TestAllCommand,
  TestSafroleCommand,
  TestStfCommand,
} from './commands'
import type { CommandOptions } from './parser'
import type { ICommand } from './types'

export class CommandHandler {
  private commands: Map<string, ICommand> = new Map()

  constructor() {
    this.commands.set('gen-keys', new GenKeysCommand())
    this.commands.set('gen-spec', new GenSpecCommand())
    this.commands.set('list-keys', new ListKeysCommand())
    this.commands.set('print-spec', new PrintSpecCommand())
    this.commands.set('run', new RunCommand())
    this.commands.set('test-stf', new TestStfCommand())
    this.commands.set('test-safrole', new TestSafroleCommand())
    this.commands.set('test-all', new TestAllCommand())
  }

  async execute(command: string, options: CommandOptions): Promise<void> {
    const commandHandler = this.commands.get(command)
    if (!commandHandler) {
      throw new Error(`Unknown command: ${command}`)
    }

    await commandHandler.execute(options)
  }
}
