# Running the Node

```
bun run ./infra/node/services/main-service.ts --validator-index 0 --telemetry 127.0.0.1:9000 --chain config/spec-tiny.json
```

## Running Polkajam
```
# if not there already
cd submodules/polkajam

./polkajam --chain=dev-spec.json run --telemetry tart-backend:9000 --dev-validator 1 --temp --rpc-port 19801
```