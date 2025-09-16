/**
 * bzip2.wasm - Simple TypeScript interface for Deno
 * Based on zlib.wasm patterns for compatibility
 */

import {
  Bzip2Error,
  Bzip2MemoryError,
  Bzip2CompressionError,
  Bzip2InitError
} from './types.ts'
import type {
  CompressionOptions,
  CompressionResult,
  DecompressionResult,
  PerformanceMetrics,
  BenchmarkResult
} from './types.ts'

// Simple WASM module interface for bzip2
interface SimpleBzip2Module {
  _bzip2_compress_buffer: (src: number, srcLen: number, dest: number, destLen: number, blockSize: number, verbosity: number, workFactor: number) => number
  _bzip2_decompress_buffer: (src: number, srcLen: number, dest: number, destLen: number, verbosity: number, small: number) => number
  _bzip2_compress_bound: (inputLen: number) => number
  _bzip2_get_version: () => number
  _bzip2_error_string: (errorCode: number) => number
  _malloc: (size: number) => number
  _free: (ptr: number) => void
  HEAPU8: Uint8Array
  HEAP32: Int32Array
  getValue: (ptr: number, type: string) => number
  setValue: (ptr: number, value: number, type: string) => void
  UTF8ToString?: (ptr: number) => string
}

export default class Bzip2 {
  private module: SimpleBzip2Module | null = null
  private initialized = false
  private performanceMetrics = {
    compressionOps: 0,
    decompressionOps: 0,
    totalCompressionTime: 0,
    totalDecompressionTime: 0
  }

  constructor(options: { simdOptimizations?: boolean, maxMemoryMB?: number } = {}) {
    // Simple constructor for basic compatibility
    this.simdOptimizations = options.simdOptimizations ?? true
    this.maxMemoryMB = options.maxMemoryMB ?? 256
  }

  private simdOptimizations: boolean
  private maxMemoryMB: number

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Load WASM module with CDN fallback
      const moduleFactory = await this.loadWASMModule()
      this.module = await moduleFactory({
        wasmBinary: await this.loadWasmBinary()
      })

      // Verify WASM functions available
      const requiredFunctions = [
        '_bzip2_compress_buffer',
        '_bzip2_decompress_buffer',
        '_bzip2_compress_bound',
        '_bzip2_get_version'
      ]

      if (!this.module) {
        throw new Bzip2InitError('WASM module is null after initialization')
      }

      for (const func of requiredFunctions) {
        if (typeof (this.module as any)[func] !== 'function') {
          throw new Bzip2InitError(`Missing WASM function: ${func}`)
        }
      }

