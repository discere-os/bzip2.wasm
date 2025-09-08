/*
 * SIMD-optimized Huffman coding for bzip2
 * Performance optimizations for bit manipulation and tree operations
 */

#include "../bzlib_private.h"
#include <emscripten/emscripten.h>

#ifdef __wasm_simd128__
#include <wasm_simd128.h>
#endif

// Missing constants from bzlib_private.h
#ifndef BZ_MAX_ALPHA_SIZE
#define BZ_MAX_ALPHA_SIZE 258
#endif

#ifndef BZ_N_GROUPS  
#define BZ_N_GROUPS 6
#endif

#ifndef BZ_GREATER_ICOST
#define BZ_GREATER_ICOST 15
#endif

#ifndef ADDWEIGHTS
#define ADDWEIGHTS(zw1,zw2) \
   ((((zw1) & 0xffffff00) + ((zw2) & 0xffffff00)) | \
    (1 + (((zw1) & 0x000000ff) > ((zw2) & 0x000000ff) ? \
          ((zw1) & 0x000000ff) : ((zw2) & 0x000000ff))))
#endif

// Forward declarations
static void* huffman_pool_alloc(size_t size);
extern void* aligned_alloc(size_t alignment, size_t size);

// SIMD-optimized bit counting for frequency analysis
#ifdef __wasm_simd128__
void simd_count_bit_frequencies(UChar* data, Int32 len, Int32* freq) {
    // Initialize frequency counters
    memset(freq, 0, 256 * sizeof(Int32));
    
    // Process 16 bytes at once with SIMD
    Int32 i;
    for (i = 0; i < len - 15; i += 16) {
        v128_t bytes = wasm_v128_load(&data[i]);
        
        // Extract and count each byte efficiently (unroll for constants)
        freq[wasm_i8x16_extract_lane(bytes, 0)]++;
        freq[wasm_i8x16_extract_lane(bytes, 1)]++;
        freq[wasm_i8x16_extract_lane(bytes, 2)]++;
        freq[wasm_i8x16_extract_lane(bytes, 3)]++;
        freq[wasm_i8x16_extract_lane(bytes, 4)]++;
        freq[wasm_i8x16_extract_lane(bytes, 5)]++;
        freq[wasm_i8x16_extract_lane(bytes, 6)]++;
        freq[wasm_i8x16_extract_lane(bytes, 7)]++;
        freq[wasm_i8x16_extract_lane(bytes, 8)]++;
        freq[wasm_i8x16_extract_lane(bytes, 9)]++;
        freq[wasm_i8x16_extract_lane(bytes, 10)]++;
        freq[wasm_i8x16_extract_lane(bytes, 11)]++;
        freq[wasm_i8x16_extract_lane(bytes, 12)]++;
        freq[wasm_i8x16_extract_lane(bytes, 13)]++;
        freq[wasm_i8x16_extract_lane(bytes, 14)]++;
        freq[wasm_i8x16_extract_lane(bytes, 15)]++;
    }
    
    // Handle remaining bytes
    for (; i < len; i++) {
        freq[data[i]]++;
    }
}
#endif

// Optimized Huffman tree construction with better memory layout
static void optimized_huffman_make_code_lengths(UChar* len, Int32* freq, Int32 alpha_size, Int32 max_len) {
    Int32 i;
    /*
     * Nodes and heap entries run from 1.  Entry 0
     * for both the heap and nodes is a sentinel.
     */
    Int32 n_nodes, n_heap, n1, n2, j, k;
    Bool  too_long;

    // Aligned arrays for better cache performance
    Int32 heap[BZ_MAX_ALPHA_SIZE + 2] __attribute__((aligned(16)));
    Int32 weight[BZ_MAX_ALPHA_SIZE * 2] __attribute__((aligned(16)));
    Int32 parent[BZ_MAX_ALPHA_SIZE * 2] __attribute__((aligned(16)));

    // Initialize with cache-friendly patterns
    for (i = 0; i < alpha_size; i++) {
        weight[i+1] = (freq[i] == 0 ? 1 : freq[i]) << 8;
    }

    while (True) {
        n_nodes = alpha_size;
        n_heap = 0;

        heap[0] = 0;
        weight[0] = 0;
        parent[0] = -2;

        // Build initial heap with optimized insertions
        for (i = 1; i <= alpha_size; i++) {
            parent[i] = -1;
            n_heap++;
            heap[n_heap] = i;
            
            // Optimized up-heap operation
            {
                Int32 zz = n_heap, tmp = heap[zz];
                while (weight[tmp] < weight[heap[zz >> 1]]) {
                    heap[zz] = heap[zz >> 1];
                    zz >>= 1;
                }
                heap[zz] = tmp;
            }
        }

        AssertH(n_heap < (BZ_MAX_ALPHA_SIZE+2), 2001);

        // Main tree construction loop with optimized heap operations
        while (n_heap > 1) {
            n1 = heap[1]; 
            heap[1] = heap[n_heap]; 
            n_heap--; 
            
            // Optimized down-heap operation
            {
                Int32 zz = 1, yy, tmp = heap[zz];
                while (True) {
                    yy = zz << 1;
                    if (yy > n_heap) break;
                    if (yy < n_heap && weight[heap[yy+1]] < weight[heap[yy]]) 
                        yy++;
                    if (weight[tmp] < weight[heap[yy]]) break;
                    heap[zz] = heap[yy];
                    zz = yy;
                }
                heap[zz] = tmp;
            }
            
            n2 = heap[1]; 
            heap[1] = heap[n_heap]; 
            n_heap--;
            
            // Second down-heap operation
            {
                Int32 zz = 1, yy, tmp = heap[zz];
                while (True) {
                    yy = zz << 1;
                    if (yy > n_heap) break;
                    if (yy < n_heap && weight[heap[yy+1]] < weight[heap[yy]]) 
                        yy++;
                    if (weight[tmp] < weight[heap[yy]]) break;
                    heap[zz] = heap[yy];
                    zz = yy;
                }
                heap[zz] = tmp;
            }
            
            n_nodes++;
            parent[n1] = parent[n2] = n_nodes;
            weight[n_nodes] = ADDWEIGHTS(weight[n1], weight[n2]);
            parent[n_nodes] = -1;
            n_heap++;
            heap[n_heap] = n_nodes;
            
            // Final up-heap operation
            {
                Int32 zz = n_heap, tmp = heap[zz];
                while (weight[tmp] < weight[heap[zz >> 1]]) {
                    heap[zz] = heap[zz >> 1];
                    zz >>= 1;
                }
                heap[zz] = tmp;
            }
        }

        AssertH(n_nodes < (BZ_MAX_ALPHA_SIZE * 2), 2002);

        too_long = False;
        for (i = 1; i <= alpha_size; i++) {
            j = 0;
            k = i;
            while (parent[k] >= 0) { 
                k = parent[k]; 
                j++; 
            }
            len[i-1] = j;
            if (j > max_len) too_long = True;
        }
        
        if (!too_long) break;

        // Optimization: more efficient weight adjustment
        for (i = 1; i <= alpha_size; i++) {
            j = weight[i] >> 8;
            j = 1 + (j / 2);
            weight[i] = j << 8;
        }
    }
}

