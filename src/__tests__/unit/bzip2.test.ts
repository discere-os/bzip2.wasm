/**
 * Comprehensive unit tests for bzip2.wasm
 * Type-safe testing with real browser environment
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import Bzip2 from '../../lib/index.js'
import type { CompressionOptions } from '../../lib/types.js'

describe('bzip2.wasm Core Functionality', () => {
  let bzip2: Bzip2

  beforeAll(async () => {
    bzip2 = new Bzip2()
    await bzip2.initialize()
  })

  afterAll(() => {
    bzip2.cleanup()
  })

  describe('Module Initialization', () => {
    test('should initialize successfully', () => {
      expect(bzip2).toBeDefined()
    })

    test('should report system capabilities', () => {
      const capabilities = bzip2.getSystemCapabilities()
      expect(capabilities.wasmSupported).toBe(true)
      expect(typeof capabilities.simdSupported).toBe('boolean')
    })

    test('should provide version information', () => {
      const version = bzip2.getVersion()
      expect(version).toMatch(/^\d+\.\d+\.\d+/)
    })
  })

  describe('Compression', () => {
    const testCases = [
      { name: 'empty string', data: '' },
      { name: 'short text', data: 'Hello, World!' },
      { name: 'repetitive text', data: 'A'.repeat(1000) },
      { name: 'lorem ipsum', data: 'Lorem ipsum dolor sit amet, '.repeat(50) }
    ]

    testCases.forEach(({ name, data }) => {
      test(`should compress and decompress ${name}`, () => {
        if (data === '') {
          // Empty data should throw error
          const input = new TextEncoder().encode(data)
          expect(() => bzip2.compress(input)).toThrow('Input data cannot be empty')
          return
        }

        const input = new TextEncoder().encode(data)
        const result = bzip2.compress(input)

        expect(result.compressed).toBeInstanceOf(Uint8Array)
        expect(result.compressionRatio).toBeGreaterThan(0)
        expect(result.compressionTime).toBeGreaterThan(0)
        expect(result.compressionSpeed).toBeGreaterThan(0)

        // Validate decompression
        const decompResult = bzip2.decompress(result.compressed)
        expect(decompResult.decompressed.length).toBe(input.length)
        expect(decompResult.isValid).toBe(true)

        // Verify data integrity
        const decompressed = new TextDecoder().decode(decompResult.decompressed)
        expect(decompressed).toBe(data)
      })
    })

    test('should handle different block sizes', () => {
      const input = new TextEncoder().encode('Test data for block size validation')
      
      const blockSizes: Array<CompressionOptions['blockSize']> = [1, 6, 9]
      
      blockSizes.forEach(blockSize => {
        const result = bzip2.compress(input, { blockSize })
        expect(result.compressed).toBeInstanceOf(Uint8Array)
        expect(result.compressionRatio).toBeGreaterThan(0)
        
        // Verify decompression works
        const decompressed = bzip2.decompress(result.compressed)
        expect(decompressed.decompressed.length).toBe(input.length)
      })
    })

    test('should reject invalid block sizes', () => {
      const input = new TextEncoder().encode('Test data')
      
      expect(() => bzip2.compress(input, { blockSize: 0 as any })).toThrow('Block size must be between 1 and 9')
      expect(() => bzip2.compress(input, { blockSize: 10 as any })).toThrow('Block size must be between 1 and 9')
    })
  })

  describe('Performance Metrics', () => {
    test('should track performance metrics', () => {
      const initialMetrics = bzip2.getPerformanceMetrics()
      expect(initialMetrics.compressionOps).toBeGreaterThanOrEqual(0)
      expect(initialMetrics.decompressionOps).toBeGreaterThanOrEqual(0)
      
      // Perform operation to update metrics
      const input = new TextEncoder().encode('Metrics test data')
      bzip2.compress(input)
      
      const updatedMetrics = bzip2.getPerformanceMetrics()
      expect(updatedMetrics.compressionOps).toBe(initialMetrics.compressionOps + 1)
      expect(updatedMetrics.averageCompressionSpeed).toBeGreaterThan(0)
    })

    test('should reset metrics', () => {
      // Perform operations
      const input = new TextEncoder().encode('Reset test data')
      bzip2.compress(input)
      
      // Reset and verify
      bzip2.resetMetrics()
      const metrics = bzip2.getPerformanceMetrics()
      expect(metrics.compressionOps).toBe(0)
      expect(metrics.decompressionOps).toBe(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid compressed data', () => {
      const invalidData = new Uint8Array([1, 2, 3, 4, 5])
      expect(() => bzip2.decompress(invalidData)).toThrow('Decompression failed')
    })

    test('should provide meaningful error messages', () => {
      try {
        const invalidData = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF])
        bzip2.decompress(invalidData)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Decompression failed')
      }
    })
  })

  describe('Utility Functions', () => {
    test('should calculate compression bounds accurately', () => {
      const sizes = [100, 1000, 10000, 100000]
      
      sizes.forEach(size => {
        const bound = bzip2.getCompressBound(size)
        expect(bound).toBeGreaterThan(size)
        expect(bound).toBeLessThan(size + 2000) // bzip2 has generous safety margin
      })
    })
  })
})

describe('bzip2.wasm System Integration', () => {
  test('should detect SIMD support correctly', () => {
    const bzip2 = new Bzip2()
    const capabilities = bzip2.getSystemCapabilities()
    
    // SIMD support should be boolean
    expect(typeof capabilities.simdSupported).toBe('boolean')
    
    // WebAssembly should be supported in test environment
    if (typeof WebAssembly !== 'undefined') {
      expect(capabilities.wasmSupported).toBe(true)
    }
  })

  test('should handle environment detection', () => {
    // Test environment detection without DOM dependencies
    const isNode = typeof process !== 'undefined' && process.versions?.node
    const isBrowser = typeof window !== 'undefined'
    
    expect(typeof isNode === 'string' || isNode === undefined).toBe(true)
    expect(typeof isBrowser).toBe('boolean')
  })
})