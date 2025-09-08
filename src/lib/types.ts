/**
 * Type definitions for bzip2.wasm
 * Professional, type-safe interface for high-performance compression
 */

// Core WASM module interface
export interface Bzip2Module {
  // Optimized compression functions (preferred)
  _bzip2_compress_buffer_optimized?(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number,
    blockSize: number,
    verbosity: number,
    workFactor: number
  ): number
  
  _bzip2_decompress_buffer_optimized?(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number,
    verbosity: number,
    small: number
  ): number

  _bzip2_compress_bound_optimized?(inputLen: number): number
  _bzip2_get_version_optimized?(): number
  _bzip2_error_string_optimized?(errorCode: number): number

  // Standard fallback functions
  _bzip2_compress_buffer(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number,
    blockSize: number,
    verbosity: number,
    workFactor: number
  ): number
  
  _bzip2_decompress_buffer(
    input: number,
    inputLen: number,
    output: number,
    outputLen: number,
    verbosity: number,
    small: number
  ): number

  _bzip2_compress_bound(inputLen: number): number
  _bzip2_get_version(): number
  _bzip2_error_string(errorCode: number): number

  // Optional optimized memory management functions
  _bzip2_init_optimized_memory?(): void
  _bzip2_cleanup_optimized_memory?(): void
  _bzip2_init_optimized_allocator?(): number
  _bzip2_cleanup_optimized_allocator?(): void

  // Memory management
  _malloc(size: number): number
  _free(ptr: number): void

  // Runtime interface
  HEAPU8: Uint8Array
  setValue(ptr: number, value: number, type: 'i8' | 'i16' | 'i32' | 'float' | 'double'): void
  getValue(ptr: number, type: 'i8' | 'i16' | 'i32' | 'float' | 'double'): number
  UTF8ToString?(ptr: number): string
  AsciiToString?(ptr: number): string
}

// Extended navigator interface for device memory
export interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

// Compression configuration
export interface CompressionOptions {
  /** Block size (1-9): 1=fast, 9=maximum compression */
  blockSize?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  /** Verbosity level (0=silent, 4=maximum) */
  verbosity?: number
  /** Work factor for fallback sorting algorithm */
  workFactor?: number
}

// Compression result with performance metrics
export interface CompressionResult {
  /** Compressed data */
  compressed: Uint8Array
  /** Compression ratio (original/compressed) */
  compressionRatio: number
  /** Time taken in milliseconds */
  compressionTime: number
  /** Compression speed in KB/s */
  compressionSpeed: number
  /** Space saved as percentage */
  spaceSaved: number
}

// Decompression result with validation
export interface DecompressionResult {
  /** Decompressed data */
  decompressed: Uint8Array
  /** Time taken in milliseconds */
  decompressionTime: number
  /** Decompression speed in KB/s */  
  decompressionSpeed: number
  /** Round-trip validation successful */
  isValid: boolean
}

// Performance monitoring
export interface PerformanceMetrics {
  /** Number of compression operations */
  compressionOps: number
  /** Number of decompression operations */
  decompressionOps: number
  /** Average compression speed in KB/s */
  averageCompressionSpeed: number
  /** Average decompression speed in KB/s */
  averageDecompressionSpeed: number
  /** Total compression time in milliseconds */
  totalCompressionTime: number
  /** Total decompression time in milliseconds */
  totalDecompressionTime: number
  /** Whether SIMD acceleration is active */
  simdAcceleration: boolean
}

// Error types
export type Bzip2ErrorCode = 
  | 'BZ_OK'
  | 'BZ_RUN_OK'
  | 'BZ_FLUSH_OK'
  | 'BZ_FINISH_OK'
  | 'BZ_STREAM_END'
  | 'BZ_SEQUENCE_ERROR'
  | 'BZ_PARAM_ERROR'
  | 'BZ_MEM_ERROR'
  | 'BZ_DATA_ERROR'
  | 'BZ_DATA_ERROR_MAGIC'
  | 'BZ_IO_ERROR'
  | 'BZ_UNEXPECTED_EOF'
  | 'BZ_OUTBUFF_FULL'
  | 'BZ_CONFIG_ERROR'

// Module initialization options
export interface InitializationOptions {
  /** Prefer optimized build with SIMD */
  preferOptimized?: boolean
  /** Enable performance monitoring */
  enableMetrics?: boolean
  /** Custom WASM module path */
  wasmPath?: string
}

// Capability detection
export interface SystemCapabilities {
  /** WebAssembly support */
  wasmSupported: boolean
  /** SIMD instruction support */
  simdSupported: boolean
  /** Memory size estimation */
  estimatedMemory: number | undefined
  /** CPU core count */
  coreCount: number | undefined
}

// Benchmark result structure
export interface BenchmarkResult {
  /** Test data characteristics */
  dataType: 'text' | 'json' | 'binary' | 'random'
  /** Input size in bytes */
  inputSize: number
  /** Results per block size */
  results: Record<number, {
    compressionSpeed: number
    decompressionSpeed: number
    compressionRatio: number
    spaceSaved: number
    time: number
  }>
  /** Optimal configuration recommendation */
  recommendation: {
    fastestCompression: number
    bestRatio: number
    balanced: number
  }
}

// File processing result
export interface FileCompressionResult {
  /** Original filename */
  fileName: string
  /** Original file size */
  originalSize: number
  /** Compressed data */
  compressedData: Uint8Array
  /** Compression metrics */
  metrics: CompressionResult
  /** Suggested filename for compressed file */
  suggestedFilename: string
}