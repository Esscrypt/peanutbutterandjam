# Contributing to Peanut Butter AND JAM (PBNJ)

> **NOTE:** Since we are taking part in the JAM Prize, we do not accept any external PRs unless the contributor waives any claims to the prize and copyright for the submitted code. By creating a PR you accept this requirement.

Thank you for your interest in contributing. This document explains how to get set up, run checks, and submit changes.

## Prerequisites

- **[Bun](https://bun.sh/)** (v1.3.x recommended)
- **Git** (with submodules)
- **Rust** (stable), if you work on or run the Rust PVM or fuzzer

## Development setup

```bash
git clone https://github.com/Esscrypt/peanutbutterandjam.git
cd peanutbutterandjam
git submodule update --init --recursive
bun install
bun run build
```

Optional: copy `.env.example` to `.env` and adjust for local use.

## Before you submit

1. **Code style** — Format and lint with [Biome](https://biomejs.dev/):
   ```bash
   bun run format
   bun run lint
   ```

2. **Types** — Ensure TypeScript checks pass:
   ```bash
   bun check
   ```
   (Some submodules must be initialized; see [.github/workflows/verify.yml](.github/workflows/verify.yml) for the full set.)

3. **Tests** — Run the test suite:
   ```bash
   bun run test
   ```

CI runs the same steps on every pull request. Fix any failures before requesting review.

## Submitting changes

1. **Open an issue** (optional but helpful) — For non-trivial changes, open an issue first to discuss approach or report a bug.

2. **Branch** — Create a branch from the default branch (e.g. `fix/description` or `feat/feature-name`).

3. **Commit** — Use clear, concise commit messages. The repo uses [remark-commit](https://github.com/Esscrypt/peanutbutterandjam/blob/main/.github/workflows/remark-commit.yml) for conventional-commit style; follow that when possible.

4. **Pull request** — Open a PR against the default branch. Describe what changed and why; link any related issues. CI must pass before merge.

## Protocol and spec alignment

- The [Gray Paper](https://graypaper.com/) is the authoritative specification. Implementation choices should align with it.
- In-repo rules and guides live under [.cursor/rules/](.cursor/rules/) (e.g. Gray Paper adherence, JAM implementation guide).
- Test vectors in `submodules/jam-test-vectors` and related repos are used to validate compliance; do not change tests to satisfy implementation unless the spec or vectors are updated upstream.

## Questions

- **Bugs and features**: [GitHub Issues](https://github.com/Esscrypt/peanutbutterandjam/issues)
- **JAM protocol**: [Gray Paper](https://graypaper.com/), [community docs](https://docs.jamcha.in/)
