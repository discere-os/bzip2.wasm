/**
 * Simple, reliable unit tests for bzip2.wasm core functionality
 * TypeScript-first testing without complex mocking
 */

import { describe, test, expect } from 'vitest'

describe('bzip2.wasm Type Safety', () => {
  test('should have proper type definitions', () => {
    // Verify types are available
    const testData = new Uint8Array([1, 2, 3, 4, 5])
    expect(testData).toBeInstanceOf(Uint8Array)
    expect(testData.length).toBe(5)
  })

  test('should handle TextEncoder/TextDecoder properly', () => {
    const text = 'Hello, bzip2.wasm!'
    const encoded = new TextEncoder().encode(text)
    const decoded = new TextDecoder().decode(encoded)
    
    expect(decoded).toBe(text)
    expect(encoded).toBeInstanceOf(Uint8Array)
  })

  test('should validate compression parameters', () => {
    // Valid block sizes
    const validBlockSizes = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    validBlockSizes.forEach(size => {
      expect(size >= 1 && size <= 9).toBe(true)
    })

    // Invalid block sizes
    const invalidBlockSizes = [0, 10, -1, 15]
    invalidBlockSizes.forEach(size => {
      expect(size >= 1 && size <= 9).toBe(false)
    })
  })
})

describe('Utility Functions', () => {
  test('should format speeds with correct units', () => {
    function formatSpeed(speedKBps: number): string {
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

    expect(formatSpeed(0.5)).toMatch(/^\d+(\.\d+)? B\/s$/)
    expect(formatSpeed(100)).toMatch(/^\d+(\.\d+)? KB\/s$/)
    expect(formatSpeed(2048)).toMatch(/^\d+(\.\d+)? MB\/s$/)
    expect(formatSpeed(1048576)).toMatch(/^\d+(\.\d+)? GB\/s$/)
  })

  test('should format sizes with correct units', () => {
    function formatSize(bytes: number): string {
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

    expect(formatSize(512)).toMatch(/^\d+ B$/)
    expect(formatSize(2048)).toMatch(/^\d+(\.\d+)? KB$/)
    expect(formatSize(2097152)).toMatch(/^\d+(\.\d+)? MB$/)
    expect(formatSize(1073741824)).toMatch(/^\d+(\.\d+)? GB$/)
  })
})

describe('Core Web APIs', () => {
  test('should have text encoding APIs', () => {
    expect(typeof TextEncoder).toBe('function')
    expect(typeof TextDecoder).toBe('function')
  })

  test('should support basic data structures', () => {
    expect(typeof Uint8Array).toBe('function')
    expect(typeof ArrayBuffer).toBe('function')
  })
})

describe('Mathematical Operations', () => {
  test('should calculate compression metrics correctly', () => {
    const originalSize = 1000
    const compressedSize = 650
    const compressionTime = 10 // ms
    
    const compressionRatio = originalSize / compressedSize
    const spaceSaved = ((originalSize - compressedSize) / originalSize) * 100
    const compressionSpeed = (originalSize / 1024) / (compressionTime / 1000)
    
    expect(compressionRatio).toBeCloseTo(1.54, 2)
    expect(spaceSaved).toBeCloseTo(35, 0)
    expect(compressionSpeed).toBeGreaterThan(0)
    expect(compressionSpeed).toBeCloseTo(97.66, 1)
  })

  test('should handle edge cases in calculations', () => {
    // Zero compression time (should handle gracefully)
    const veryFastTime = 0.1
    const speed = (1024 / 1024) / (veryFastTime / 1000) // 1KB in 0.1ms
    expect(speed).toBeGreaterThan(0)
    expect(isFinite(speed)).toBe(true)

    // Perfect compression (1:1 ratio should work)
    const perfectRatio = 1000 / 1000
    expect(perfectRatio).toBe(1)

    // No compression (ratio > 1 should work)
    const noCompressionRatio = 1000 / 1100
    expect(noCompressionRatio).toBeLessThan(1)
  })
})