# Running the Node

```
bun run ./infra/node/services/main-service.ts --validator-index 0 --telemetry 127.0.0.1:9000 --chain config/spec-tiny.json
```

# Running with RPC server
```
bun run ./apis/rpc-server/src/index.ts --validator-index 0 --telemetry 127.0.0.1:9000 --chain config/spec-tiny.json | bunx pino-pretty
```

## Running Polkajam
```
# if not there already
cd submodules/polkajam

./polkajam --chain dev run --telemetry tart-backend:9000 --dev-validator 0 --temp
```