# JAMTART Telemetry Backend

JAMTART is a telemetry backend service for JAM (Join-Accumulate Machine) protocol nodes. It provides a centralized service for collecting, storing, and querying telemetry data from JAM nodes.

## Overview

JAMTART provides:
- **HTTP API** at `http://localhost:8080` for querying telemetry data
- **TCP Telemetry Endpoint** at `tcp://localhost:9000` for receiving telemetry events from nodes
- **PostgreSQL Database** for persistent storage of telemetry data
- **WebSocket Support** for real-time event streaming

## Setup

### 1. Initialize Submodule

First, ensure the jamtart submodule is initialized:

```bash
git submodule update --init --recursive submodules/jamtart
```

### 2. Start Services

Use the provided script to start the services:

```bash
# Start in background (detached mode)
./scripts/start-jamtart.sh -d

# Start and follow logs
./scripts/start-jamtart.sh -f

# Start in foreground
./scripts/start-jamtart.sh
```

Or manually:

```bash
cd submodules/jamtart
docker-compose up -d
```

### 3. View Logs

```bash
# View logs for tart-backend service
./scripts/jamtart-logs.sh

# Follow logs (real-time)
./scripts/jamtart-logs.sh -f

# View logs for specific service
./scripts/jamtart-logs.sh -s postgres
```

Or manually:

```bash
cd submodules/jamtart
docker-compose logs -f tart-backend
```

### 4. Stop Services

```bash
./scripts/stop-jamtart.sh
```

Or manually:

```bash
cd submodules/jamtart
docker-compose down
```

## Configuration

### Environment Variables

The docker-compose setup uses the following default configuration:

- **Database**: PostgreSQL running on port `5432`
- **API Port**: `8080`
- **Telemetry Port**: `9000`

To customize, edit `submodules/jamtart/docker-compose.yml` or set environment variables.

### Database Connection

The backend connects to PostgreSQL using:
- **Host**: `postgres` (Docker service name)
- **Database**: `tart_telemetry`
- **User**: `tart`
- **Password**: `tart_password`

## Usage

### Connecting JAM Nodes

Configure your JAM nodes to send telemetry to:

```
tcp://localhost:9000
```

### API Endpoints

Once running, the API is available at `http://localhost:8080`:

- **Health Check**: `GET /api/health`
- **Metrics**: `GET /metrics` (Prometheus format)
- **Events**: `GET /api/events` (query events)
- **WebSocket**: `WS /api/events/stream` (real-time events)

### Example API Calls

```bash
# Health check
curl http://localhost:8080/api/health

# Get metrics
curl http://localhost:8080/metrics

# Query events (example)
curl http://localhost:8080/api/events?node_id=abc123&limit=100
```

## Architecture

JAMTART consists of:

1. **TCP Telemetry Server** (port 9000)
   - Receives telemetry events from JAM nodes
   - Implements JIP-3 telemetry protocol
   - Rate limiting and connection management

2. **HTTP API Server** (port 8080)
   - REST API for querying telemetry data
   - WebSocket support for real-time streaming
   - Prometheus metrics endpoint

3. **PostgreSQL Database**
   - Persistent storage for all telemetry events
   - Optimized indexes for fast queries
   - Batch writing for high throughput

## Performance

JAMTART is designed to handle:
- **Up to 1024 concurrent node connections**
- **100,000+ events per second** (with 1024 nodes)
- **Sub-50ms p99 write latency** (batch writes)
- **Memory usage**: < 5GB for 1024 nodes

## Troubleshooting

### Services Won't Start

Check if ports are already in use:

```bash
# Check port 8080
lsof -i :8080

# Check port 9000
lsof -i :9000

# Check port 5432 (PostgreSQL)
lsof -i :5432
```

### Database Connection Issues

Verify PostgreSQL is running:

```bash
cd submodules/jamtart
docker-compose ps
```

### View Service Status

```bash
cd submodules/jamtart
docker-compose ps
docker-compose logs tart-backend
```

## References

- **Repository**: https://github.com/paritytech/jamtart
- **JIP-3 Specification**: See `submodules/JIPs/JIP-3.md`
- **Documentation**: See `submodules/jamtart/README.md`

## Scripts

The following helper scripts are available:

- `scripts/start-jamtart.sh` - Start the telemetry backend
- `scripts/stop-jamtart.sh` - Stop the telemetry backend
- `scripts/jamtart-logs.sh` - View logs

For more details, run any script with `-h` or `--help`.


