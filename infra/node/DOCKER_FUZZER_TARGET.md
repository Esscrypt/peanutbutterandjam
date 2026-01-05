# Docker Setup for Fuzzer Target

This guide explains how to build and publish the fuzzer target as a Docker image for use with the jam-conformance fuzzer workflow.

## Prerequisites

- Docker installed and running
- Access to a container registry (Docker Hub, GitHub Container Registry, etc.)
- Git repository with the fuzzer target code

## Building the Docker Image

### Local Build

#### Standard Build (Native Architecture)

Build the image locally for your current architecture:

```bash
# Build the image
docker build -f infra/node/Dockerfile.fuzzer-target -t pbnjam-fuzzer-target:latest .

# Test the image locally
docker run --rm \
  -v /tmp:/tmp \
  pbnjam-fuzzer-target:latest \
  --socket /tmp/jam_target.sock
```

#### Building for AMD64 (x86_64) Architecture

To build specifically for amd64 architecture (required for most CI/CD environments and cloud platforms), use Docker Buildx:

```bash
# Set up Docker Buildx (if not already done)
docker buildx create --use

# Build for amd64 architecture
docker buildx build --platform linux/amd64 \
  -f infra/node/Dockerfile.fuzzer-target \
  -t pbnjam-fuzzer-target:latest \
  --load .

# Test the amd64 image locally
docker run --rm \
  -v /tmp:/tmp \
  pbnjam-fuzzer-target:latest \
  --socket /tmp/jam_target.sock
```

**Note**: The `--load` flag loads the image into your local Docker daemon. If you're building on a different architecture (e.g., Apple Silicon), this will use emulation which may be slower.

#### Building Multi-Architecture Images

To build for both amd64 and arm64:

```bash
# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 \
  -f infra/node/Dockerfile.fuzzer-target \
  -t pbnjam-fuzzer-target:latest \
  --load .
```

**Note**: When building multi-arch images, `--load` only loads the image for your native architecture. To push multi-arch images, use `--push` instead of `--load`.
1. **Tag the image**:
   ```bash
   docker tag pbnjam-fuzzer-target:latest \
     ghcr.io/shimonchick/pbnjam-fuzzer-target:latest
   ```

2. **Push the image**:
   ```bash
   docker push ghcr.io/shimonchick/pbnjam-fuzzer-target:latest
   ```

#### Publishing AMD64 Images to GitHub Container Registry

To build and push an amd64-specific image:

```bash
# Build and push for amd64
docker buildx build --platform linux/amd64 \
  -f infra/node/Dockerfile.fuzzer-target \
  -t ghcr.io/shimonchick/pbnjam-fuzzer-target:latest \
  --push .

# Or build multi-arch (amd64 + arm64) and push
docker buildx build --platform linux/amd64,linux/arm64 \
  -f infra/node/Dockerfile.fuzzer-target \
  -t ghcr.io/shimonchick/pbnjam-fuzzer-target:latest \
  --push .
```

**Note**: You must be authenticated to GitHub Container Registry before pushing:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u shimonchick --password-stdin
```

3. **Make the package public** (optional):
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

#### Publishing AMD64 Images to Docker Hub

To build and push an amd64-specific image to Docker Hub:

```bash
# Build and push for amd64
docker buildx build --platform linux/amd64 \
  -f infra/node/Dockerfile.fuzzer-target \
  -t shimonchick/pbnjam-fuzzer-target:latest \
  --push .

# Or build multi-arch (amd64 + arm64) and push
docker buildx build --platform linux/amd64,linux/arm64 \
  -f infra/node/Dockerfile.fuzzer-target \
  -t shimonchick/pbnjam-fuzzer-target:latest \
  --push .
```

**Note**: The `--push` flag pushes directly to the registry without loading into your local Docker daemon.

## Testing the Published Image

Test the published image before using it in production:

```bash
# Pull the image (Docker Hub)
docker pull shimonchick/pbnjam-fuzzer-target:latest

# Run a test
docker run --rm \
  -v /tmp:/tmp \
  pbnjam-fuzzer-target:latest \
  --socket /tmp/jam_target.sock
```

### Testing AMD64 Images on Non-AMD64 Systems

If you're testing on a different architecture (e.g., Apple Silicon), you can explicitly run the amd64 image:

```bash
# Pull and run amd64 image explicitly
docker pull --platform linux/amd64 shimonchick/pbnjam-fuzzer-target:latest

docker run --rm --platform linux/amd64 \
  -v /tmp:/tmp \
  shimonchick/pbnjam-fuzzer-target:latest \
  --socket /tmp/jam_target.sock
```

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/docker-fuzzer-target.yml`) automatically builds and publishes multi-architecture images (amd64 and arm64) to GitHub Container Registry on pushes to main branches. The workflow:

- Builds for both `linux/amd64` and `linux/arm64` platforms
- Publishes to `ghcr.io/shimonchick/pbnjam-fuzzer-target`
- Tags images with branch names, commit SHAs, and semantic versions
- Uses GitHub Actions cache for faster builds

