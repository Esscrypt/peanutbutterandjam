import { logger } from '@pbnj/core';
import { TestVectorProcessor } from '../test-vectors';
export class TestSafroleCommand {
    async execute(options) {
        logger.info('Testing Safrole consensus protocol...');
        const processor = new TestVectorProcessor();
        try {
            // Validate test vectors first
            await processor.validateTestVectors();
            // Determine which vectors to test
            const vectorType = options.vectors || 'tiny';
            const specificVector = options.vector;
            if (specificVector) {
                // Test specific vector
                const vectors = await processor.loadTestVectors(`stf/safrole/${vectorType}`);
                const targetVector = vectors.find(v => v.name === specificVector);
                if (!targetVector) {
                    throw new Error(`Test vector not found: ${specificVector}`);
                }
                const result = await processor.runSafroleTest(targetVector);
                processor.validateResult(targetVector, result);
            }
            else {
                // Test all vectors of the specified type
                const vectors = await processor.loadTestVectors(`stf/safrole/${vectorType}`);
                logger.info(`Running ${vectors.length} ${vectorType} test vectors...`);
                let passed = 0;
                let failed = 0;
                for (const vector of vectors) {
                    try {
                        const result = await processor.runSafroleTest(vector);
                        const isValid = processor.validateResult(vector, result);
                        if (isValid) {
                            passed++;
                        }
                        else {
                            failed++;
                        }
                    }
                    catch (error) {
                        logger.error(`Error running test vector ${vector.name}:`, error);
                        failed++;
                    }
                }
                logger.info(`Test results: ${passed} passed, ${failed} failed`);
            }
        }
        catch (error) {
            logger.error('Test failed:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=test-safrole.js.map