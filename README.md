# PeanutButterAndJAM Monorepo

A TypeScript implementation of the JAM (Just Another Machine) protocol as specified in the [Gray Paper](https://github.com/gavofyork/graypaper).

## Specification Compliance

This project strictly adheres to the [JAM Gray Paper](https://graypaper.com/) specification:

- **Gray Paper**: `submodules/graypaper/` submodule - The authoritative JAM protocol specification
- **Test Vectors**: `submodules/jamtestvectors/` submodule - Official test vectors for validation
- **Bandersnatch VRF**: `submodules/ark-vrf/` and `submodules/bandersnatch-vrf-spec/` - VRF implementation and specification
- **Implementation Guide**: [JAM Implementation Guide](.cursor/rules/jam-implementation-guide.mdc)
- **Adherence Rules**: [Gray Paper Adherence Rules](.cursor/rules/graypaper-adherence.mdc)
- **VRF Implementation**: [Bandersnatch VRF Implementation Guide](.cursor/rules/bandersnatch-vrf-implementation.mdc)

## Releases

See [RELEASE.md](./RELEASE.md) for detailed release instructions and CLI binary downloads.

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for development setup and guidelines.

## Testing

See [TESTING.md](./TESTING.md) for testing against JAM test vectors.

## Packages

- `@pbnj/core` - Core types and utilities
- `@pbnj/cli` - Command-line interface
- `@pbnj/safrole` - Safrole consensus protocol implementation
- `@pbnj/bandersnatch-vrf` - Bandersnatch VRF implementation
- `@pbnj/pvm` - Polkadot Virtual Machine
- `@pbnj/rpc-server` - RPC server implementation