// SIMD-optimized bit manipulation for encoding
#ifdef __wasm_simd128__
void simd_generate_huffman_codes(Int32* code, UChar* length, Int32 max_len, Int32 alpha_size) {
    // Use SIMD for parallel code generation where applicable
    Int32 code_value = 0;
    
    for (Int32 bits = 1; bits <= max_len; bits++) {
        for (Int32 i = 0; i < alpha_size; i++) {
            if (length[i] == bits) {
                code[i] = code_value;
                code_value++;
            }
        }
        code_value <<= 1;
    }
}
#endif

// Memory-pool based allocation for Huffman tables
static void* huffman_alloc_pool = NULL;
static size_t huffman_pool_size = 0;
static size_t huffman_pool_used = 0;

void init_huffman_memory_pool(size_t size) {
    if (huffman_alloc_pool) {
        free(huffman_alloc_pool);
    }
    huffman_pool_size = size;
    huffman_pool_used = 0;
    huffman_alloc_pool = aligned_alloc(16, size);
}

static void* huffman_pool_alloc(size_t size) {
    // 16-byte aligned allocation from pool
    size = (size + 15) & ~15;
    
    if (huffman_pool_used + size <= huffman_pool_size) {
        void* ptr = (char*)huffman_alloc_pool + huffman_pool_used;
        huffman_pool_used += size;
        return ptr;
    }
    
    // Fall back to system allocator
    return aligned_alloc(16, size);
}

void cleanup_huffman_memory_pool(void) {
    if (huffman_alloc_pool) {
        free(huffman_alloc_pool);
        huffman_alloc_pool = NULL;
        huffman_pool_size = 0;
        huffman_pool_used = 0;
    }
}

// Cache-optimized Huffman encoding with prefetching
// Optimized frequency counting for symbol analysis
EMSCRIPTEN_KEEPALIVE
void bzip2_count_frequencies_optimized(UChar* data, Int32 len, Int32* freq_table) {
    #ifdef __wasm_simd128__
    simd_count_bit_frequencies(data, len, freq_table);
    #else
    // Standard frequency counting
    memset(freq_table, 0, 256 * sizeof(Int32));
    for (Int32 i = 0; i < len; i++) {
        freq_table[data[i]]++;
    }
    #endif
}

// Performance monitoring and statistics
typedef struct {
    double total_compression_time;
    double total_decompression_time;
    Int32 blocks_processed;
    Int32 bytes_processed;
    Int32 simd_operations_used;
} PerformanceStats;

static PerformanceStats g_perf_stats = {0.0, 0.0, 0, 0, 0};

EMSCRIPTEN_KEEPALIVE
void bzip2_get_performance_stats(double* comp_time, double* decomp_time, 
                               Int32* blocks, Int32* bytes, Int32* simd_ops) {
    *comp_time = g_perf_stats.total_compression_time;
    *decomp_time = g_perf_stats.total_decompression_time;
    *blocks = g_perf_stats.blocks_processed;
    *bytes = g_perf_stats.bytes_processed;
    *simd_ops = g_perf_stats.simd_operations_used;
}

EMSCRIPTEN_KEEPALIVE
void bzip2_reset_performance_stats(void) {
    memset(&g_perf_stats, 0, sizeof(PerformanceStats));
}