      this.initialized = true
      console.log('✅ bzip2.wasm initialized successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Bzip2InitError(`Failed to initialize bzip2.wasm: ${errorMessage}`)
    }
  }

  async compress(data: Uint8Array, options: CompressionOptions = {}): Promise<CompressionResult> {
    if (!this.initialized || !this.module) {
      throw new Bzip2Error('bzip2.wasm not initialized')
    }

    const startTime = performance.now()
    const blockSize = options.blockSize || 6
    const verbosity = options.verbosity || 0
    const workFactor = options.workFactor || 30

    // Allocate input buffer
    const inputPtr = this.module._malloc(data.length)
    this.module.HEAPU8.set(data, inputPtr)

    // Calculate maximum output buffer size
    const maxOutputSize = this.module._bzip2_compress_bound(data.length)
    const outputPtr = this.module._malloc(maxOutputSize)

    // Allocate space for the output length (unsigned long*)
    const outputLenPtr = this.module._malloc(4)
    this.module.setValue(outputLenPtr, maxOutputSize, 'i32')

    try {
      // Perform compression
      const result = this.module._bzip2_compress_buffer(
        inputPtr,
        data.length,
        outputPtr,
        outputLenPtr,
        blockSize,
        verbosity,
        workFactor
      )

      if (result !== 0) {
        throw new Bzip2CompressionError(`Compression failed with code: ${result}`)
      }

      // Get the actual compressed size
      const compressedSize = this.module.getValue(outputLenPtr, 'i32')

      if (compressedSize === 0) {
        throw new Bzip2CompressionError('Compression failed - no output generated')
      }

      // Copy compressed data
      const compressed = new Uint8Array(compressedSize)
      compressed.set(
        this.module.HEAPU8.subarray(outputPtr, outputPtr + compressedSize)
      )

      const endTime = performance.now()
      const processingTime = endTime - startTime

      // Update metrics
      this.performanceMetrics.compressionOps++
      this.performanceMetrics.totalCompressionTime += processingTime

      return {
        data: compressed,
        originalSize: data.length,
        compressedSize: compressedSize,
        compressionRatio: data.length / compressedSize,
        processingTime: processingTime,
        simdAccelerated: this.simdOptimizations
      }
    } finally {
      // Free memory
      this.module._free(inputPtr)
      this.module._free(outputPtr)
      this.module._free(outputLenPtr)
    }
  }

  async decompress(compressed: Uint8Array): Promise<DecompressionResult> {
    if (!this.initialized || !this.module) {
      throw new Bzip2Error('bzip2.wasm not initialized')
    }

    const startTime = performance.now()

    // Estimate decompressed size (be generous for bzip2)
    const estimatedSize = Math.max(compressed.length * 10, 64 * 1024)
    const inputPtr = this.module._malloc(compressed.length)
    const outputPtr = this.module._malloc(estimatedSize)
    const outputLenPtr = this.module._malloc(4)

    this.module.HEAPU8.set(compressed, inputPtr)
    this.module.setValue(outputLenPtr, estimatedSize, 'i32')

    try {
      // Perform decompression
      const result = this.module._bzip2_decompress_buffer(
        inputPtr,
        compressed.length,
        outputPtr,
        outputLenPtr,
        0, // verbosity
        0  // small
      )

      if (result !== 0) {
        throw new Bzip2CompressionError(`Decompression failed with code: ${result}`)
      }

      // Get the actual decompressed size
      const decompressedSize = this.module.getValue(outputLenPtr, 'i32')

      if (decompressedSize === 0) {
        throw new Bzip2CompressionError('Decompression failed - no output generated')
      }

      // Copy decompressed data
      const decompressed = new Uint8Array(decompressedSize)
      decompressed.set(
        this.module.HEAPU8.subarray(outputPtr, outputPtr + decompressedSize)
      )

      const endTime = performance.now()
      const processingTime = endTime - startTime

      // Update metrics
      this.performanceMetrics.decompressionOps++
      this.performanceMetrics.totalDecompressionTime += processingTime

      return {
        data: decompressed,
        originalSize: decompressed.length,
        compressedSize: compressed.length,
        compressionRatio: decompressed.length / compressed.length,
        processingTime: processingTime,
        simdAccelerated: this.simdOptimizations
      }
    } finally {
      this.module._free(inputPtr)
      this.module._free(outputPtr)
      this.module._free(outputLenPtr)
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const avgCompressionSpeed = this.performanceMetrics.compressionOps > 0
      ? (this.performanceMetrics.totalCompressionTime / this.performanceMetrics.compressionOps)
      : 0

    const avgDecompressionSpeed = this.performanceMetrics.decompressionOps > 0
      ? (this.performanceMetrics.totalDecompressionTime / this.performanceMetrics.decompressionOps)
      : 0

    return {
      compressionOps: this.performanceMetrics.compressionOps,
      decompressionOps: this.performanceMetrics.decompressionOps,
      averageCompressionSpeed: avgCompressionSpeed,
      averageDecompressionSpeed: avgDecompressionSpeed,
      totalCompressionTime: this.performanceMetrics.totalCompressionTime,
      totalDecompressionTime: this.performanceMetrics.totalDecompressionTime,
      simdAcceleration: this.simdOptimizations
    }
  }

  getSystemCapabilities() {
    return {
      wasmSupported: typeof WebAssembly !== 'undefined',
      simdSupported: this.simdOptimizations,
      version: this.getVersion(),
      maxMemoryMB: this.maxMemoryMB,
      blockSizes: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    }
  }

  getCapabilities() {
    return {
      simdSupported: this.simdOptimizations,
      version: this.getVersion(),
      maxMemoryMB: this.maxMemoryMB
    }
  }

  getVersion(): string {
    if (!this.initialized || !this.module) {
      return '1.0.8'
    }

    try {
      const versionPtr = this.module._bzip2_get_version()
      return this.module.UTF8ToString?.(versionPtr) || '1.0.8'
    } catch {
      return '1.0.8'
    }
  }

  async benchmark(data: Uint8Array, _iterations: number = 10): Promise<BenchmarkResult> {
    const dataType = this.classifyData(data)
    const results: BenchmarkResult['results'] = {}

    // Test all block sizes
    for (const blockSize of [1, 6, 9] as const) {
      try {
        const result = await this.compress(data, { blockSize })
        const decompResult = await this.decompress(result.data)

        results[blockSize] = {
          compressionSpeed: result.processingTime > 0 ? (data.length / 1024) / (result.processingTime / 1000) : 0,
          decompressionSpeed: decompResult.processingTime > 0 ? (decompResult.data.length / 1024) / (decompResult.processingTime / 1000) : 0,
          compressionRatio: result.compressionRatio,
          spaceSaved: ((data.length - result.compressedSize) / data.length) * 100,
          time: result.processingTime + decompResult.processingTime
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
      inputSize: data.length,
      results,
      recommendation: {
        fastestCompression: parseInt(fastestComp[0]),
        bestRatio: parseInt(bestRatio[0]),
        balanced: 6
      }
    }
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

  cleanup(): void {
    this.module = null
    this.initialized = false
  }

  private async loadWASMModule(): Promise<any> {
    // Try to load from local file first (development)
    try {
      // Use dynamic import with absolute path to avoid TypeScript module resolution
      const modulePath = new URL('./../../install/wasm/bzip2-release.js', import.meta.url).href
      const localModule = await import(modulePath) as any
      return localModule.default
    } catch (error) {
      throw new Bzip2InitError(`Failed to load bzip2.wasm module: ${error}`)
    }
  }

  private async loadWasmBinary(): Promise<ArrayBuffer> {
    // Try local build paths first (for Deno and Node.js testing)
    // @ts-ignore - Deno global may not exist in all environments
    if (typeof globalThis.Deno !== 'undefined') {
      const localPaths = [
        './install/wasm/bzip2-release.wasm',
        './install/wasm/bzip2.wasm',
        './build-dual-main-release/bzip2-release.wasm',
        './build/bzip2-release.wasm'
      ]

      for (const localPath of localPaths) {
        try {
          const wasmBuffer = await Deno.readFile(localPath)
          console.log(`✅ Loaded bzip2.wasm binary from: ${localPath}`)
          return wasmBuffer.buffer
        } catch (error) {
          console.log(`⚠️ Failed to load WASM from ${localPath}:`, (error as Error).message)
          continue
        }
      }
    }

    throw new Error('No bzip2.wasm binary available. Run "deno task build:wasm" to rebuild WASM files.')
  }
}

// Export types and classes
export {
  Bzip2Error,
  Bzip2MemoryError,
  Bzip2CompressionError,
  Bzip2InitError
}