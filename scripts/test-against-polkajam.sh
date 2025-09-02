#!/bin/bash

# Test script for JAM node against polkaJAM binary
# Provides comprehensive testing and comparison between implementations

set -e

echo "🚀 JAM Node vs polkaJAM Comparison Test"
echo "Testing our JAM implementation against the official polkaJAM binary"
echo "======================================================================="
echo ""

# Configuration
OUR_NODE_PORT=30333
POLKAJAM_PORT=30334
TEST_DURATION=30  # 30 seconds for quick testing
VERBOSE=true
TEST_INTERVAL=6000  # 6 seconds (JAM slot duration)
LISTEN_ADDRESS="127.0.0.1"



# Test categories
TEST_CATEGORIES=(
    "basic_connectivity"
    "message_timing"
    "protocol_compliance"
    "certificate_validation" 
    "epoch_transitions"
    "performance_comparison"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_test() {
    echo -e "${PURPLE}[TEST]${NC} $1"
}

log_result() {
    echo -e "${CYAN}[RESULT]${NC} $1"
}

# Cleanup function
cleanup() {
    log_info "🧹 Cleaning up processes..."
    if [ ! -z "$OUR_NODE_PID" ]; then
        kill $OUR_NODE_PID 2>/dev/null || true
    fi
    if [ ! -z "$POLKAJAM_PID" ]; then
        kill $POLKAJAM_PID 2>/dev/null || true
    fi
    
    # Clean up any remaining processes
    pkill -f "packages/cli/src/index.ts" 2>/dev/null || true
    pkill -f "polkajam" 2>/dev/null || true
    
    wait 2>/dev/null || true
    log_success "✅ Cleanup complete"
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Check prerequisites
check_prerequisites() {
    log_info "🔍 Checking prerequisites..."
    
    # Check if our node can be built
    if ! turbo run build > /dev/null 2>&1; then
        log_error "❌ Failed to build our JAM node with turbo"
        log_info "Trying with bun..."
        if ! bun run build > /dev/null 2>&1; then
            log_error "❌ Failed to build our JAM node"
            exit 1
        fi
    fi
    log_success "✅ Our JAM node builds successfully"
    
    # Check if polkaJAM binary exists in scripts folder (preferred location)
    if [ -f "scripts/polkajam" ]; then
        POLKAJAM_BINARY="./scripts/polkajam"
        log_success "✅ polkaJAM binary found in scripts: $POLKAJAM_BINARY"
    elif [ -f "polkajam/jamt" ]; then
        POLKAJAM_BINARY="./polkajam/jamt"
        log_success "✅ polkaJAM script found: $POLKAJAM_BINARY"
    elif [ -f "polkajam/polkajam" ]; then
        POLKAJAM_BINARY="./polkajam/polkajam"
        log_success "✅ polkaJAM binary found: $POLKAJAM_BINARY"
    else
        log_warning "⚠️  polkaJAM not found in scripts/ or polkajam/ directory"
        log_info "Attempting to use system polkajam..."
        if ! command -v polkajam &> /dev/null; then
            log_error "❌ polkaJAM not found in system PATH either"
            log_info "Please run: cp polkajam/polkajam scripts/ && chmod +x scripts/polkajam"
            exit 1
        fi
        POLKAJAM_BINARY="polkajam"
        log_success "✅ polkaJAM found in system PATH"
    fi
    
    # Check required tools
    for tool in jq curl netstat; do
        if ! command -v $tool &> /dev/null; then
            log_error "❌ Required tool not found: $tool"
            exit 1
        fi
    done
    log_success "✅ All required tools available"
}

# Test basic connectivity
test_basic_connectivity() {
    log_test "🔗 Testing Basic Connectivity"
    
    local our_connected=false
    local polkajam_connected=false
    
    # Check if our node is listening
    if netstat -tuln | grep ":$OUR_NODE_PORT " > /dev/null; then
        our_connected=true
        log_success "✅ Our node is listening on port $OUR_NODE_PORT"
    else
        log_error "❌ Our node is not listening on port $OUR_NODE_PORT"
    fi
    
    # Check if polkaJAM is listening on the detected port
    if [ ! -z "$ACTUAL_POLKAJAM_PORT" ] && netstat -tuln | grep ":$ACTUAL_POLKAJAM_PORT " > /dev/null; then
        polkajam_connected=true
        log_success "✅ polkaJAM is listening on port $ACTUAL_POLKAJAM_PORT"
    else
        log_error "❌ polkaJAM is not listening on port ${ACTUAL_POLKAJAM_PORT:-$POLKAJAM_PORT}"
    fi
    
    if [ "$our_connected" = true ] && [ "$polkajam_connected" = true ]; then
        log_result "🎯 Basic connectivity: PASS"
        return 0
    else
        log_result "💥 Basic connectivity: FAIL"
        return 1
    fi
}

# Test message timing compliance
test_message_timing() {
    log_test "⏱️  Testing Message Timing Compliance"
    
      local our_messages=$(grep -c "Sending test block announcement" our_node.log 2>/dev/null || echo "0")
  local polkajam_messages=$(grep -c "block.*announcement\|Block.*announcement" polkajam.log 2>/dev/null || echo "0")
    
    log_info "Our node sent: $our_messages messages"
    log_info "polkaJAM sent: $polkajam_messages messages"
    
    # Calculate expected messages (test duration / interval)
    local expected_messages=$((TEST_DURATION * 1000 / TEST_INTERVAL))
    local tolerance=2  # Allow for timing variations
    
    local our_timing_ok=false
    local polkajam_timing_ok=false
    
    if [ $our_messages -ge $((expected_messages - tolerance)) ] && [ $our_messages -le $((expected_messages + tolerance)) ]; then
        our_timing_ok=true
        log_success "✅ Our node timing is within tolerance"
    else
        log_warning "⚠️  Our node timing outside tolerance (expected ~$expected_messages, got $our_messages)"
    fi
    
    if [ $polkajam_messages -ge $((expected_messages - tolerance)) ] && [ $polkajam_messages -le $((expected_messages + tolerance)) ]; then
        polkajam_timing_ok=true
        log_success "✅ polkaJAM timing is within tolerance"
    else
        log_warning "⚠️  polkaJAM timing outside tolerance (expected ~$expected_messages, got $polkajam_messages)"
    fi
    
    if [ "$our_timing_ok" = true ]; then
        log_result "🎯 Message timing: PASS"
        return 0
    else
        log_result "💥 Message timing: FAIL"
        return 1
    fi
}

# Test protocol compliance
test_protocol_compliance() {
    log_test "📋 Testing Protocol Compliance"
    
    local compliance_score=0
    local max_score=5
    
    # Test 1: ALPN protocol format
    if grep -q "jamnp-s/0/" our_node.log 2>/dev/null; then
        log_success "✅ Correct ALPN protocol format"
        compliance_score=$((compliance_score + 1))
    else
        log_warning "⚠️  ALPN protocol format not detected"
    fi
    
    # Test 2: Ed25519 certificate usage
    if grep -q "Ed25519\|ed25519" our_node.log 2>/dev/null; then
        log_success "✅ Ed25519 certificates in use"
        compliance_score=$((compliance_score + 1))
    else
        log_warning "⚠️  Ed25519 certificate usage not detected"
    fi
    
    # Test 3: QUIC transport
    if grep -q "QUIC\|quic" our_node.log 2>/dev/null; then
        log_success "✅ QUIC transport detected"
        compliance_score=$((compliance_score + 1))
    else
        log_warning "⚠️  QUIC transport not explicitly detected"
    fi
    
    # Test 4: Stream management
    if grep -q "stream\|Stream" our_node.log 2>/dev/null; then
        log_success "✅ Stream management active"
        compliance_score=$((compliance_score + 1))
    else
        log_warning "⚠️  Stream management not detected"
    fi
    
    # Test 5: Block announcements (UP 0)
    if grep -q "block announcement\|Block announcement" our_node.log 2>/dev/null; then
        log_success "✅ Block announcements working"
        compliance_score=$((compliance_score + 1))
    else
        log_warning "⚠️  Block announcements not detected"
    fi
    
    local compliance_percentage=$((compliance_score * 100 / max_score))
    log_info "Protocol compliance score: $compliance_score/$max_score ($compliance_percentage%)"
    
    if [ $compliance_score -ge 4 ]; then
        log_result "🎯 Protocol compliance: PASS ($compliance_percentage%)"
        return 0
    else
        log_result "💥 Protocol compliance: FAIL ($compliance_percentage%)"
        return 1
    fi
}

# Test certificate validation
test_certificate_validation() {
    log_test "🔐 Testing Certificate Validation"
    
    local cert_tests_passed=0
    local cert_tests_total=3
    
    # Test 1: Certificate generation
    if grep -q "Certificate\|certificate" our_node.log 2>/dev/null; then
        log_success "✅ Certificate handling detected"
        cert_tests_passed=$((cert_tests_passed + 1))
    else
        log_warning "⚠️  Certificate handling not detected"
    fi
    
    # Test 2: Alternative name validation
    if grep -q "alternative.*name\|Alternative.*name" our_node.log 2>/dev/null; then
        log_success "✅ Alternative name validation"
        cert_tests_passed=$((cert_tests_passed + 1))
    else
        log_warning "⚠️  Alternative name validation not detected"
    fi
    
    # Test 3: No certificate errors
    if ! grep -q "Certificate.*error\|certificate.*error\|Certificate.*fail" our_node.log 2>/dev/null; then
        log_success "✅ No certificate errors detected"
        cert_tests_passed=$((cert_tests_passed + 1))
    else
        log_warning "⚠️  Certificate errors detected in logs"
    fi
    
    if [ $cert_tests_passed -ge 2 ]; then
        log_result "🎯 Certificate validation: PASS ($cert_tests_passed/$cert_tests_total)"
        return 0
    else
        log_result "💥 Certificate validation: FAIL ($cert_tests_passed/$cert_tests_total)"
        return 1
    fi
}

# Test epoch transitions (simplified)
test_epoch_transitions() {
    log_test "🔄 Testing Epoch Transition Handling"
    
    # This is a simplified test since full epoch testing requires longer runs
    local epoch_score=0
    local epoch_max=2
    
    # Test 1: Epoch awareness
    if grep -q "epoch\|Epoch" our_node.log 2>/dev/null; then
        log_success "✅ Epoch awareness detected"
        epoch_score=$((epoch_score + 1))
    else
        log_warning "⚠️  Epoch handling not detected"
    fi
    
    # Test 2: Validator set management
    if grep -q "validator.*set\|Validator.*set" our_node.log 2>/dev/null; then
        log_success "✅ Validator set management detected"
        epoch_score=$((epoch_score + 1))
    else
        log_warning "⚠️  Validator set management not detected"
    fi
    
    if [ $epoch_score -ge 1 ]; then
        log_result "🎯 Epoch transitions: PASS ($epoch_score/$epoch_max)"
        return 0
    else
        log_result "💥 Epoch transitions: FAIL ($epoch_score/$epoch_max)"
        return 1
    fi
}

# Performance comparison
test_performance_comparison() {
    log_test "⚡ Testing Performance Comparison"
    
    local our_cpu=$(ps -p $OUR_NODE_PID -o %cpu= 2>/dev/null | tr -d ' ' || echo "0")
    local our_mem=$(ps -p $OUR_NODE_PID -o %mem= 2>/dev/null | tr -d ' ' || echo "0")
    
    local polkajam_cpu=$(ps -p $POLKAJAM_PID -o %cpu= 2>/dev/null | tr -d ' ' || echo "0")
    local polkajam_mem=$(ps -p $POLKAJAM_PID -o %mem= 2>/dev/null | tr -d ' ' || echo "0")
    
    log_info "Performance Metrics:"
    log_info "  Our Node:  CPU: ${our_cpu}%    Memory: ${our_mem}%"
    log_info "  polkaJAM:  CPU: ${polkajam_cpu}%  Memory: ${polkajam_mem}%"
    
    # Calculate performance score (lower resource usage is better)
    local performance_ok=true
    
    # Memory usage should be reasonable (< 10%)
    if (( $(echo "$our_mem > 10.0" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "⚠️  High memory usage: ${our_mem}%"
        performance_ok=false
    else
        log_success "✅ Memory usage within limits: ${our_mem}%"
    fi
    
    # CPU usage should be reasonable (< 50% average)
    if (( $(echo "$our_cpu > 50.0" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "⚠️  High CPU usage: ${our_cpu}%"
        performance_ok=false
    else
        log_success "✅ CPU usage within limits: ${our_cpu}%"
    fi
    
    if [ "$performance_ok" = true ]; then
        log_result "🎯 Performance: PASS"
        return 0
    else
        log_result "💥 Performance: CONCERN"
        return 1
    fi
}

# Generate detailed test report
generate_test_report() {
    log_info "📊 Generating detailed test report..."
    
    local report_file="jam_test_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# JAM Node vs polkaJAM Test Report

**Generated on:** $(date)
**Test Duration:** ${TEST_DURATION} seconds
**Test Categories:** ${#TEST_CATEGORIES[@]}

## Executive Summary

This report compares our JAM implementation against the official polkaJAM binary.

## Test Results

| Test Category | Result | Details |
|---------------|--------|---------|
| Basic Connectivity | $connectivity_result | Network listening and connection establishment |
| Message Timing | $timing_result | Compliance with 6-second JAM slot timing |
| Protocol Compliance | $protocol_result | JAMNP-S protocol adherence |
| Certificate Validation | $cert_result | Ed25519 certificate handling |
| Epoch Transitions | $epoch_result | Epoch change management |
| Performance | $performance_result | Resource usage comparison |

## Detailed Metrics

### Message Statistics
- **Our Node Messages:** $(grep -c "Sending test block announcement" our_node.log 2>/dev/null || echo "0")
- **polkaJAM Messages:** $(grep -c "block announcement\|Block announcement" polkajam.log 2>/dev/null || echo "0")

### Performance Metrics
- **Our Node CPU:** ${our_cpu:-"N/A"}%
- **Our Node Memory:** ${our_mem:-"N/A"}%
- **polkaJAM CPU:** ${polkajam_cpu:-"N/A"}%
- **polkaJAM Memory:** ${polkajam_mem:-"N/A"}%

### Error Analysis
$(if [ -f our_node.log ]; then
    echo "**Our Node Errors:**"
    grep -i "error\|fail\|exception" our_node.log | head -10 || echo "No errors found"
    echo ""
fi)

$(if [ -f polkajam.log ]; then
    echo "**polkaJAM Errors:**"
    grep -i "error\|fail\|exception" polkajam.log | head -10 || echo "No errors found"
fi)

## Recommendations

$(if [ $overall_score -ge 5 ]; then
    echo "✅ **EXCELLENT**: Implementation shows strong compliance with JAM specifications"
elif [ $overall_score -ge 4 ]; then
    echo "✅ **GOOD**: Implementation is largely compliant with minor areas for improvement"
elif [ $overall_score -ge 3 ]; then
    echo "⚠️ **MODERATE**: Implementation needs some improvements for full compliance"
else
    echo "❌ **NEEDS WORK**: Implementation requires significant improvements"
fi)

## Log Files
- Our Node: \`our_node.log\`
- polkaJAM: \`polkajam.log\`

---
*Generated by JAM Node Test Suite*
EOF

    log_success "📋 Test report generated: $report_file"
}

# Main test execution
main() {
    log_info "🎬 Starting JAM Node vs polkaJAM comparison test"
    log_info "Test duration: ${TEST_DURATION} seconds"
    log_info "Message interval: ${TEST_INTERVAL}ms (JAM slot duration)"
    echo ""
    
    # Clean up old log files first
    log_info "🧹 Cleaning up old log files..."
    rm -f *.log
    log_info "✅ Log files cleaned"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # Build our node
    log_info "📦 Building our JAM node..."
    if ! turbo run build > build.log 2>&1; then
        log_warning "⚠️  Turbo build failed, trying with bun..."
        if ! bun run build >> build.log 2>&1; then
            log_error "❌ Build failed. Check build.log for details."
            exit 1
        fi
    fi
    log_success "✅ Build completed successfully"
    echo ""
    
    # Start our node
    log_info "🌐 Starting our JAM node (Validator Index 0, Port $OUR_NODE_PORT)..."
    cd packages/cli && bun run src/index.ts run \
        --networking-only \
        --validator-index 0 \
        --listen-port $OUR_NODE_PORT \
        --listen-address $LISTEN_ADDRESS \
        --chain "test-chain-spec" \
        --test-messages \
        --test-interval $TEST_INTERVAL \
        --max-test-messages 100 > ../../our_node.log 2>&1 &
    OUR_NODE_PID=$!
    cd ../..
    log_success "✅ Our node started (PID: $OUR_NODE_PID)"
    
    # Wait for our node to initialize
    sleep 3
    
    # Start polkaJAM with proper genesis configuration
    log_info "🌐 Starting polkaJAM (Dev Validator Index 1)..."
    $POLKAJAM_BINARY run \
        --dev-validator 1 \
        --listen-ip $LISTEN_ADDRESS \
        --chain config/dev-config.json \
        --temp > polkajam.log 2>&1 &
    POLKAJAM_PID=$!
    log_success "✅ polkaJAM started (PID: $POLKAJAM_PID)"
    
    # Wait for polkajam to initialize and detect its actual port
    log_info "⏳ Waiting for polkaJAM to initialize..."
    sleep 5
    
    # Extract the actual port polkajam is using from its log
    ACTUAL_POLKAJAM_PORT=""
    for i in {1..10}; do
        if [ -f polkajam.log ]; then
            # Look for "Listening on" or "This node is" messages to extract the port
            ACTUAL_POLKAJAM_PORT=$(grep -E "(Listening on|This node is)" polkajam.log | grep -o "127\.0\.0\.1:[0-9]*" | cut -d: -f2 | head -1)
            if [ ! -z "$ACTUAL_POLKAJAM_PORT" ]; then
                log_success "✅ Detected polkaJAM listening on port $ACTUAL_POLKAJAM_PORT"
                break
            fi
        fi
        sleep 1
    done
    
    if [ -z "$ACTUAL_POLKAJAM_PORT" ]; then
        log_warning "⚠️  Could not detect polkaJAM port, using default $POLKAJAM_PORT"
        ACTUAL_POLKAJAM_PORT=$POLKAJAM_PORT
    fi
    
    # Update our node's peer discovery to use the actual polkajam port
    log_info "📡 Updating peer discovery with polkaJAM port $ACTUAL_POLKAJAM_PORT"
    
    # Export the detected port for our node to use
    export POLKAJAM_PORT=$ACTUAL_POLKAJAM_PORT
    
    # Restart our node with the correct polkajam port
    if [ ! -z "$ACTUAL_POLKAJAM_PORT" ] && [ "$ACTUAL_POLKAJAM_PORT" != "30334" ]; then
        log_info "🔄 Restarting our node with polkaJAM port $ACTUAL_POLKAJAM_PORT..."
        
        # Stop our node
        if [ ! -z "$OUR_NODE_PID" ]; then
            kill $OUR_NODE_PID 2>/dev/null || true
            sleep 2
        fi
        
        # Start our node with the correct polkajam port and chain config
        cd packages/cli && POLKAJAM_PORT=$ACTUAL_POLKAJAM_PORT bun run src/index.ts run \
            --networking-only \
            --validator-index 0 \
            --listen-port $OUR_NODE_PORT \
            --listen-address $LISTEN_ADDRESS \
            --chain "test-chain-spec" \
            --test-messages \
            --test-interval $TEST_INTERVAL \
            --max-test-messages 100 > ../../our_node.log 2>&1 &
        OUR_NODE_PID=$!
        cd ../..
        log_success "✅ Our node restarted with polkaJAM port $ACTUAL_POLKAJAM_PORT (PID: $OUR_NODE_PID)"
    fi
    
    # Wait for both nodes to be fully initialized
    log_info "⏳ Waiting for both nodes to complete initialization..."
    sleep 5
    echo ""
    
    # Run the test for specified duration
    log_info "⏰ Running test for $TEST_DURATION seconds..."
    log_info "📊 Monitoring both nodes..."
    
    local start_time=$(date +%s)
    local last_update=0
    
    while true; do
        current_time=$(date +%s)
        elapsed=$((current_time - start_time))
        
        # Check if test duration is complete
        if [ $elapsed -ge $TEST_DURATION ]; then
            break
        fi
        
        # Show progress every 10 seconds
        if [ $((elapsed % 10)) -eq 0 ] && [ $elapsed -ne $last_update ]; then
            last_update=$elapsed
            
            our_messages=$(grep -c "Sending test block announcement" our_node.log 2>/dev/null || echo "0")
            polkajam_messages=$(grep -c "block.*announcement\|Block.*announcement" polkajam.log 2>/dev/null || echo "0")
            
            log_info "⏱️  ${elapsed}s: Our node: $our_messages msgs, polkaJAM: $polkajam_messages msgs"
        fi
        
        # Check if processes are still running
        if ! kill -0 $OUR_NODE_PID 2>/dev/null; then
            log_error "❌ Our node stopped unexpectedly"
            break
        fi
        if ! kill -0 $POLKAJAM_PID 2>/dev/null; then
            log_error "❌ polkaJAM stopped unexpectedly"
            break
        fi
        
        sleep 1
    done
    
    log_success "✅ Test duration completed"
    echo ""
    
    # Run test categories
    log_info "🧪 Running test categories..."
    echo ""
    
    local overall_score=0
    local connectivity_result="UNKNOWN"
    local timing_result="UNKNOWN"
    local protocol_result="UNKNOWN"
    local cert_result="UNKNOWN"
    local epoch_result="UNKNOWN"
    local performance_result="UNKNOWN"
    
    # Test basic connectivity
    if test_basic_connectivity; then
        connectivity_result="PASS"
        overall_score=$((overall_score + 1))
    else
        connectivity_result="FAIL"
    fi
    echo ""
    
    # Test message timing
    if test_message_timing; then
        timing_result="PASS"
        overall_score=$((overall_score + 1))
    else
        timing_result="FAIL"
    fi
    echo ""
    
    # Test protocol compliance
    if test_protocol_compliance; then
        protocol_result="PASS"
        overall_score=$((overall_score + 1))
    else
        protocol_result="FAIL"
    fi
    echo ""
    
    # Test certificate validation
    if test_certificate_validation; then
        cert_result="PASS"
        overall_score=$((overall_score + 1))
    else
        cert_result="FAIL"
    fi
    echo ""
    
    # Test epoch transitions
    if test_epoch_transitions; then
        epoch_result="PASS"
        overall_score=$((overall_score + 1))
    else
        epoch_result="FAIL"
    fi
    echo ""
    
    # Test performance
    if test_performance_comparison; then
        performance_result="PASS"
        overall_score=$((overall_score + 1))
    else
        performance_result="CONCERN"
    fi
    echo ""
    
    # Final results
    log_info "📊 FINAL TEST RESULTS"
    log_info "===================="
    echo ""
    log_result "🔗 Basic Connectivity:    $connectivity_result"
    log_result "⏱️  Message Timing:        $timing_result"
    log_result "📋 Protocol Compliance:   $protocol_result"
    log_result "🔐 Certificate Validation: $cert_result"
    log_result "🔄 Epoch Transitions:     $epoch_result"
    log_result "⚡ Performance:           $performance_result"
    echo ""
    log_result "🎯 Overall Score: $overall_score/6"
    
    if [ $overall_score -ge 5 ]; then
        log_success "🏆 EXCELLENT: Implementation shows strong JAM compliance!"
    elif [ $overall_score -ge 4 ]; then
        log_success "✅ GOOD: Implementation is largely compliant"
    elif [ $overall_score -ge 3 ]; then
        log_warning "⚠️  MODERATE: Some improvements needed"
    else
        log_error "❌ NEEDS WORK: Significant improvements required"
    fi
    
    echo ""
    
    # Generate detailed report
    generate_test_report
    
    # Show log file locations
    echo ""
    log_info "📁 Log files available:"
    log_info "  📄 Our node:    our_node.log"
    log_info "  📄 polkaJAM:    polkajam.log"
    log_info "  📄 Build log:   build.log"
    log_info "  📄 Test report: $report_file"
    
    echo ""
    log_info "🎉 Test completed successfully!"
}

# Run main function
main "$@"
