# Docker Setup for Fuzzer Target

This guide explains how to build and publish the fuzzer target as a Docker image for use with the jam-conformance fuzzer workflow.

## Prerequisites

- Docker installed and running
- Access to a container registry (Docker Hub, GitHub Container Registry, etc.)
- Git repository with the fuzzer target code

## Building the Docker Image

### Local Build

Build the image locally:

```bash
cd /Users/tanyageorgieva/Repos/peanutbutterandjam

# Build the image
docker build -f infra/node/Dockerfile.fuzzer-target -t pbnjam-fuzzer-target:latest .

# Test the image locally
docker run --rm -v /tmp:/tmp pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket /tmp/jam_test.sock --spec tiny
```

### Build for Specific Registry

```bash
# For Docker Hub
docker build -f infra/node/Dockerfile.fuzzer-target \
  -t shimonchick/pbnjam-fuzzer-target:latest \
  -t shimonchick/pbnjam-fuzzer-target:$(git rev-parse --short HEAD) \
  .

# For GitHub Container Registry
docker build -f infra/node/Dockerfile.fuzzer-target \
  -t ghcr.io/shimonchick/pbnjam-fuzzer-target:latest \
  -t ghcr.io/shimonchick/pbnjam-fuzzer-target:$(git rev-parse --short HEAD) \
  .
```

## Publishing the Image

### GitHub Container Registry (ghcr.io)

1. **Authenticate with GitHub Container Registry**:
   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
   ```
   Or use a Personal Access Token with `write:packages` permission.

2. **Tag the image**:
   ```bash
   docker tag pbnjam-fuzzer-target:latest \
     ghcr.io/shimonchick/pbnjam-fuzzer-target:latest
   ```

3. **Push the image**:
   ```bash
   docker push ghcr.io/shimonchick/pbnjam-fuzzer-target:latest
   ```

4. **Make the package public** (optional):
   - Go to your GitHub repository
   - Navigate to Packages
   - Select the package
   - Go to Package settings → Change visibility → Make public

### Docker Hub (Recommended for Personal Use)

Docker Hub allows publishing under your personal username - **no organization needed!**

1. **Create a Docker Hub account** (if you don't have one):
   - Go to https://hub.docker.com
   - Sign up for a free account

2. **Authenticate**:
   ```bash
   docker login
   # Enter your Docker Hub username and password
   ```

3. **Tag and push**:
   ```bash
   # Tag with your username (no organization required)
   docker tag pbnjam-fuzzer-target:latest shimonchick/pbnjam-fuzzer-target:latest
   
   # Push to Docker Hub
   docker push shimonchick/pbnjam-fuzzer-target:latest
   ```

4. **Make it public** (optional, for easier access):
   - Go to https://hub.docker.com/r/shimonchick/pbnjam-fuzzer-target
   - Click "Settings" → "Make Public"

## Updating targets.json

After publishing, update `submodules/jam-conformance/scripts/targets.json`:

**For Docker Hub (username-based):**
```json
{
  "pbnjam": {
    "image": "shimonchick/pbnjam-fuzzer-target:latest",
    "cmd": "--socket {TARGET_SOCK}",
    "gp_version": "0.7.2"
  }
}
```

**For GitHub Container Registry:**
```json
{
  "pbnjam": {
    "image": "ghcr.io/shimonchick/pbnjam-fuzzer-target:latest",
    "cmd": " -- socket {TARGET_SOCK}",
    "gp_version": "0.7.2"
  }
}
```

**Docker Hub personal accounts work perfectly - no organization needed!**

## Using with Fuzzer Workflow

Once published, the target can be used with the fuzzer workflow:

```bash
cd submodules/jam-conformance/scripts

# The target will be automatically pulled when running
python3 fuzz-workflow.py -t pbnjam
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/docker-fuzzer-target.yml`:

```yaml
name: Build and Publish Fuzzer Target Docker Image

on:
  push:
    branches: [main]
    paths:
      - 'infra/node/fuzzer-target.ts'
      - 'infra/node/Dockerfile.fuzzer-target'
      - 'package.json'
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/pbnjam-fuzzer-target

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./infra/node/Dockerfile.fuzzer-target
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache,mode=max
```

## Versioning Strategy

- **latest**: Always points to the most recent build from main branch
- **semver tags**: Use semantic versioning (e.g., `v0.7.2`, `v0.7`)
- **commit SHA**: Tag with short commit hash for specific versions
- **branch names**: Tag with branch name for development builds

## Troubleshooting

### Image too large

The image includes all dependencies. To reduce size:

1. Use multi-stage builds to separate build and runtime
2. Use `bun install --production` for runtime
3. Remove dev dependencies and build tools

### Permission issues

Ensure the socket path is writable:
```dockerfile
RUN mkdir -p /tmp && chmod 1777 /tmp
```

### Network issues in container

The fuzzer target communicates via Unix domain sockets, which are mounted by the `target.py` script. No network configuration is needed.

## Testing the Published Image

Test the published image before using it in production:

```bash
# Pull the image (Docker Hub)
docker pull shimonchick/pbnjam-fuzzer-target:latest

# Run a test
docker run --rm \
  -v /tmp:/tmp \
  shimonchick/pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket /tmp/test.sock --spec tiny
```

