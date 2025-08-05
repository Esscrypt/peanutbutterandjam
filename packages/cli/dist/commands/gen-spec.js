import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { logger, z } from '@pbnj/core';
import { Command } from 'commander';
import { generateChainSpec } from '../utils/chain-spec';
export function createGenSpecCommand() {
    const command = new Command('gen-spec')
        .description('Generate new chain spec from the spec config')
        .argument('<input.json>', 'Input chain spec file')
        .argument('<output.json>', 'Output chain spec file')
        .action(async (inputFile, outputFile) => {
        try {
            if (!existsSync(inputFile)) {
                logger.error(`Input file not found: ${inputFile}`);
                process.exit(1);
            }
            const inputSpec = JSON.parse(readFileSync(inputFile, 'utf-8'));
            const chainSpec = generateChainSpec(inputSpec);
            writeFileSync(outputFile, JSON.stringify(chainSpec, null, 2));
            logger.info(`Successfully generated chain spec: ${outputFile}`);
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                logger.error('Configuration validation failed:');
                error.errors.forEach((err) => {
                    logger.error(`  ${err.path.join('.')}: ${err.message}`);
                });
            }
            else if (error instanceof SyntaxError) {
                logger.error('Invalid JSON in input file');
            }
            else {
                logger.error('Failed to generate spec:', error instanceof Error ? error.message : String(error));
                if (error instanceof Error && error.stack) {
                    logger.error('Stack trace:', error.stack);
                }
            }
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=gen-spec.js.map