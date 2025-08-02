export function parseArguments(options) {
    // Convert commander options to our typed options
    const parsed = {
        config: options.config,
        logLevel: options.logLevel,
        temp: options.temp,
        verbose: options.verbose,
    };
    return parsed;
}
//# sourceMappingURL=parser.js.map