# @pbnj/cli

PeanutButterAndJam CLI for managing the application.

## Installation

```bash
bun install @pbnj/cli
```

## Usage

```bash
pbnj [command]
```

### Global Flags

- `-c, --config <path>`: Path to the config file
- `-l, --log-level <level>`: Log level (trace, debug, info, warn, error) (default: debug)
- `-t, --temp`: Use a temporary data directory, removed on exit. Conflicts with data-path
- `-v, --verbose`: Enable verbose logging
- `-h, --help`: Displays help information about the commands and flags
- `--version`: Prints the version of the program

### Available Commands

#### gen-keys

Generate keys for validators, pls generate keys for all validators before running the node:

```bash
pbnj gen-keys [options]
```

#### gen-spec

Generate new chain spec from the spec config:

```bash
pbnj gen-spec [options]
```

#### list-keys

List keys for validators:

```bash
pbnj list-keys [options]
```

#### print-spec

Generate new chain spec from the spec config:

```bash
pbnj print-spec [options]
```

#### run

Run the PeanutButterAndJam node:

```bash
pbnj run [options]
```

#### test-stf

Run the STF Validation:

```bash
pbnj test-stf [options]
```

#### help

Get help for any command:

```bash
pbnj help [command]
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build the package
bun run build

# Run tests
bun run test
``` 