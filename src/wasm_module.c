#include "../bzlib.h"
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <string.h>

// WASM-exported functions for bzip2 compression and decompression

EMSCRIPTEN_KEEPALIVE
int bzip2_compress_buffer(const char* input, int input_len, char* output, unsigned int* output_len, int block_size_100k, int verbosity, int work_factor) {
    bz_stream strm;
    int ret;
    
    // Initialize compression stream
    strm.bzalloc = NULL;
    strm.bzfree = NULL;
    strm.opaque = NULL;
    
    ret = BZ2_bzCompressInit(&strm, block_size_100k, verbosity, work_factor);
    if (ret != BZ_OK) {
        return ret;
    }
    
    // Set input and output buffers
    strm.next_in = (char*)input;
    strm.avail_in = input_len;
    strm.next_out = output;
    strm.avail_out = *output_len;
    
    // Compress data
    ret = BZ2_bzCompress(&strm, BZ_FINISH);
    if (ret != BZ_FINISH_OK && ret != BZ_STREAM_END) {
        BZ2_bzCompressEnd(&strm);
        return ret;
    }
    
    // Update output length
    *output_len = strm.total_out_lo32;
    
    // Clean up
    BZ2_bzCompressEnd(&strm);
    return BZ_OK;
}

EMSCRIPTEN_KEEPALIVE
int bzip2_decompress_buffer(const char* input, int input_len, char* output, unsigned int* output_len, int verbosity, int small) {
    bz_stream strm;
    int ret;
    
    // Initialize decompression stream
    strm.bzalloc = NULL;
    strm.bzfree = NULL;
    strm.opaque = NULL;
    
    ret = BZ2_bzDecompressInit(&strm, verbosity, small);
    if (ret != BZ_OK) {
        return ret;
    }
    
    // Set input and output buffers
    strm.next_in = (char*)input;
    strm.avail_in = input_len;
    strm.next_out = output;
    strm.avail_out = *output_len;
    
    // Decompress data
    ret = BZ2_bzDecompress(&strm);
    if (ret != BZ_OK && ret != BZ_STREAM_END) {
        BZ2_bzDecompressEnd(&strm);
        return ret;
    }
    
    // Update output length
    *output_len = strm.total_out_lo32;
    
    // Clean up
    BZ2_bzDecompressEnd(&strm);
    return BZ_OK;
}

EMSCRIPTEN_KEEPALIVE
int bzip2_compress_bound(int input_len) {
    // Formula from bzip2 documentation: input + (input/100) + 600
    return input_len + (input_len / 100) + 600;
}

EMSCRIPTEN_KEEPALIVE
const char* bzip2_get_version(void) {
    return BZ2_bzlibVersion();
}

EMSCRIPTEN_KEEPALIVE
const char* bzip2_error_string(int error_code) {
    switch (error_code) {
        case BZ_OK: return "BZ_OK";
        case BZ_RUN_OK: return "BZ_RUN_OK";
        case BZ_FLUSH_OK: return "BZ_FLUSH_OK";
        case BZ_FINISH_OK: return "BZ_FINISH_OK";
        case BZ_STREAM_END: return "BZ_STREAM_END";
        case BZ_SEQUENCE_ERROR: return "BZ_SEQUENCE_ERROR";
        case BZ_PARAM_ERROR: return "BZ_PARAM_ERROR";
        case BZ_MEM_ERROR: return "BZ_MEM_ERROR";
        case BZ_DATA_ERROR: return "BZ_DATA_ERROR";
        case BZ_DATA_ERROR_MAGIC: return "BZ_DATA_ERROR_MAGIC";
        case BZ_IO_ERROR: return "BZ_IO_ERROR";
        case BZ_UNEXPECTED_EOF: return "BZ_UNEXPECTED_EOF";
        case BZ_OUTBUFF_FULL: return "BZ_OUTBUFF_FULL";
        case BZ_CONFIG_ERROR: return "BZ_CONFIG_ERROR";
        default: return "UNKNOWN_ERROR";
    }
}