# PeanutButterAndJAM Monorepo

A TypeScript implementation of the JAM (Just Another Machine) protocol as specified in the [Gray Paper](https://github.com/gavofyork/graypaper).

## Specification Compliance

This project strictly adheres to the [JAM Gray Paper](https://graypaper.com/) specification:

- **Gray Paper**: `graypaper/` submodule - The authoritative JAM protocol specification
- **Test Vectors**: `jamtestvectors/` submodule - Official test vectors for validation
- **Implementation Guide**: [JAM Implementation Guide](.cursor/rules/jam-implementation-guide.mdc)
- **Adherence Rules**: [Gray Paper Adherence Rules](.cursor/rules/graypaper-adherence.mdc)

## Releases

### CLI Releases

For CLI releases, see [RELEASE.md](./RELEASE.md) for detailed instructions.

## Getting Started

https://bun.sh/docs/installation

### Install

`bun install`

### Start Extractor-Api

```sh
bun turbo run start --filter extractor-api
```

### Start Router-Api

```sh
bun turbo run start --filter router-api
```

### Dev

`bun turbo run dev --filter=evm`

#### Vercel APIs

These need to be run from their own folder at the moment in development.

`bun vercel dev`

### Build

`pnpm run build`

#### Single Repository

`bun turbo run build --filter=api/app/package/protocol`

### Test

`pnpm run test`

#### Single Repository

`bun turbo run test --filter=api/app/package/protocol`

### Clean

`pnpm run clean`

#### Single Repository

`bun turbo run clean --filter=api/app/package/protocol`

## APIs

...

### Creating a new API

`git checkout -b feature/example-api`

## Apps

...

### Creating a new app

`git checkout -b feature/example-app`


## Config

...

### Creating a new config

`git checkout -b feature/example-config`

## Packages

...

### Creating a new package

`git checkout -b feature/example-package`

## Protocols

...

### Creating a new protocol

`git checkout -b feature/example-protocol`
