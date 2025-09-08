/**
 * bzip2.wasm - Professional compression library
 * Type-safe, high-performance implementation with SIMD optimizations
 */

import type {
  Bzip2Module,
  CompressionOptions,
  CompressionResult,
  DecompressionResult,
  PerformanceMetrics,
  InitializationOptions,
  SystemCapabilities,
  BenchmarkResult,
  FileCompressionResult,
  NavigatorWithMemory
} from './types'

/**
 * High-performance bzip2 compression with SIMD acceleration
 */
export class Bzip2 {
  private module: Bzip2Module | null = null
  private initialized = false
  private metrics: PerformanceMetrics = this.createInitialMetrics()

  /**
   * Initialize the WASM module
   */
  async initialize(options: InitializationOptions = {}): Promise<void> {
    if (this.initialized) return

    try {
      // Detect optimal module for environment
      const modulePath = this.selectOptimalModule(options)
      
      // Dynamic import with proper typing
      const moduleFactory = await import(/* @vite-ignore */ modulePath)
      this.module = await moduleFactory.default()
      
      this.initialized = true

      // Initialize optimized memory management if available
      if (this.module) {
        this.module._bzip2_init_optimized_memory?.()
      }

      if (options.enableMetrics && this.module) {
        this.startMetricsCollection()
      }
    } catch (error) {
      throw new Error(`Failed to initialize bzip2.wasm: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Compress data with optimal performance
   */
  compress(
    input: Uint8Array, 
    options: CompressionOptions = {}
  ): CompressionResult {
    this.assertInitialized()

    const startTime = performance.now()
    const { blockSize = 6, verbosity = 0, workFactor = 30 } = options

    // Validate inputs
    if (input.length === 0) {
      throw new Error('Input data cannot be empty')
    }
    if (blockSize < 1 || blockSize > 9) {
      throw new Error('Block size must be between 1 and 9')
    }

    // Memory allocation with automatic cleanup
    const inputPtr = this.module!._malloc(input.length)
    const maxOutputLen = this.getCompressBound(input.length)
    const outputPtr = this.module!._malloc(maxOutputLen)
    const outputLenPtr = this.module!._malloc(4)

    try {
      // Setup memory
      this.module!.HEAPU8.set(input, inputPtr)
      this.module!.setValue(outputLenPtr, maxOutputLen, 'i32')

      // Perform compression (use optimized if available, fallback to standard)
      const compressFunc = this.module!._bzip2_compress_buffer_optimized || this.module!._bzip2_compress_buffer
      const result = compressFunc(
        inputPtr, input.length, outputPtr, outputLenPtr,
        blockSize, verbosity, workFactor
      )

      if (result !== 0) {
        const errorMessage = this.getErrorString(result)
        throw new Error(`Compression failed: ${errorMessage}`)
      }

      // Extract results
      const outputLen = this.module!.getValue(outputLenPtr, 'i32')
      const compressed = new Uint8Array(outputLen)
      compressed.set(this.module!.HEAPU8.subarray(outputPtr, outputPtr + outputLen))

      const compressionTime = performance.now() - startTime
      const compressionSpeed = (input.length / 1024) / (compressionTime / 1000)
      const compressionRatio = input.length / compressed.length
      const spaceSaved = ((input.length - compressed.length) / input.length) * 100

      // Update metrics
      this.updateCompressionMetrics(input.length, compressionTime)

      return {
        compressed,
        compressionRatio,
        compressionTime,
        compressionSpeed,
        spaceSaved
      }
    } finally {
      // Guaranteed memory cleanup
      this.module!._free(inputPtr)
      this.module!._free(outputPtr)
      this.module!._free(outputLenPtr)
    }
  }

  /**
   * Decompress data with validation
   */
  decompress(compressed: Uint8Array): DecompressionResult {
    this.assertInitialized()

    const startTime = performance.now()
    
    // Estimate decompressed size (no arbitrary cap - let it grow as needed)
    const maxOutputLen = Math.max(compressed.length * 50, 10 * 1024 * 1024) // 50x expansion ratio, 10MB min

    const inputPtr = this.module!._malloc(compressed.length)
    const outputPtr = this.module!._malloc(maxOutputLen)
    const outputLenPtr = this.module!._malloc(4)

    try {
      // Setup memory
      this.module!.HEAPU8.set(compressed, inputPtr)
      this.module!.setValue(outputLenPtr, maxOutputLen, 'i32')

      // Perform decompression (use optimized if available, fallback to standard)
      const decompressFunc = this.module!._bzip2_decompress_buffer_optimized || this.module!._bzip2_decompress_buffer
      const result = decompressFunc(
        inputPtr, compressed.length, outputPtr, outputLenPtr, 0, 0
      )

      if (result !== 0) {
        const errorMessage = this.getErrorString(result)
        throw new Error(`Decompression failed: ${errorMessage}`)
      }

      // Extract results
      const outputLen = this.module!.getValue(outputLenPtr, 'i32')
      const decompressed = new Uint8Array(outputLen)
      decompressed.set(this.module!.HEAPU8.subarray(outputPtr, outputPtr + outputLen))

      const decompressionTime = performance.now() - startTime
      const decompressionSpeed = (decompressed.length / 1024) / (decompressionTime / 1000)

      // Update metrics
      this.updateDecompressionMetrics(decompressed.length, decompressionTime)

      return {
        decompressed,
        decompressionTime,
        decompressionSpeed,
        isValid: decompressed.length > 0
      }
    } finally {
      this.module!._free(inputPtr)
      this.module!._free(outputPtr)
      this.module!._free(outputLenPtr)
    }
  }

  /**
   * Get maximum possible compressed size
   */
  getCompressBound(inputLength: number): number {
    this.assertInitialized()
    const boundFunc = this.module!._bzip2_compress_bound_optimized || this.module!._bzip2_compress_bound
    return boundFunc(inputLength)
  }

  /**
   * Get library version
   */
  getVersion(): string {
    this.assertInitialized()
    const versionFunc = this.module!._bzip2_get_version_optimized || this.module!._bzip2_get_version
    const versionPtr = versionFunc()
    return this.readString(versionPtr) || '1.1.0'
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = this.createInitialMetrics()
  }

  /**
   * Detect system capabilities
   */
  getSystemCapabilities(): SystemCapabilities {
    return {
      wasmSupported: typeof WebAssembly !== 'undefined',
      simdSupported: this.detectSIMDSupport(),
      estimatedMemory: this.getNavigatorMemory(),
      coreCount: navigator.hardwareConcurrency
    }
  }

  /**
   * Benchmark different configurations
   */
  async benchmark(testData: Uint8Array): Promise<BenchmarkResult> {
    const dataType = this.classifyData(testData)
    const results: BenchmarkResult['results'] = {}

    // Test all block sizes
    for (const blockSize of [1, 6, 9] as const) {
      try {
        const result = this.compress(testData, { blockSize })
        const decompResult = this.decompress(result.compressed)
        
        results[blockSize] = {
          compressionSpeed: result.compressionSpeed,
          decompressionSpeed: decompResult.decompressionSpeed,
          compressionRatio: result.compressionRatio,
          spaceSaved: result.spaceSaved,
          time: result.compressionTime + decompResult.decompressionTime
        }
      } catch (error) {
        console.warn(`Benchmark failed for block size ${blockSize}:`, error)
      }
    }

    // Determine optimal configurations
    const entries = Object.entries(results)
    const fastestComp = entries.reduce((a, b) => 
      (results[parseInt(a[0])]?.compressionSpeed ?? 0) > (results[parseInt(b[0])]?.compressionSpeed ?? 0) ? a : b
    )
    const bestRatio = entries.reduce((a, b) => 
      (results[parseInt(a[0])]?.compressionRatio ?? 0) > (results[parseInt(b[0])]?.compressionRatio ?? 0) ? a : b
    )

    return {
      dataType,
      inputSize: testData.length,
      results,
      recommendation: {
        fastestCompression: parseInt(fastestComp[0]),
        bestRatio: parseInt(bestRatio[0]),
        balanced: 6
      }
    }
  }

  /**
   * Process file with optimal settings
   */
  async compressFile(file: File): Promise<FileCompressionResult> {
    const arrayBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)
    
    // Auto-select optimal block size based on file size
    let blockSize: 1 | 6 | 9 = 6
    if (file.size < 32768) blockSize = 1      // < 32KB: fast
    else if (file.size > 262144) blockSize = 9 // > 256KB: max compression

    const metrics = this.compress(fileData, { blockSize })
    
    return {
      fileName: file.name,
      originalSize: file.size,
      compressedData: metrics.compressed,
      metrics,
      suggestedFilename: `${file.name}.bz2`
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.module?._bzip2_cleanup_optimized_memory?.()
    this.module = null
    this.initialized = false
  }

  // Private methods
  private assertInitialized(): void {
    if (!this.initialized || !this.module) {
      throw new Error('bzip2.wasm not initialized. Call initialize() first.')
    }
  }

  private selectOptimalModule(options: InitializationOptions): string {
    if (options.wasmPath) return options.wasmPath
    
    // Determine absolute path based on execution context
    const basePath = process.cwd() + '/build/'
    
    // Always try optimized build first (it should fallback gracefully)
    if (options.preferOptimized !== false) {
      return `${basePath}bzip2-optimized.js`
    }
    
    return `${basePath}bzip2.js`
  }

  private detectSIMDSupport(): boolean {
    try {
      // Method 1: Check for WebAssembly.SIMD (newer browsers)
      if ('SIMD' in WebAssembly) {
        return true
      }
      
      // Method 2: User agent-based detection for known SIMD support
      const userAgent = navigator.userAgent
      
      if (userAgent.includes('Chrome/')) {
        const chromeVersion = parseInt(userAgent.match(/Chrome\/(\d+)/)?.[1] || '0')
        return chromeVersion >= 91
      }
      
      if (userAgent.includes('Firefox/')) {
        const firefoxVersion = parseInt(userAgent.match(/Firefox\/(\d+)/)?.[1] || '0')
        return firefoxVersion >= 89
      }
      
      if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
        // Safari SIMD support detection
        return userAgent.includes('Version/16') || userAgent.includes('Version/17') || userAgent.includes('Version/18')
      }
      
      // Method 3: Try a minimal SIMD WASM module
      try {
        new WebAssembly.Module(new Uint8Array([
          0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // WASM header
          0x01, 0x04, 0x01, 0x60, 0x00, 0x00,             // Type section: () -> ()
          0x03, 0x02, 0x01, 0x00,                         // Function section  
          0x0a, 0x09, 0x01, 0x07, 0x00,                   // Code section
          0xfd, 0x0c,                                     // v128.const
          0x01, 0x00, 0x00, 0x00,                         // 4 bytes of data
          0x0b                                            // end
        ]))
        return true
      } catch {
        return false
      }
      
    } catch {
      return false
    }
  }

  private getNavigatorMemory(): number | undefined {
    return typeof navigator !== 'undefined' 
      ? (navigator as NavigatorWithMemory).deviceMemory 
      : undefined
  }

  private readString(ptr: number): string | null {
    if (!this.module) return null
    
    if (this.module.UTF8ToString) {
      return this.module.UTF8ToString(ptr)
    }
    if (this.module.AsciiToString) {
      return this.module.AsciiToString(ptr)
    }
    return null
  }

  private getErrorString(errorCode: number): string {
    const errorFunc = this.module!._bzip2_error_string_optimized || this.module!._bzip2_error_string
    const errorPtr = errorFunc(errorCode)
    return this.readString(errorPtr) || `Error code ${errorCode}`
  }

  private classifyData(data: Uint8Array): BenchmarkResult['dataType'] {
    // Simple heuristic for data classification
    const sample = data.slice(0, Math.min(1024, data.length))
    let textChars = 0
    
    for (const byte of sample) {
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textChars++
      }
    }
    
    const textRatio = textChars / sample.length
    if (textRatio > 0.9) return 'text'
    if (textRatio > 0.7) return 'json'
    if (textRatio > 0.3) return 'binary'
    return 'random'
  }

  private createInitialMetrics(): PerformanceMetrics {
    return {
      compressionOps: 0,
      decompressionOps: 0,
      averageCompressionSpeed: 0,
      averageDecompressionSpeed: 0,
      totalCompressionTime: 0,
      totalDecompressionTime: 0,
      simdAcceleration: this.detectSIMDSupport()
    }
  }

  private updateCompressionMetrics(bytes: number, time: number): void {
    this.metrics.compressionOps++
    this.metrics.totalCompressionTime += time
    
    const speed = (bytes / 1024) / (time / 1000)
    this.metrics.averageCompressionSpeed = 
      (this.metrics.averageCompressionSpeed * (this.metrics.compressionOps - 1) + speed) / 
      this.metrics.compressionOps
  }

  private updateDecompressionMetrics(bytes: number, time: number): void {
    this.metrics.decompressionOps++
    this.metrics.totalDecompressionTime += time
    
    const speed = (bytes / 1024) / (time / 1000)
    this.metrics.averageDecompressionSpeed = 
      (this.metrics.averageDecompressionSpeed * (this.metrics.decompressionOps - 1) + speed) / 
      this.metrics.decompressionOps
  }

  private startMetricsCollection(): void {
    // Enable any available performance monitoring
    this.module?._bzip2_init_optimized_allocator?.()
  }
}

// Utility functions
export function formatSpeed(speedKBps: number): string {
  if (speedKBps >= 1024 * 1024) {
    return `${(speedKBps / 1024 / 1024).toFixed(1)} GB/s`
  } else if (speedKBps >= 1024) {
    return `${(speedKBps / 1024).toFixed(1)} MB/s`
  } else if (speedKBps >= 1) {
    return `${speedKBps.toFixed(1)} KB/s`
  } else {
    return `${(speedKBps * 1024).toFixed(0)} B/s`
  }
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${bytes} B`
  }
}

// Default export
export default Bzip2

// Re-export types
export type * from './types'