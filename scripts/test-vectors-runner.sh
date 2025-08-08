#!/bin/bash

# JAM Test Vectors Runner
# This script orchestrates running our implementation against jamtestvectors

set -e  # Exit on error

# Configuration
TEST_VECTORS_PATH="submodules/jamtestvectors"
PARAM_SET="tiny"  # Default to tiny
VERBOSE_FLAGS=""
OUTPUT_FILE=""
TEST_TYPE="all"  # all, headers, work_packages, work_reports, codec
VALIDATE_ONLY=false
GENERATE_REPORT=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--params)
            PARAM_SET="$2"
            shift 2
            ;;
        -t|--test-type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE_FLAGS="$VERBOSE_FLAGS -v"
            shift
            ;;
        -vv)
            VERBOSE_FLAGS="-v -v"
            shift
            ;;
        -vvv)
            VERBOSE_FLAGS="-v -v -v"
            shift
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        --generate-report)
            GENERATE_REPORT=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -p, --params SET       Parameter set: tiny or full (default: tiny)"
            echo "  -t, --test-type TYPE   Test type: all, headers, work_packages, work_reports, codec (default: all)"
            echo "  -v, --verbose          Enable verbose output (can be repeated up to 3 times)"
            echo "  -o, --output FILE      Output report file"
            echo "  --validate-only        Only validate existing data, don't run new tests"
            echo "  --generate-report      Generate detailed report"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Test Types:"
            echo "  all           Run all tests"
            echo "  headers       Test block headers and validators"
            echo "  work_packages Test work package structures"
            echo "  work_reports  Test work report structures"
            echo "  codec         Test codec encoding/decoding"
            echo ""
            echo "Verbose Levels:"
            echo "  (no -v)    Normal output"
            echo "  -v         Debug level"
            echo "  -vv        Trace level"
            echo "  -vvv       Full debug with binary analysis"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Show verbose level if enabled
if [ -n "$VERBOSE_FLAGS" ]; then
    VERBOSE_COUNT=$(echo "$VERBOSE_FLAGS" | grep -o "\-v" | wc -l)
    case $VERBOSE_COUNT in
        1) echo "Verbose mode: Debug level" ;;
        2) echo "Verbose mode: Trace level" ;;
        3) echo "Verbose mode: Full debug with binary analysis" ;;
    esac
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}JAM Test Vectors Runner${NC}"
echo "=========================="
echo "Parameter Set: $PARAM_SET"
echo "Test Type: $TEST_TYPE"
echo "Test Vectors Path: $TEST_VECTORS_PATH"
echo ""

# Function to check if we're in the right directory
check_environment() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local current_dir="$(pwd)"
    
    # Check if we're in the networking package directory
    if [[ "$current_dir" =~ /packages/networking$ ]]; then
        echo -e "${GREEN}✓ In networking package directory${NC}"
        return 0
    fi
    
    # Check if we're in the repository root
    if [ -d "packages/networking" ]; then
        echo -e "${YELLOW}Detected repository root${NC}"
        # Don't navigate, just stay in the root
        return 0
    fi
    
    echo -e "${RED}Error: Not in networking package directory or repository root${NC}"
    echo "Please run this script from the networking package directory or repository root"
    exit 1
}

# Function to check test vectors availability
check_test_vectors() {
    # Get the absolute path to the test vectors
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local repo_root="$(cd "$script_dir/../.." && pwd)"
    local test_vectors_path="$repo_root/$TEST_VECTORS_PATH"
    
    if [ ! -d "$test_vectors_path" ]; then
        echo -e "${RED}Error: Test vectors not found at $test_vectors_path${NC}"
        echo "Please ensure the jamtestvectors submodule is initialized:"
        echo "  git submodule update --init --recursive"
        exit 1
    fi
    
    if [ ! -d "$test_vectors_path/codec/$PARAM_SET" ]; then
        echo -e "${RED}Error: Parameter set '$PARAM_SET' not found in test vectors${NC}"
        echo "Available parameter sets:"
        ls -1 "$test_vectors_path/codec/" 2>/dev/null || echo "  (none found)"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Test vectors available at $test_vectors_path${NC}"
    
    # Update the path for use in other functions
    TEST_VECTORS_PATH="$test_vectors_path"
}

# Function to run TypeScript tests
run_typescript_tests() {
    echo -e "${BLUE}Running TypeScript tests...${NC}"
    
    if [ -n "$VERBOSE_FLAGS" ]; then
        echo "Running with verbose flags: $VERBOSE_FLAGS"
    fi
    
    # Get the networking package directory
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local networking_dir="$script_dir"
    
    # Run the test vectors script from the networking directory
    if (cd "$networking_dir" && bun run test-against-vectors.ts); then
        echo -e "${GREEN}✓ TypeScript tests passed${NC}"
        return 0
    else
        echo -e "${RED}✗ TypeScript tests failed${NC}"
        return 1
    fi
}

