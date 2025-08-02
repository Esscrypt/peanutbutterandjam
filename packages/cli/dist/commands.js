import { GenKeysCommand, GenSpecCommand, ListKeysCommand, PrintSpecCommand, RunCommand, TestStfCommand, TestSafroleCommand, TestAllCommand, } from './commands';
export class CommandHandler {
    commands = new Map();
    constructor() {
        this.commands.set('gen-keys', new GenKeysCommand());
        this.commands.set('gen-spec', new GenSpecCommand());
        this.commands.set('list-keys', new ListKeysCommand());
        this.commands.set('print-spec', new PrintSpecCommand());
        this.commands.set('run', new RunCommand());
        this.commands.set('test-stf', new TestStfCommand());
        this.commands.set('test-safrole', new TestSafroleCommand());
        this.commands.set('test-all', new TestAllCommand());
    }
    async execute(command, options) {
        const commandHandler = this.commands.get(command);
        if (!commandHandler) {
            throw new Error(`Unknown command: ${command}`);
        }
        await commandHandler.execute(options);
    }
}
//# sourceMappingURL=commands.js.map