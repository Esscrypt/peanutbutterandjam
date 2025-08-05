import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '@pbnj/core';
import { Command } from 'commander';
import { generateValidatorKeys } from '../utils/key-generation';
export function createGenKeysCommand() {
    const command = new Command('gen-keys')
        .description('Generate keys for validators, pls generate keys for all validators before running the node')
        .action(async () => {
        try {
            const keysDir = join(process.env['HOME'] || '', '.jamduna', 'keys');
            mkdirSync(keysDir, { recursive: true });
            // Generate 6 validator keys (0-5)
            for (let i = 0; i < 6; i++) {
                const keys = generateValidatorKeys(i);
                const seedFile = join(keysDir, `seed_${i}`);
                // Write seed file
                writeFileSync(seedFile, keys.seed);
                logger.info(`Seed file ${seedFile} created`);
            }
            logger.info('Successfully generated keys for all validators');
        }
        catch (error) {
            logger.error('Failed to generate keys:', error);
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=gen-keys.js.map