# How to Create a Chain-Spec Using Polkajam for Tiny Mode

This guide shows how to generate a JIP-4 compliant chain-spec using `polkajam` for tiny mode configuration.

## Prerequisites

- Polkajam binary available at `submodules/polkajam/polkajam`
- The binary should be executable

## Step 1: Create a Config File

Create a YAML configuration file for tiny mode. Based on the [tiny mode specification](https://github.com/gavofyork/jam-docs/blob/main/docs/knowledge/chain-spec/tiny.md), create a file `tiny-config.yaml`:

```yaml
chain: tiny
num_validators: 6
num_cores: 2
preimage_expunge_period: 32
slot_duration: 6
epoch_duration: 12
contest_duration: 10
tickets_per_validator: 3
max_tickets_per_extrinsic: 3
rotation_period: 4
num_ec_pieces_per_segment: 1026
max_block_gas: 20000000
max_refine_gas: 1000000000
```

## Step 2: Generate the Chain-Spec

**Important**: `polkajam gen-spec` expects a **JSON config file** (not YAML). The config must include `genesis_validators` with the following fields for each validator:
- `peer_id`: 53-character DNS name (e.g., "eecgwpgwq3noky4ijm4jmvjtmuzv44qvigciusxakq5epnrfj2utb")
- `bandersnatch`: Hex string of the Bandersnatch public key
- `net_addr`: Network address in format "ip:port" (e.g., "127.0.0.1:40000")
- `validator_index`: Validator index number
- `stake`: Stake amount as a string

Run the `polkajam gen-spec` command:

```bash
cd submodules/polkajam
./polkajam gen-spec tiny-config.json chainspec-tiny.json
```

This will generate a JIP-4 compliant chain-spec file (`chainspec-tiny.json`) with:
- `id`: Chain identifier
- `bootnodes`: **Empty array `[]`** (polkajam does not automatically generate bootnodes)
- `genesis_header`: JAM-serialized genesis block header (hex string)
- `genesis_state`: Binary state trie with 62-character hex keys (31 bytes) and hex values
- `protocol_parameters`: JAM-serialized protocol parameters (hex string)

## Step 2.5: Add Bootnodes (Required)

**Note**: `polkajam gen-spec` does not automatically generate bootnodes from `genesis_validators`. You need to manually add them to the generated chainspec.

You can generate bootnodes from your config file using a script:

```bash
# Generate bootnodes from genesis_validators and add to chainspec
cat chainspec-tiny.json | jq --argfile config tiny-config.json \
  '.bootnodes = [$config.genesis_validators[] | "\(.peer_id)@\(.net_addr)"]' \
  > chainspec-tiny-with-bootnodes.json
mv chainspec-tiny-with-bootnodes.json chainspec-tiny.json
```

Or manually edit the chainspec to add bootnodes in the format `"peer_id@ip:port"`:

```json
{
  "id": "tiny",
  "bootnodes": [
    "eecgwpgwq3noky4ijm4jmvjtmuzv44qvigciusxakq5epnrfj2utb@127.0.0.1:40000",
    "en5ejs5b2tybkfh4ym5vpfh7nynby73xhtfzmazumtvcijpcsz6ma@127.0.0.1:40001"
  ],
  ...
}
```

## Step 3: Use the Generated Chain-Spec

The generated `chainspec-tiny.json` can be used with your JAM node:

```bash
# Using with PBNJ main service
bun run infra/node/services/main-service.ts \
  --chain chainspec-tiny.json \
  --genesis chainspec-tiny.json
```

## Tiny Mode Parameters

Tiny mode is designed for testing and development with minimal resource requirements:

- **6 validators** (vs 1023 in full mode)
- **2 cores** (vs more in full mode)
- **12 epoch duration** (vs 600 in full mode)
- **3 tickets per validator** (vs 16 in full mode)
- **Lower gas limits** for faster testing

## Example: Complete Workflow

```bash
# 1. Create config file
cat > tiny-config.yaml << 'EOF'
chain: tiny
num_validators: 6
num_cores: 2
preimage_expunge_period: 32
slot_duration: 6
epoch_duration: 12
contest_duration: 10
tickets_per_validator: 3
max_tickets_per_extrinsic: 3
rotation_period: 4
num_ec_pieces_per_segment: 1026
max_block_gas: 20000000
max_refine_gas: 1000000000
EOF

# 2. Generate chain-spec
cd submodules/polkajam
./polkajam gen-spec tiny-config.yaml ../../config/chainspec-tiny.json

# 3. Verify the generated file
cat ../../config/chainspec-tiny.json | jq '.id, .genesis_header, (.genesis_state | keys | length)'
```

## Notes

- The generated chain-spec follows the [JIP-4 format](https://github.com/polkadot-fellows/JIPs/blob/main/JIP-4.md)
- The `genesis_state` will be in binary state trie format (62-char hex keys)
- The `genesis_header` will be JAM-serialized (not just a hash)
- You may need to add `bootnodes` manually if you want to specify initial peer connections

