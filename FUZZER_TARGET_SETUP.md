# Running Fuzzer Workflow Against TypeScript Fuzzer Target

## Prerequisites

1. **Clone the polkajam repository** (if not already cloned):
   ```bash
   cd /Users/tanyageorgieva/Repos
   git clone https://github.com/paritytech/polkajam.git
   ```

2. **Set the `POLKAJAM_FUZZ_DIR` environment variable**:
   ```bash
   export POLKAJAM_FUZZ_DIR=/Users/tanyageorgieva/Repos/polkajam
   ```
   This should point to the root of the `polkajam` repository (where the Cargo.toml is).
   The `polkajam-fuzz` crate is inside this repository.

2. Ensure `bun` is installed and in your PATH.

## Setup

The TypeScript fuzzer target has been added to `targets.json` as `"pbnjam"`. However, since it's a local development target, you need to set it up manually:

### Option 1: Create Wrapper Script (Recommended)

1. Create the targets directory structure:
   ```bash
   mkdir -p submodules/jam-conformance/targets/pbnjam/latest
   ```

2. Create a wrapper script:
   ```bash
   cat > submodules/jam-conformance/targets/pbnjam/latest/fuzzer-target.sh << 'EOF'
   #!/bin/bash
   # Wrapper script for pbnjam fuzzer target
   WORKSPACE_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
   SOCKET_PATH="$1"
   cd "$WORKSPACE_ROOT"
   exec bun run infra/node/fuzzer-target.ts --socket "$SOCKET_PATH" --spec tiny
   EOF
   ```

3. Make it executable:
   ```bash
   chmod +x submodules/jam-conformance/targets/pbnjam/latest/fuzzer-target.sh
   ```

### Option 2: Run Target Manually (For Testing)

If you just want to test the target without the full workflow:

1. In one terminal, start the fuzzer target:
   ```bash
   cd /Users/tanyageorgieva/Repos/peanutbutterandjam
   bun run infra/node/fuzzer-target.ts --socket /tmp/jam_fuzz_$(date +%s).sock --spec tiny
   ```

2. In another terminal, run the fuzzer workflow pointing to that socket:
   ```bash
   export JAM_FUZZ_TARGET_SOCK=/tmp/jam_fuzz_<timestamp>.sock
   cd submodules/jam-conformance/scripts
   python3 fuzz-workflow.py -t pbnjam --skip-get
   ```

## Running the Fuzzer Workflow

Once set up, you can run the fuzzer workflow:

```bash
cd submodules/jam-conformance/scripts

# Run in local mode (generates new traces)
python3 fuzz-workflow.py -t pbnjam --skip-get

# Run in trace mode (replays existing traces)
python3 fuzz-workflow.py -t pbnjam --source trace --skip-get

# List available targets
python3 fuzz-workflow.py --list-targets
```

## Important Notes

1. **Socket Path**: The fuzzer workflow automatically sets `JAM_FUZZ_TARGET_SOCK` to a unique socket path per session. The target script will receive this via the `{TARGET_SOCK}` placeholder.

2. **Skip Get**: Use `--skip-get` since we're using a local development target that doesn't need to be downloaded.

3. **GP Version**: The target is configured for GP version 0.7.2. Make sure your fuzzer matches this version or adjust the `gp_version` in `targets.json`.

4. **Working Directory**: The wrapper script changes to the workspace root before running `bun`, so all relative paths in `fuzzer-target.ts` will work correctly.

## Troubleshooting

- **Target not found**: Make sure the wrapper script exists at `targets/pbnjam/latest/fuzzer-target.sh`
- **Permission denied**: Ensure the wrapper script is executable (`chmod +x`)
- **Socket errors**: Check that the socket path is correct and the target is listening
- **Bun not found**: Ensure `bun` is in your PATH or use the full path in the wrapper script

