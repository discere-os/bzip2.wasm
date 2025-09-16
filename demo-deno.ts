/**
 * bzip2.wasm Deno Demo - Direct TypeScript execution
 * Run with: deno task demo
 */

import Bzip2 from './src/lib/index.ts'

async function demonstrateBzip2WASM() {
  console.log('bzip2.wasm Deno Demo')
  console.log('====================')

  const bzip2 = new Bzip2({
    simdOptimizations: true,
    maxMemoryMB: 256
  })

  try {
    // Initialize bzip2 with real WASM module
    console.log('Initializing bzip2.wasm...')
    await bzip2.initialize()
    console.log('bzip2.wasm initialized successfully')

    // Show capabilities
    const capabilities = bzip2.getCapabilities()
    console.log(`Version: ${capabilities.version}`)
    console.log(`SIMD Support: ${capabilities.simdSupported}`)
    console.log(`Max Memory: ${capabilities.maxMemoryMB}MB`)

    // Create test data
    const testText = 'Hello, bzip2.wasm! This is a test string for compression. '.repeat(20)
    const testData = new TextEncoder().encode(testText)
    console.log(`Test data: ${testData.length} bytes`)

    // Test compression with different block sizes
    const blockSizes = [1, 6, 9]

    for (const blockSize of blockSizes) {
      console.log(`\n--- Block Size ${blockSize} ---`)

      const compressed = await bzip2.compress(testData, {
        blockSize: blockSize as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
      })

      console.log(`Original: ${compressed.originalSize} bytes`)
      console.log(`Compressed: ${compressed.compressedSize} bytes`)
      console.log(`Ratio: ${compressed.compressionRatio.toFixed(2)}:1`)
      console.log(`Time: ${compressed.processingTime.toFixed(2)}ms`)
      console.log(`SIMD: ${compressed.simdAccelerated}`)

      // Test decompression
      const decompressed = await bzip2.decompress(compressed.data)
      console.log(`Decompression: ${decompressed.processingTime.toFixed(2)}ms`)

      // Verify integrity
      const decompressedText = new TextDecoder().decode(decompressed.data)
      const integrity = testText === decompressedText
      console.log(`Integrity: ${integrity ? 'OK' : 'FAILED'}`)
    }

    // Performance metrics
    const metrics = bzip2.getPerformanceMetrics()
    console.log(`\n--- Performance Summary ---`)
    console.log(`Compression operations: ${metrics.compressionOps}`)
    console.log(`Decompression operations: ${metrics.decompressionOps}`)
    console.log(`Average compression speed: ${metrics.averageCompressionSpeed.toFixed(1)} KB/s`)
    console.log(`Average decompression speed: ${metrics.averageDecompressionSpeed.toFixed(1)} KB/s`)

    // Cleanup
    bzip2.cleanup()
    console.log('\nDemo completed successfully')

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Demo failed:', errorMessage)
    console.error('This may occur if WASM modules need rebuilding')
    console.error('Run "deno task build:wasm" to rebuild WASM files')
    Deno.exit(1)
  }
}

// Run the demo
if (import.meta.main) {
  demonstrateBzip2WASM()
}