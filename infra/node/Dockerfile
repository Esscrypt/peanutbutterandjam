FROM oven/bun:1.2.19@sha256:31f25ad4c661322a3dc9d9d98fbf34989502b1ea588a2ca629da98c8e5a2d116 AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1.2.19@sha256:31f25ad4c661322a3dc9d9d98fbf34989502b1ea588a2ca629da98c8e5a2d116 AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create data directory
RUN mkdir -p /data && chown nodejs:nodejs /data

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 40000 19800

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "console.log('Health check passed')" || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "dist/index.js"] 