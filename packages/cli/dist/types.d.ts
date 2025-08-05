import type { Result } from '@pbnj/core';
export interface GlobalOptions {
    config?: string;
    logLevel?: string;
    temp?: boolean;
    verbose?: boolean;
}
export interface ICommand<T extends GlobalOptions = GlobalOptions> {
    execute(options: T): Promise<Result<void>>;
}
//# sourceMappingURL=types.d.ts.map