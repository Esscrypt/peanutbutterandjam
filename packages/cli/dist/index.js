#!/usr/bin/env node
import { logger } from '@pbnj/core';
import { Command } from 'commander';
import { createGenKeysCommand } from './commands/gen-keys';
import { createGenSpecCommand } from './commands/gen-spec';
import { createListKeysCommand } from './commands/list-keys';
import { createPrintSpecCommand } from './commands/print-spec';
import { createRunCommand } from './commands/run';
import { createTestRefineCommand } from './commands/test-refine';
import { createTestStfCommand } from './commands/test-stf';
const program = new Command();
program
    .name('pbnj')
    .description('PeanutButterAndJam node')
    .version('0.6.5.5')
    .option('-c, --config <string>', 'Path to the config file')
    .option('-h, --help', 'Displays help information about the commands and flags.')
    .option('-l, --log-level <string>', 'Log level (trace, debug, info, warn, error)', 'debug')
    .option('-t, --temp', 'Use a temporary data directory, removed on exit. Conflicts with data-path');
// Add all commands
program.addCommand(createGenKeysCommand());
program.addCommand(createListKeysCommand());
program.addCommand(createGenSpecCommand());
program.addCommand(createPrintSpecCommand());
program.addCommand(createRunCommand());
program.addCommand(createTestStfCommand());
program.addCommand(createTestRefineCommand());
// Global error handler
program.exitOverride();
try {
    program.parse();
}
catch (err) {
    if (err instanceof Error) {
        logger.error(err.message);
    }
    else {
        logger.error('An unknown error occurred');
    }
    process.exit(1);
}
//# sourceMappingURL=index.js.map