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
# Build the image
docker build -f infra/node/Dockerfile.fuzzer-target -t pbnjam-fuzzer-target:latest .

# Test the image locally
docker run --rm \
  -v /tmp:/tmp \
  pbnjam-fuzzer-target:latest \
  --socket /tmp/jam_target.sock
```
1. **Tag the image**:
   ```bash
   docker tag pbnjam-fuzzer-target:latest \
     ghcr.io/shimonchick/pbnjam-fuzzer-target:latest
   ```

2. **Push the image**:
   ```bash
   docker push ghcr.io/shimonchick/pbnjam-fuzzer-target:latest
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

