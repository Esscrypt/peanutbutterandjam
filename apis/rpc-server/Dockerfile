FROM oven/bun:1.3.5 as build

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json bun.lock ./
COPY turbo.json ./

# Copy all package.json files for workspace dependencies
COPY config ./config
COPY packages ./packages
COPY infra ./infra
COPY apis ./apis

# Install dependencies
RUN bun install --ignore-scripts

# Build the RPC server binary
RUN bun run build:bin

FROM gcr.io/distroless/base-debian11
WORKDIR /app

# Copy the built binary
COPY --from=build /app/apis/rpc-server/bin /app/bin

# Copy chain spec if it exists (optional)
# COPY --from=build /app/chain-spec.json /app/chain-spec.json

CMD [ "/app/bin" ]
