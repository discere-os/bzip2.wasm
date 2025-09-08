/*
 * Optimized memory management for bzip2.wasm
 * Specialized allocator for bzip2's allocation patterns
 */

#include "../bzlib_private.h"
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <string.h>

// Memory pool configuration optimized for bzip2 workloads
#define BZIP2_POOL_SIZE (2 * 1024 * 1024)  // 2MB pool
#define BZIP2_SMALL_ALLOC_LIMIT 4096        // Threshold for small allocations
#define BZIP2_ALIGNMENT 16                   // SIMD-friendly alignment

typedef struct MemoryBlock {
    size_t size;
    int in_use;
    struct MemoryBlock* next;
    struct MemoryBlock* prev;
} MemoryBlock;

typedef struct {
    void* pool_memory;
    size_t pool_size;
    size_t pool_used;
    MemoryBlock* free_list_small;  // < 4KB allocations
    MemoryBlock* free_list_large;  // >= 4KB allocations
    size_t total_allocated;
    size_t peak_allocated;
    int allocation_count;
    int free_count;
} OptimizedAllocator;

// Forward declarations
static void coalesce_free_blocks(MemoryBlock* block);

static OptimizedAllocator g_allocator = {0};

// Initialize the optimized allocator
EMSCRIPTEN_KEEPALIVE
int bzip2_init_optimized_allocator(void) {
    if (g_allocator.pool_memory) {
        return 1; // Already initialized
    }
    
    // Allocate aligned memory pool
    g_allocator.pool_memory = aligned_alloc(BZIP2_ALIGNMENT, BZIP2_POOL_SIZE);
    if (!g_allocator.pool_memory) {
        return 0; // Allocation failed
    }
    
    g_allocator.pool_size = BZIP2_POOL_SIZE;
    g_allocator.pool_used = 0;
    g_allocator.free_list_small = NULL;
    g_allocator.free_list_large = NULL;
    g_allocator.total_allocated = 0;
    g_allocator.peak_allocated = 0;
    g_allocator.allocation_count = 0;
    g_allocator.free_count = 0;
    
    // Initialize free list with the entire pool as one large block
    MemoryBlock* initial_block = (MemoryBlock*)g_allocator.pool_memory;
    initial_block->size = BZIP2_POOL_SIZE - sizeof(MemoryBlock);
    initial_block->in_use = 0;
    initial_block->next = NULL;
    initial_block->prev = NULL;
    g_allocator.free_list_large = initial_block;
    
    return 1;
}

// Fast allocation for small, frequently used blocks
static void* allocate_from_pool(size_t size) {
    // Align size to 16-byte boundary for SIMD efficiency
    size = (size + BZIP2_ALIGNMENT - 1) & ~(BZIP2_ALIGNMENT - 1);
    
    MemoryBlock** free_list = (size < BZIP2_SMALL_ALLOC_LIMIT) ? 
                              &g_allocator.free_list_small : 
                              &g_allocator.free_list_large;
    
    // Find suitable block in free list
    MemoryBlock* current = *free_list;
    while (current) {
        if (!current->in_use && current->size >= size) {
            // Found suitable block
            current->in_use = 1;
            
            // Split block if it's much larger than needed
            if (current->size > size + sizeof(MemoryBlock) + 64) {
                MemoryBlock* new_block = (MemoryBlock*)((char*)current + sizeof(MemoryBlock) + size);
                new_block->size = current->size - size - sizeof(MemoryBlock);
                new_block->in_use = 0;
                new_block->next = current->next;
                new_block->prev = current;
                
                if (current->next) {
                    current->next->prev = new_block;
                }
                current->next = new_block;
                current->size = size;
            }
            
            g_allocator.total_allocated += size;
            g_allocator.allocation_count++;
            
            if (g_allocator.total_allocated > g_allocator.peak_allocated) {
                g_allocator.peak_allocated = g_allocator.total_allocated;
            }
            
            return (char*)current + sizeof(MemoryBlock);
        }
        current = current->next;
    }
    
    return NULL; // No suitable block found
}

// Optimized allocation function for bzip2
static void* bzip2_optimized_malloc(size_t size) {
    if (!g_allocator.pool_memory) {
        // Fallback to system allocator if pool not initialized
        return aligned_alloc(BZIP2_ALIGNMENT, size);
    }
    
    // Try pool allocation first for better performance
    void* ptr = allocate_from_pool(size);
    if (ptr) {
        return ptr;
    }
    
    // Fallback to system allocator for large allocations
    void* system_ptr = aligned_alloc(BZIP2_ALIGNMENT, size);
    if (system_ptr) {
        g_allocator.allocation_count++;
    }
    
    return system_ptr;
}

// Fast deallocation for pool-managed blocks
static void bzip2_optimized_free(void* ptr) {
    if (!ptr || !g_allocator.pool_memory) {
        free(ptr);
        return;
    }
    
    // Check if pointer is within our pool
    if (ptr >= g_allocator.pool_memory && 
        ptr < (char*)g_allocator.pool_memory + g_allocator.pool_size) {
        
        MemoryBlock* block = (MemoryBlock*)((char*)ptr - sizeof(MemoryBlock));
        
        if (block->in_use) {
            block->in_use = 0;
            g_allocator.total_allocated -= block->size;
            g_allocator.free_count++;
            
            // Coalesce with adjacent free blocks for defragmentation
            coalesce_free_blocks(block);
        }
    } else {
        // System-allocated memory
        free(ptr);
        g_allocator.free_count++;
    }
}

