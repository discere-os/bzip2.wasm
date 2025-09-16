#!/bin/bash
# build-dual.sh - Dual build system for bzip2.wasm (SIDE_MODULE + MAIN_MODULE)
#
# Copyright (C) 1996-2010 Julian Seward <jseward@acm.org>
# Copyright 2025 Superstruct Ltd, New Zealand
#
# This source code is licensed under the same terms as the original bzip2 project

set -euo pipefail

# Configuration
BUILD_TYPE="${BUILD_TYPE:-Release}"
INSTALL_PREFIX="${INSTALL_PREFIX:-./install}"
BUILD_DIR="${BUILD_DIR:-./build-dual}"
VARIANT="${1:-all}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Build bzip2.wasm as SIDE_MODULE for dynamic loading
build_bzip2_side_module() {
    log_info "Building bzip2.wasm as SIDE_MODULE for production dynamic loading..."

    mkdir -p "${BUILD_DIR}-side"
    cd "${BUILD_DIR}-side"

    # Core bzip2 sources + SIMD compression
    BZIP2_SOURCES="../blocksort.c ../huffman.c ../crctable.c ../randtable.c ../compress.c ../decompress.c ../bzlib.c"
    SIMD_SOURCES="../src/blocksort_simd.c ../src/huffman_simd.c ../src/wasm_simd_optimized.c"

    # SIDE_MODULE optimized build with SIMD acceleration
    emcc ${BZIP2_SOURCES} ${SIMD_SOURCES} ../src/wasm_module.c \
        -I.. \
        -DHAVE_UNISTD_H=0 \
        -O3 \
        -flto \
        -msimd128 \
        -sSIDE_MODULE=1 \
        -sSTANDALONE_WASM=1 \
        -o bzip2-side.wasm

    log_success "SIDE_MODULE build completed: $(pwd)/bzip2-side.wasm"
    cd ..
}

# Build bzip2.wasm as MAIN_MODULE for testing
build_bzip2_main_module() {
    log_info "Building bzip2.wasm as MAIN_MODULE for testing..."

    mkdir -p "${BUILD_DIR}-main-release"
    cd "${BUILD_DIR}-main-release"

    # Core bzip2 sources + SIMD compression
    BZIP2_SOURCES="../blocksort.c ../huffman.c ../crctable.c ../randtable.c ../compress.c ../decompress.c ../bzlib.c"
    SIMD_SOURCES="../src/blocksort_simd.c ../src/huffman_simd.c ../src/wasm_simd_optimized.c"

    # MAIN_MODULE build with full optimizations + SIMD (DEFAULT)
    emcc ${BZIP2_SOURCES} ${SIMD_SOURCES} ../src/wasm_module.c \
        -I.. \
        -DHAVE_UNISTD_H=0 \
        -O3 \
        -flto \
        -msimd128 \
        -sWASM=1 \
        -sMODULARIZE=1 \
        -sEXPORT_ES6=1 \
        -sEXPORT_NAME="Bzip2Module" \
        -sEXPORTED_FUNCTIONS='["_bzip2_compress_buffer","_bzip2_decompress_buffer","_bzip2_get_version","_bzip2_compress_bound","_bzip2_error_string","_malloc","_free"]' \
        -sEXPORTED_RUNTIME_METHODS='["cwrap","ccall","UTF8ToString","getValue","setValue","HEAPU8","HEAP8","HEAP32"]' \
        -sALLOW_MEMORY_GROWTH=1 \
        -sASSERTIONS=1 \
        -sNO_EXIT_RUNTIME=1 \
        -o bzip2-release.js

    # Also build fallback version for compatibility (less optimized, no SIMD)
    emcc ${BZIP2_SOURCES} ../src/wasm_module.c \
        -I.. \
        -DHAVE_UNISTD_H=0 \
        -O2 \
        -sWASM=1 \
        -sMODULARIZE=1 \
        -sEXPORT_ES6=1 \
        -sEXPORT_NAME="Bzip2Module" \
        -sEXPORTED_FUNCTIONS='["_bzip2_compress_buffer","_bzip2_decompress_buffer","_bzip2_get_version","_bzip2_compress_bound","_bzip2_error_string","_malloc","_free"]' \
        -sEXPORTED_RUNTIME_METHODS='["cwrap","ccall","UTF8ToString","getValue","setValue","HEAPU8","HEAP8","HEAP32"]' \
        -sALLOW_MEMORY_GROWTH=1 \
        -sASSERTIONS=1 \
        -o bzip2-fallback.js

    log_success "MAIN_MODULE build completed: $(pwd)/bzip2-release.js"
    cd ..
}

