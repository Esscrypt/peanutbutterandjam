FROM oven/bun:1.3.5 as build

# Install Rust and build tools for native module compilation
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json bun.lock ./
COPY turbo.json ./

# Copy all package.json files for workspace dependencies
COPY . .

RUN bun install --ignore-scripts

# Build native Reed-Solomon module (needs to be built for the target platform)
RUN cd packages/erasure-coding/rust-reed-solomon && bun run build

# Verify native module was built
RUN ls -la packages/erasure-coding/rust-reed-solomon/native/ || echo "Native build may have failed, but continuing..."

FROM oven/bun:1.3.5-slim
WORKDIR /app

# Set environment variables for logging
ENV ENABLE_LOGGER=true
ENV PINO_LEVEL=debug

# Ensure /tmp exists and is writable for Unix domain sockets
RUN mkdir -p /tmp && chmod 1777 /tmp

# Copy package files and install dependencies
COPY --from=build /app/package.json /app/bun.lock /app/turbo.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/infra ./infra
COPY --from=build /app/config ./config

# Copy WASM file (needed at runtime, not bundled in binary)
COPY --from=build /app/packages/bandersnatch-vrf/wasm-ark-vrf/ark_vrf_wasm_bg.wasm /app/packages/bandersnatch-vrf/wasm-ark-vrf/ark_vrf_wasm_bg.wasm

# Copy SRS file (needed at runtime)
COPY --from=build /app/packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin /app/packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin

# ENTRYPOINT sets the base command, CMD provides default arguments
# Run the script directly with Bun instead of using compiled binary
# This ensures proper Unix socket support and runtime dependencies
ENTRYPOINT ["bun", "run", "infra/node/services/main-service.ts"]
CMD ["--validator-index", "0", "--telemetry", "127.0.0.1:9000", "--chain", "config/spec-tiny.json"]