// Coalesce adjacent free blocks to reduce fragmentation
static void coalesce_free_blocks(MemoryBlock* block) {
    // Coalesce with next block if free
    if (block->next && !block->next->in_use) {
        MemoryBlock* next = block->next;
        block->size += next->size + sizeof(MemoryBlock);
        block->next = next->next;
        if (next->next) {
            next->next->prev = block;
        }
    }
    
    // Coalesce with previous block if free
    if (block->prev && !block->prev->in_use) {
        MemoryBlock* prev = block->prev;
        prev->size += block->size + sizeof(MemoryBlock);
        prev->next = block->next;
        if (block->next) {
            block->next->prev = prev;
        }
    }
}

// Custom allocator functions for bzip2 streams
EMSCRIPTEN_KEEPALIVE
void* bzip2_stream_alloc(void* opaque, int items, int size) {
    size_t total_size = items * size;
    
    // Use optimized allocator for bzip2 workloads
    return bzip2_optimized_malloc(total_size);
}

EMSCRIPTEN_KEEPALIVE
void bzip2_stream_free(void* opaque, void* ptr) {
    bzip2_optimized_free(ptr);
}

// Pre-allocated buffers for common bzip2 operations
static struct {
    void* sort_buffer;       // For block sorting operations
    void* huffman_buffer;    // For Huffman table construction
    void* temp_buffer;       // General temporary operations
    size_t buffer_size;
} g_preallocated = {NULL, NULL, NULL, 0};

EMSCRIPTEN_KEEPALIVE
int bzip2_preallocate_buffers(size_t buffer_size) {
    // Pre-allocate commonly used buffers to avoid malloc overhead
    g_preallocated.buffer_size = buffer_size;
    
    g_preallocated.sort_buffer = bzip2_optimized_malloc(buffer_size);
    g_preallocated.huffman_buffer = bzip2_optimized_malloc(buffer_size / 2);
    g_preallocated.temp_buffer = bzip2_optimized_malloc(buffer_size / 4);
    
    return (g_preallocated.sort_buffer && 
            g_preallocated.huffman_buffer && 
            g_preallocated.temp_buffer) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
void* bzip2_get_sort_buffer(void) {
    return g_preallocated.sort_buffer;
}

EMSCRIPTEN_KEEPALIVE
void* bzip2_get_huffman_buffer(void) {
    return g_preallocated.huffman_buffer;
}

EMSCRIPTEN_KEEPALIVE
void* bzip2_get_temp_buffer(void) {
    return g_preallocated.temp_buffer;
}

// Memory statistics and monitoring
EMSCRIPTEN_KEEPALIVE
void bzip2_get_memory_stats(int* alloc_count, int* free_count, size_t* peak_allocated, size_t* current_allocated) {
    *alloc_count = g_allocator.allocation_count;
    *free_count = g_allocator.free_count;
    *peak_allocated = g_allocator.peak_allocated;
    *current_allocated = g_allocator.total_allocated;
}

// Reset memory statistics
EMSCRIPTEN_KEEPALIVE
void bzip2_reset_memory_stats(void) {
    g_allocator.allocation_count = 0;
    g_allocator.free_count = 0;
    g_allocator.peak_allocated = g_allocator.total_allocated;
}

// Clean up optimized allocator
EMSCRIPTEN_KEEPALIVE
void bzip2_cleanup_optimized_allocator(void) {
    // Clean up pre-allocated buffers
    if (g_preallocated.sort_buffer) {
        bzip2_optimized_free(g_preallocated.sort_buffer);
        g_preallocated.sort_buffer = NULL;
    }
    if (g_preallocated.huffman_buffer) {
        bzip2_optimized_free(g_preallocated.huffman_buffer);
        g_preallocated.huffman_buffer = NULL;
    }
    if (g_preallocated.temp_buffer) {
        bzip2_optimized_free(g_preallocated.temp_buffer);
        g_preallocated.temp_buffer = NULL;
    }
    
    // Clean up memory pool
    if (g_allocator.pool_memory) {
        free(g_allocator.pool_memory);
        g_allocator.pool_memory = NULL;
        g_allocator.pool_size = 0;
        g_allocator.pool_used = 0;
        g_allocator.free_list_small = NULL;
        g_allocator.free_list_large = NULL;
        g_allocator.total_allocated = 0;
        g_allocator.peak_allocated = 0;
    }
}

// Memory pool defragmentation for long-running applications
EMSCRIPTEN_KEEPALIVE
void bzip2_defragment_memory_pool(void) {
    if (!g_allocator.pool_memory) return;
    
    // Compact free blocks to reduce fragmentation
    MemoryBlock* current = (MemoryBlock*)g_allocator.pool_memory;
    while (current && (char*)current < (char*)g_allocator.pool_memory + g_allocator.pool_size) {
        if (!current->in_use && current->next && !current->next->in_use) {
            coalesce_free_blocks(current);
        }
        current = current->next;
    }
}

// Get memory pool utilization statistics
EMSCRIPTEN_KEEPALIVE
double bzip2_get_memory_utilization(void) {
    if (!g_allocator.pool_memory || g_allocator.pool_size == 0) {
        return 0.0;
    }
    
    return (double)g_allocator.total_allocated / g_allocator.pool_size;
}