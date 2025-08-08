# PBNJ Multi-Node Test Setup

This setup allows you to run multiple PBNJ nodes with full observability using OpenTelemetry, Prometheus, and Grafana.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PBNJ Nodes    │    │ OpenTelemetry    │    │   Prometheus    │
│   (4 instances) │───▶│   Collector      │───▶│                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │     Grafana     │    │   Metrics &     │
                       │   Dashboard     │    │   Traces        │
                       └─────────────────┘    └─────────────────┘
```

## Prerequisites

- Docker and Docker Compose
- Bun (for building the CLI)
- Node.js 18+

## Quick Start

1. **Clone and setup the repository:**
   ```bash
   git clone <repository-url>
   cd peanutbutterandjam
   bun install
   ```

2. **Run the multi-node setup:**
   ```bash
   ./start-nodes.sh
   ```

3. **Access the monitoring dashboards:**
   - Grafana: http://localhost:3000 (admin/admin)
   - Prometheus: http://localhost:9090
   - OpenTelemetry Collector: http://localhost:4318

## Configuration

### Environment Variables

You can customize the setup using environment variables:

```bash
export NODE_COUNT=4              # Number of nodes to run
export LOG_LEVEL=info            # Log level for nodes
export BASE_P2P_PORT=40000       # Base P2P port
export BASE_RPC_PORT=19800       # Base RPC port
```

### Node Configuration

Each node is configured with:
- Unique node ID (node-1, node-2, etc.)
- OpenTelemetry integration
- P2P and RPC ports
- Persistent data storage

## Monitoring

### Metrics Collected

The setup collects the following metrics from each node:

- **Block Creation Time**: Histogram of block creation times
- **Block Validation Time**: Histogram of block validation times
- **Block Submission Time**: Histogram of block submission times
- **Memory Usage**: Current memory usage in bytes
- **CPU Usage**: Current CPU usage percentage
- **Extrinsics Processed**: Total number of extrinsics processed
- **Work Packages Processed**: Total number of work packages processed
- **Blocks Created**: Total number of blocks created
- **Blocks Submitted**: Total number of blocks submitted
- **Blocks Failed**: Total number of blocks that failed

### Traces

OpenTelemetry traces are collected for:
- Block creation operations
- Block submission operations
- Network communication
- Performance bottlenecks

### Dashboards

The Grafana dashboard includes:
- Real-time metrics from all nodes
- Performance comparisons
- Resource usage monitoring
- Block creation and submission rates

## Testing Node Communication

### Manual Testing

1. **Check node logs:**
   ```bash
   docker-compose logs pbnj-node-1
   docker-compose logs pbnj-node-2
   ```

2. **Test RPC endpoints:**
   ```bash
   curl http://localhost:19801/health
   curl http://localhost:19802/health
   ```

3. **Monitor network traffic:**
   ```bash
   docker-compose exec pbnj-node-1 netstat -an | grep 40000
   ```

### Automated Testing

Create test scripts to verify:
- Node discovery and peer connections
- Block propagation between nodes
- Consensus mechanism operation
- Network resilience

## Troubleshooting

### Common Issues

1. **Port conflicts:**
   - Check if ports 40001-40004 and 19801-19804 are available
   - Modify `docker-compose.yml` to use different ports

2. **Node startup failures:**
   - Check Docker logs: `docker-compose logs <service-name>`
   - Verify OpenTelemetry Collector is running
   - Check network connectivity between services

3. **Metrics not appearing:**
   - Verify OpenTelemetry Collector configuration
   - Check Prometheus targets at http://localhost:9090/targets
   - Ensure nodes are sending metrics to the collector

### Debug Commands

```bash
# Check service status
docker-compose ps

# View logs for all services
docker-compose logs

# Restart a specific service
docker-compose restart pbnj-node-1

# Access a node container
docker-compose exec pbnj-node-1 sh

# Check network connectivity
docker-compose exec pbnj-node-1 ping pbnj-node-2
```

## Scaling

To add more nodes:

1. **Update docker-compose.yml:**
   Add more `pbnj-node-X` services with unique ports

2. **Update Prometheus configuration:**
   Add new node targets to `config/prometheus.yml`

3. **Regenerate chain spec:**
   Update the chain spec to include new validators

4. **Restart services:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## Cleanup

To stop and clean up all services:

```bash
docker-compose down -v
```

This will remove all containers, networks, and volumes.

## Development

### Adding New Metrics

1. **Update MetricsCollector:**
   Add new metrics to `infra/node/src/metrics-collector.ts`

2. **Update Grafana Dashboard:**
   Add new panels to `config/grafana/dashboards/pbnj-dashboard.json`

3. **Test locally:**
   ```bash
   cd packages/cli
   bun run test
   ```

### Customizing Dashboards

The Grafana dashboard can be customized by:
- Adding new panels
- Modifying queries
- Changing visualization types
- Adding alerts

## Support

For issues and questions:
- Check the logs: `docker-compose logs`
- Review the configuration files
- Test individual components
- Check the OpenTelemetry documentation 