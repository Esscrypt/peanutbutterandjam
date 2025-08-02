import type { GlobalOptions } from './types';
export interface GenKeysOptions extends GlobalOptions {
}
export interface GenSpecOptions extends GlobalOptions {
}
export interface ListKeysOptions extends GlobalOptions {
}
export interface PrintSpecOptions extends GlobalOptions {
}
export interface RunOptions extends GlobalOptions {
}
export interface TestStfOptions extends GlobalOptions {
}
export interface TestSafroleOptions extends GlobalOptions {
    vectors?: string;
    vector?: string;
}
export interface TestAllOptions extends GlobalOptions {
    vectors?: string;
}
export type CommandOptions = GenKeysOptions | GenSpecOptions | ListKeysOptions | PrintSpecOptions | RunOptions | TestStfOptions | TestSafroleOptions | TestAllOptions;
export interface CommanderOptions {
    config?: string;
    logLevel?: string;
    temp?: boolean;
    verbose?: boolean;
    [key: string]: unknown;
}
export declare function parseArguments(options: CommanderOptions): CommandOptions;
//# sourceMappingURL=parser.d.ts.map