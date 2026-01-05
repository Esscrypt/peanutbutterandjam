# GitHub Actions Workflows

This directory contains CI/CD workflows for the repository.

## Documentation Workflows

### Bandersnatch VRF Documentation

The `docs-bandersnatch-vrf.yml` workflow deploys `@pbnjam/bandersnatch-vrf` documentation to GitHub Pages.

**Note**: `@pbnjam/bandersnatch` has its own repository with its own CI/CD workflow. See that repository's `.github/workflows/docs.yml` for its documentation deployment.

### Workflow Details

- **`docs-bandersnatch-vrf.yml`**: Deploys `@pbnjam/bandersnatch-vrf` documentation
- Triggers automatically on push to `main` when package files change (path-based)
- Can be triggered manually via `workflow_dispatch`
- Deploys to its own GitHub Pages environment
- Uses separate concurrency groups to avoid conflicts

## Setup Instructions

### Initial GitHub Pages Setup

1. Go to your repository **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. The workflows will automatically deploy when changes are pushed to `main`

### Configure Environment

Since the package deploys to its own environment, you need to create it:

1. Go to **Settings** → **Environments**
2. Create environment:
   - `github-pages-bandersnatch-vrf`
3. For the environment:
   - Set **Deployment branch** to `main` (or your default branch)
   - Configure any required protection rules
   - The workflow will automatically use this environment

## Workflow Triggers

- **Automatic**: Triggers on push to `main` when `packages/bandersnatch-vrf/**` files change (path-based)
- **Manual**: Can be triggered manually via `workflow_dispatch` in the Actions tab

## Documentation Generation

The package uses [TypeDoc](https://typedoc.org/) to generate API documentation from TypeScript source files:

- `@pbnjam/bandersnatch-vrf`: `bun run docs` in `packages/bandersnatch-vrf/`

The generated documentation is output to the `docs/` directory in the package.

## Submodules

The workflow checks out submodules recursively to ensure all dependencies are available during documentation generation.

