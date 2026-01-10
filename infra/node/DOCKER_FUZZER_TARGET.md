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
docker buildx build --platform linux/amd64,linux/arm64 -f infra/node/Dockerfile.fuzzer-target -t shimonchick/pbnjam-fuzzer-target:latest --push .

# Test the image locally
docker run --rm \
  -v /tmp:/tmp \
  pbnjam-fuzzer-target:latest \
  --socket /tmp/jam_target.sock
```

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


# Or build multi-arch (amd64 + arm64) and push

```
# Clear buildx cache first (optional)
docker buildx prune -f

# Build without cache
docker buildx build --platform linux/amd64,linux/arm64 \
  --no-cache \
  --pull \
  -f infra/node/Dockerfile.fuzzer-target \
  -t shimonchick/pbnjam-fuzzer-target:latest \
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

## Exposing Unix Domain Sockets in Docker

The fuzzer target uses Unix domain sockets for communication. To expose sockets from the container to the host (or to other containers), you **must** mount the socket directory as a volume.

### Required Volume Mount

Always use the `-v /tmp:/tmp` flag when running the container:

```bash
docker run --rm \
  -v /tmp:/tmp \
  pbnjam-fuzzer-target:latest \
  --socket /tmp/jam_target.sock --spec tiny
```

**Why this is necessary:**
- Unix domain sockets are filesystem-based and only accessible within the container's filesystem
- The volume mount (`-v /tmp:/tmp`) makes the socket accessible from the host
- Without the volume mount, the socket cannot be accessed from outside the container
- The fuzzer workflow automatically mounts `/tmp:/tmp` when running the container

### Socket Path Considerations

- The socket path inside the container must match the mounted directory
- Use `/tmp` or another directory that's mounted as a volume
- The socket file will appear on the host at the same path (e.g., `/tmp/jam_target.sock`)
- Ensure the socket directory exists and is writable (the Dockerfile ensures `/tmp` exists)

### Base Image Note

The Dockerfile uses `debian:bullseye-slim` (instead of distroless) to ensure proper Unix domain socket support. Distroless images are too minimal and may not support socket operations.

## Testing the Published Image

Test the published image before using it in production:

```bash
# Pull the image (Docker Hub)
docker pull shimonchick/pbnjam-fuzzer-target:latest

# Run a test (note the -v /tmp:/tmp mount is required)
docker run --rm \
  -v /tmp:/tmp \
  pbnjam-fuzzer-target:latest \
  --socket /tmp/jam_target.sock --spec tiny
```

The socket will be created at `/tmp/jam_target.sock` on both the host and in the container.

