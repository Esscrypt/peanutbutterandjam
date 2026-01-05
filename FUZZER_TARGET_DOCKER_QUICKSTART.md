# Quick Start: Docker Fuzzer Target

## Build and Publish

### 1. Build Locally

```bash
cd /Users/tanyageorgieva/Repos/peanutbutterandjam
docker build -f infra/node/Dockerfile.fuzzer-target -t pbnjam-fuzzer-target:latest .
```

### 2. Test Locally

```bash
docker run --rm -v /tmp:/tmp pbnjam-fuzzer-target:latest \
  bun run infra/node/fuzzer-target.ts --socket /tmp/jam_test.sock --spec tiny
```

### 3. Tag for Registry

**Option A: Docker Hub (Username-based - No organization needed)**
```bash
docker tag pbnjam-fuzzer-target:latest \
  shimonchick/pbnjam-fuzzer-target:latest
```

**Option B: GitHub Container Registry (Organization or Username)**
```bash
docker tag pbnjam-fuzzer-target:latest \
  ghcr.io/shimonchick/pbnjam-fuzzer-target:latest
```

### 4. Login and Push

**Docker Hub (Recommended for personal use):**
```bash
docker login  # Enter your Docker Hub username and password
docker push shimonchick/pbnjam-fuzzer-target:latest
```

**GitHub Container Registry:**
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u shimonchick --password-stdin
docker push ghcr.io/shimonchick/pbnjam-fuzzer-target:latest
```

### 5. Update targets.json

Update `submodules/jam-conformance/scripts/targets.json`:

**For Docker Hub:**
```json
{
  "pbnjam": {
    "image": "shimonchick/pbnjam-fuzzer-target:latest",
    "cmd": "bun run infra/node/fuzzer-target.ts --socket {TARGET_SOCK} --spec tiny",
    "gp_version": "0.7.2"
  }
}
```

**For GitHub Container Registry:**
```json
{
  "pbnjam": {
    "image": "ghcr.io/shimonchick/pbnjam-fuzzer-target:latest",
    "cmd": "bun run infra/node/fuzzer-target.ts --socket {TARGET_SOCK} --spec tiny",
    "gp_version": "0.7.2"
  }
}
```

### 6. Use with Fuzzer Workflow

**Prerequisites:**
```bash
# Clone the polkajam repository (if not already done)
cd /Users/tanyageorgieva/Repos
git clone https://github.com/paritytech/polkajam.git

# Set the polkajam repository directory
export POLKAJAM_FUZZ_DIR=/Users/tanyageorgieva/Repos/polkajam
```

**Run the fuzzer:**
```bash
cd submodules/jam-conformance/scripts

# Local mode (generate new traces)
python3 fuzz-workflow.py -t pbnjam --skip-get

# Trace mode (replay existing traces)
python3 fuzz-workflow.py -t pbnjam --source trace --skip-get
```

The `--skip-get` flag skips the download step since we're using a Docker image.

**What happens:**
1. Fuzzer workflow reads `targets.json` and finds the `pbnjam` target
2. Docker image is pulled (if not local) or used from local cache
3. Docker container is started with the socket path mounted
4. Fuzzer connects to the target and begins sending messages
5. Results are stored in `sessions/<SESSION_ID>/`

See `RUN_FUZZER.md` for detailed usage instructions.

## CI/CD (GitHub Actions)

The workflow file `.github/workflows/docker-fuzzer-target.yml` is already configured. It will:
- Build on pushes to `main` branch
- Automatically tag with `latest`, branch name, and commit SHA
- Push to GitHub Container Registry

Just ensure `GITHUB_TOKEN` has `packages: write` permission (automatically available in GitHub Actions).

## Registry URLs

- **Docker Hub (Personal)**: `shimonchick/pbnjam-fuzzer-target` 
- **GitHub Container Registry**: `ghcr.io/shimonchick/pbnjam-fuzzer-target`
- **Other registries**: `registry.example.com/path/to/image`

**Note**: Docker Hub allows publishing under your personal username without creating an organization. Just use `shimonchick/image-name` format.

See `infra/node/DOCKER_FUZZER_TARGET.md` for detailed documentation.

