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
# COPY apis ./apis

RUN bun install --ignore-scripts
# Copy remaining source code
COPY . .

# Build the application
# Note: Some packages may not have build scripts, so we continue on failure
# but we verify that workspace packages are properly linked
RUN bun run build:main

FROM gcr.io/distroless/base-debian11
WORKDIR /app

COPY --from=build /app/bin/main-service /app/bin/main-service
# ENTRYPOINT sets the base command, CMD provides default arguments
ENTRYPOINT ["/app/bin/main-service"]

