# Running the Docker Container

## Manual Testing

### Basic Run

```bash
# Run the container with a test socket
docker run --rm \
  -v /tmp:/tmp \
  shimonchick/pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket /tmp/jam_test.sock --spec tiny
```

### With Custom Socket Path

```bash
# Create a custom socket path
SOCKET_PATH="/tmp/my_custom_socket.sock"

# Run the container
docker run --rm \
  -v /tmp:/tmp \
  shimonchick/pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket "$SOCKET_PATH" --spec tiny
```

### Interactive Mode (for debugging)

```bash
# Run interactively to inspect the container
docker run --rm -it \
  -v /tmp:/tmp \
  shimonchick/pbnjam-fuzzer-target:latest \
  /bin/sh

# Then inside the container:
bun run infra/node/fuzzer-target.ts --socket /tmp/jam_test.sock --spec tiny
```

## How the Fuzzer Workflow Runs It

The `target.py` script automatically runs the Docker container with these settings:

```bash
docker run \
  --rm \
  --name pbnjam-<random-suffix> \
  --init \
  --user <your-uid>:<your-gid> \
  --platform linux/amd64 \
  --cpuset-cpus 16-32 \
  --cpu-shares 2048 \
  --memory 8g \
  --memory-swap 8g \
  --shm-size 1g \
  -v /tmp:/tmp \
  shimonchick/pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket {TARGET_SOCK} --spec tiny
```

The `{TARGET_SOCK}` placeholder is replaced with the actual socket path (e.g., `/tmp/jam_fuzz_1234567890.sock`).

## Key Parameters

- **`--socket <path>`**: Unix domain socket path for fuzzer communication
- **`--spec tiny`**: Chain specification (tiny or full)
- **`-v /tmp:/tmp`**: Mounts `/tmp` so the socket can be shared between host and container
- **`--rm`**: Automatically removes the container when it exits
- **`--init`**: Uses tini/dumb-init as PID 1 for proper signal handling

## Testing the Container Manually

### 1. Start the Container

```bash
# In one terminal, start the container
docker run --rm \
  -v /tmp:/tmp \
  shimonchick/pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket /tmp/jam_test.sock --spec tiny
```

You should see:
```
Starting fuzzer target...
Socket path: /tmp/jam_test.sock
Spec: tiny
Initializing services...
✅ Fuzzer target listening on /tmp/jam_test.sock
Ready to accept connections (press Ctrl+C to stop)
```

### 2. Test Connection (Optional)

You can test the socket connection from another terminal:

```bash
# Check if socket exists
ls -l /tmp/jam_test.sock

# The socket should be created and listening
```

### 3. Stop the Container

Press `Ctrl+C` in the terminal running the container, or:

```bash
# Find the container
docker ps | grep pbnjam

# Stop it
docker stop <container-id>
```

## Using with Fuzzer Workflow

The fuzzer workflow (`fuzz-workflow.py`) automatically manages the Docker container:

```bash
cd submodules/jam-conformance/scripts
export POLKAJAM_FUZZ_DIR=/Users/tanyageorgieva/Repos/polkajam
python3 fuzz-workflow.py -t pbnjam --skip-get
```

The workflow will:
1. Pull the image if not local
2. Start the container with the correct socket path
3. Connect the fuzzer to the container
4. Clean up when done

## Troubleshooting

### Container exits immediately

Check logs:
```bash
docker logs <container-id>
```

Or run without `--rm` to inspect:
```bash
docker run --name pbnjam-test \
  -v /tmp:/tmp \
  shimonchick/pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket /tmp/jam_test.sock --spec tiny

# Check logs
docker logs pbnjam-test

# Clean up
docker rm pbnjam-test
```

### Socket permission errors

The container runs as user `nodejs` (UID 1001). Ensure the socket directory is writable:
```bash
# The -v /tmp:/tmp mount should handle this, but if issues persist:
docker run --rm \
  -v /tmp:/tmp \
  --user $(id -u):$(id -g) \
  shimonchick/pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket /tmp/jam_test.sock --spec tiny
```

### Image not found

```bash
# Pull from Docker Hub
docker pull shimonchick/pbnjam-fuzzer-target:latest

# Or build locally
docker build -f infra/node/Dockerfile.fuzzer-target -t shimonchick/pbnjam-fuzzer-target:latest .
```