# Install artifacts
install_artifacts() {
    log_info "Installing build artifacts..."

    mkdir -p "${INSTALL_PREFIX}/wasm"
    mkdir -p "${INSTALL_PREFIX}/include"

    # Copy WASM artifacts
    if [ -f "${BUILD_DIR}-side/bzip2-side.wasm" ]; then
        cp "${BUILD_DIR}-side/bzip2-side.wasm" "${INSTALL_PREFIX}/wasm/"
        log_success "Installed SIDE_MODULE: ${INSTALL_PREFIX}/wasm/bzip2-side.wasm"
    fi

    if [ -f "${BUILD_DIR}-main-release/bzip2-release.js" ]; then
        cp "${BUILD_DIR}-main-release/bzip2-release.js" "${INSTALL_PREFIX}/wasm/"
        cp "${BUILD_DIR}-main-release/bzip2-release.wasm" "${INSTALL_PREFIX}/wasm/"
        log_success "Installed MAIN_MODULE: ${INSTALL_PREFIX}/wasm/bzip2-release.js"
    fi

    if [ -f "${BUILD_DIR}-main-release/bzip2-fallback.js" ]; then
        cp "${BUILD_DIR}-main-release/bzip2-fallback.js" "${INSTALL_PREFIX}/wasm/"
        cp "${BUILD_DIR}-main-release/bzip2-fallback.wasm" "${INSTALL_PREFIX}/wasm/"
        log_success "Installed FALLBACK_MODULE: ${INSTALL_PREFIX}/wasm/bzip2-fallback.js"
    fi

    # Copy headers
    cp bzlib.h "${INSTALL_PREFIX}/include/"

    # Also copy to build/ directory for compatibility with existing tests
    mkdir -p build/
    if [ -f "${INSTALL_PREFIX}/wasm/bzip2-release.js" ]; then
        cp "${INSTALL_PREFIX}/wasm/bzip2-release.js" build/bzip2-optimized.js
        cp "${INSTALL_PREFIX}/wasm/bzip2-release.wasm" build/bzip2-optimized.wasm
        log_success "Copied optimized build to build/ for test compatibility"
    fi

    log_success "Installation complete in ${INSTALL_PREFIX}/"
}

# Clean build artifacts
clean_build() {
    log_info "Cleaning build artifacts..."
    
    rm -rf "${BUILD_DIR}-side" "${BUILD_DIR}-main-release" "${BUILD_DIR}-main-fallback" "${BUILD_DIR}-main-simd"
    rm -rf "${INSTALL_PREFIX}"
    rm -rf build/
    rm -rf dist/
    
    log_success "Build artifacts cleaned"
}

# Main build logic
main() {
    case "${VARIANT}" in
        "clean")
            clean_build
            ;;
        "side")
            build_bzip2_side_module
            install_artifacts
            ;;
        "main")
            build_bzip2_main_module
            install_artifacts
            ;;
        "all")
            build_bzip2_side_module
            build_bzip2_main_module
            install_artifacts
            ;;
        *)
            log_error "Unknown variant: ${VARIANT}. Use 'clean', 'side', 'main', or 'all'"
            exit 1
            ;;
    esac

    if [ "${VARIANT}" != "clean" ]; then
        log_success "Build completed for variant: ${VARIANT}"
    fi
}

# Check for emcc
if ! command -v emcc &> /dev/null; then
    log_error "emcc not found. Please install Emscripten SDK"
    exit 1
fi

main "$@"