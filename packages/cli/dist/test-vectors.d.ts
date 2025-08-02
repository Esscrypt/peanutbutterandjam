export interface TestVector {
    name: string;
    state: any;
    input: any;
    output: any;
    description?: string;
}
export declare class TestVectorProcessor {
    private vectorsPath;
    constructor(vectorsPath?: string);
    loadTestVectors(directory: string): Promise<TestVector[]>;
    runSafroleTest(vector: TestVector): Promise<any>;
    private executeSafroleSTF;
    validateResult(vector: TestVector, result: any): boolean;
    validateTestVectors(): Promise<void>;
    convertBinaryToJson(): Promise<void>;
}
//# sourceMappingURL=test-vectors.d.ts.map