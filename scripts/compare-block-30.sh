#!/bin/bash
# Compare all invocations for block 30

services=(1978300793 1985398916 1985398958 834711912)
ordered_index=0
timeslot=30

for service_id in "${services[@]}"; do
  echo "=========================================="
  echo "Comparing service $service_id"
  echo "=========================================="
  bun scripts/compare-3way-traces.ts --2way --typescript --fuzzy $timeslot $ordered_index $service_id
  echo ""
done