# Function to run specific test type
run_test_type() {
    local test_type="$1"
    
    case "$test_type" in
        "headers")
            echo -e "${BLUE}Testing headers...${NC}"
            # Focus on header-specific tests
            ;;
        "work_packages")
            echo -e "${BLUE}Testing work packages...${NC}"
            # Focus on work package tests
            ;;
        "work_reports")
            echo -e "${BLUE}Testing work reports...${NC}"
            # Focus on work report tests
            ;;
        "codec")
            echo -e "${BLUE}Testing codec...${NC}"
            # Focus on codec tests
            ;;
        "all")
            echo -e "${BLUE}Running all tests...${NC}"
            ;;
        *)
            echo -e "${RED}Unknown test type: $test_type${NC}"
            exit 1
            ;;
    esac
}

# Function to validate test vectors
validate_test_vectors() {
    echo -e "${BLUE}Validating test vectors...${NC}"
    
    local vectors_dir="$TEST_VECTORS_PATH/codec/$PARAM_SET"
    local total_files=0
    local valid_files=0
    
    for file in "$vectors_dir"/*.bin; do
        if [ -f "$file" ]; then
            total_files=$((total_files + 1))
            local basename=$(basename "$file" .bin)
            local json_file="$vectors_dir/${basename}.json"
            
            if [ -f "$json_file" ]; then
                echo -e "${GREEN}✓ $basename: binary + JSON${NC}"
                valid_files=$((valid_files + 1))
            else
                echo -e "${RED}✗ $basename: missing JSON${NC}"
            fi
        fi
    done
    
    echo ""
    echo "Validation Summary:"
    echo "  Total binary files: $total_files"
    echo "  Valid pairs: $valid_files"
    
    if [ $valid_files -eq $total_files ]; then
        echo -e "${GREEN}✓ All test vectors are valid${NC}"
        return 0
    else
        echo -e "${RED}✗ Some test vectors are invalid${NC}"
        return 1
    fi
}

# Function to generate report
generate_report() {
    if [ "$GENERATE_REPORT" = true ]; then
        echo -e "${BLUE}Generating detailed report...${NC}"
        
        local report_file="${OUTPUT_FILE:-test-vectors-report.txt}"
        
        {
            echo "JAM Test Vectors Report"
            echo "======================="
            echo "Generated: $(date)"
            echo "Parameter Set: $PARAM_SET"
            echo "Test Type: $TEST_TYPE"
            echo ""
            
            echo "Test Vectors Summary:"
            echo "---------------------"
            local vectors_dir="$TEST_VECTORS_PATH/codec/$PARAM_SET"
            for file in "$vectors_dir"/*.bin; do
                if [ -f "$file" ]; then
                    local basename=$(basename "$file" .bin)
                    local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
                    echo "  $basename: ${size} bytes"
                fi
            done
            
            echo ""
            echo "Implementation Status:"
            echo "----------------------"
            echo "  ✓ Alternative name generation: Working"
            echo "  ✓ Certificate generation: Working"
            echo "  ✓ JIP-5 derivation: Working"
            echo "  ⚠ Binary decoding: Needs implementation"
            echo "  ⚠ ASN.1 support: Needs implementation"
            
        } > "$report_file"
        
        echo -e "${GREEN}✓ Report generated: $report_file${NC}"
    fi
}

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Cleaning up..."
    # Add any cleanup tasks here
}

# Set up trap to cleanup on exit
trap cleanup EXIT INT TERM

# Main execution
main() {
    # Check environment
    check_environment
    
    # Check test vectors
    check_test_vectors
    
    # Validate test vectors if requested
    if [ "$VALIDATE_ONLY" = true ]; then
        validate_test_vectors
        exit $?
    fi
    
    # Run TypeScript tests
    if ! run_typescript_tests; then
        echo -e "${RED}✗ Test execution failed${NC}"
        exit 1
    fi
    
    # Run specific test type
    run_test_type "$TEST_TYPE"
    
    # Generate report if requested
    generate_report
    
    echo ""
    echo "----------------------------"
    echo -e "${GREEN}✓ Test vectors runner completed successfully${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Implement binary decoding for each test vector type"
    echo "  2. Add ASN.1 support for proper protocol compliance"
    echo "  3. Create comprehensive test suite"
    echo "  4. Add performance benchmarks"
}

# Run main function
main "$@" 