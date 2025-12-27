# Running the Fuzzer with Docker Image

## Prerequisites

1. **Build and push the Docker image** (if not already done):
   ```bash
   cd /Users/tanyageorgieva/Repos/peanutbutterandjam
   docker build -f infra/node/Dockerfile.fuzzer-target -t shimonchick/pbnjam-fuzzer-target:latest .
   docker login
   docker push shimonchick/pbnjam-fuzzer-target:latest
   ```

2. **Clone the polkajam repository** (if not already cloned):
   ```bash
   cd /Users/tanyageorgieva/Repos
   git clone https://github.com/paritytech/polkajam.git
   ```

3. **Set POLKAJAM_FUZZ_DIR environment variable**:
   ```bash
   export POLKAJAM_FUZZ_DIR=/Users/tanyageorgieva/Repos/polkajam
   ```
   This should point to the root of the `polkajam` repository (where the Cargo.toml is).
   The `polkajam-fuzz` crate is inside this repository.

3. **Verify targets.json is configured**:
   The `submodules/jam-conformance/scripts/targets.json` should have:
   ```json
   {
     "pbnjam": {
       "image": "shimonchick/pbnjam-fuzzer-target:latest",
       "cmd": "bun run infra/node/fuzzer-target.ts --socket {TARGET_SOCK} --spec tiny",
       "gp_version": "0.7.2"
     }
   }
   ```

## Running the Docker Container

### Manual Testing

You can test the Docker container manually before using it with the fuzzer:

```bash
# Run the container with a test socket
docker run --rm \
  -v /tmp:/tmp \
  shimonchick/pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket /tmp/jam_test.sock --spec tiny
```

The container will start and listen on the socket. Press `Ctrl+C` to stop it.

See `DOCKER_CONTAINER_USAGE.md` for detailed manual testing instructions.

## Running the Fuzzer

### Basic Usage

```bash
cd submodules/jam-conformance/scripts
python3 fuzz-workflow.py -t pbnjam --skip-get
```

The `--skip-get` flag skips the download step since we're using a Docker image that's already built.

**Note**: The fuzzer workflow automatically manages the Docker container - you don't need to run it manually.

### Local Mode (Generate New Traces)

This runs the fuzzer to generate new traces:

```bash
cd submodules/jam-conformance/scripts
python3 fuzz-workflow.py -t pbnjam --skip-get
```

### Trace Mode (Replay Existing Traces)

This replays existing traces from the conformance repository:

```bash
cd submodules/jam-conformance/scripts
python3 fuzz-workflow.py -t pbnjam --source trace --skip-get
```

### Common Options

```bash
# Run with specific profile
python3 fuzz-workflow.py -t pbnjam --skip-get --profile fuzzy

# Limit number of steps
export JAM_FUZZ_MAX_STEPS=1000
python3 fuzz-workflow.py -t pbnjam --skip-get

# Generate report after fuzzing
python3 fuzz-workflow.py -t pbnjam --skip-get --report-depth 5

# Skip report generation
python3 fuzz-workflow.py -t pbnjam --skip-get --skip-report
```

## How It Works

1. **Fuzzer workflow starts**: `fuzz-workflow.py` reads `targets.json`
2. **Docker image pulled**: If the image isn't local, it's pulled from Docker Hub
3. **Target container started**: The Docker container runs with the socket path mounted
4. **Fuzzer connects**: The fuzzer connects to the target via Unix domain socket
5. **Fuzzing begins**: The fuzzer sends Initialize, ImportBlock, and GetState messages
6. **Results collected**: Traces and reports are generated in the session directory

## Session Directory

Results are stored in:
```
submodules/jam-conformance/sessions/<SESSION_ID>/
├── trace/          # Generated trace files (.bin)
├── report/         # Generated reports (.json)
└── logs/           # Target and fuzzer logs
```

The `SESSION_ID` defaults to a Unix timestamp but can be set via:
```bash
export JAM_FUZZ_SESSION_ID=my-session-123
```

## Troubleshooting

### Image not found
If you get an error about the image not being found:
```bash
# Pull the image manually
docker pull shimonchick/pbnjam-fuzzer-target:latest

# Or build it locally first
docker build -f infra/node/Dockerfile.fuzzer-target -t shimonchick/pbnjam-fuzzer-target:latest .
```

### Socket permission errors
The Docker container needs access to `/tmp` for the socket. The `target.py` script handles this automatically by mounting `/tmp:/tmp`.

### POLKAJAM_FUZZ_DIR not set
```bash
export POLKAJAM_FUZZ_DIR=/path/to/polkajam-fuzz
```

### Check if target is running
The fuzzer workflow automatically manages the Docker container. You can check running containers:
```bash
docker ps | grep pbnjam
```

## Advanced Usage

### Run Multiple Targets

```bash
python3 fuzz-workflow.py -t pbnjam,jamzig --skip-get
```

### Parallel Execution

```bash
python3 fuzz-workflow.py -t pbnjam --parallel --skip-get
```

### Custom Session ID

```bash
export JAM_FUZZ_SESSION_ID=my-custom-session
python3 fuzz-workflow.py -t pbnjam --skip-get
```

### View Logs

After running, check the logs:
```bash
cat submodules/jam-conformance/sessions/<SESSION_ID>/logs/target_pbnjam.log
cat submodules/jam-conformance/sessions/<SESSION_ID>/logs/fuzzer_pbnjam.log
```

