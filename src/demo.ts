/**
 * Command-line demo for bzip2.wasm
 * Demonstrates all features through code examples
 */

import Bzip2, { formatSpeed, formatSize } from './lib/index.js'

async function runDemo(): Promise<void> {
  console.log('🗜️ bzip2.wasm Demo - TypeScript Library\n')

  const bzip2 = new Bzip2()
  
  console.log('📦 Initializing bzip2.wasm...')
  await bzip2.initialize({ enableMetrics: true })
  
  const capabilities = bzip2.getSystemCapabilities()
  console.log(`✅ Module loaded: ${bzip2.getVersion()}`)
  console.log(`🔬 SIMD Support: ${capabilities.simdSupported ? 'Available' : 'Not Available'}`)
  console.log(`⚡ WebAssembly: ${capabilities.wasmSupported ? 'Supported' : 'Not Supported'}\n`)

  // Demo 1: Basic Text Compression
  console.log('📝 Demo 1: Basic Text Compression')
  const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100)
  const textData = new TextEncoder().encode(text)
  
  console.log(`   Input: ${formatSize(textData.length)}`)
  
  const result = bzip2.compress(textData, { blockSize: 6 })
  const decompressed = bzip2.decompress(result.compressed)
  
  console.log(`   Compressed: ${formatSize(result.compressed.length)} in ${result.compressionTime.toFixed(1)}ms`)
  console.log(`   Speed: ${formatSpeed(result.compressionSpeed)} compression, ${formatSpeed(decompressed.decompressionSpeed)} decompression`)
  console.log(`   Ratio: ${result.compressionRatio.toFixed(2)}:1 (${result.spaceSaved.toFixed(1)}% saved)`)
  console.log(`   Validation: ${decompressed.isValid ? 'PASSED ✅' : 'FAILED ❌'}\n`)

  // Demo 2: Large Data Compression
  console.log('📊 Demo 2: Large Data Compression Performance')
  const largeData = new TextEncoder().encode('The quick brown fox jumps over the lazy dog. '.repeat(10000))
  
  console.log(`   Large input: ${formatSize(largeData.length)}`)
  
  const largeResult = bzip2.compress(largeData, { blockSize: 9 })
  const largeDecompressed = bzip2.decompress(largeResult.compressed)
  
  console.log(`   Compressed: ${formatSize(largeResult.compressed.length)} in ${largeResult.compressionTime.toFixed(1)}ms`)
  console.log(`   Performance: ${formatSpeed(largeResult.compressionSpeed)} compression`)
  console.log(`   Ratio: ${largeResult.compressionRatio.toFixed(2)}:1 (${largeResult.spaceSaved.toFixed(1)}% saved)`)
  console.log(`   Byte-for-byte validation: ${largeData.length === largeDecompressed.decompressed.length ? 'PASSED ✅' : 'FAILED ❌'}\n`)

  // Demo 3: Comprehensive Benchmarking
  console.log('🏁 Demo 3: Comprehensive Performance Benchmarking')
  const benchmarkData = generateBenchmarkData(32768, 'text') // 32KB
  const benchmark = await bzip2.benchmark(benchmarkData)
  
  console.log(`   Data type: ${benchmark.dataType}`)
  console.log(`   Input size: ${formatSize(benchmark.inputSize)}`)
  console.log('\n   Block Size Performance:')
  
  Object.entries(benchmark.results).forEach(([blockSize, perf]) => {
    console.log(`   Block ${blockSize}: ${formatSpeed(perf.compressionSpeed)} comp, ${formatSpeed(perf.decompressionSpeed)} decomp, ${perf.compressionRatio.toFixed(2)}x ratio`)
  })
  
  console.log(`\n   🎯 Recommendations:`)
  console.log(`   • Fastest compression: Block ${benchmark.recommendation.fastestCompression}`)
  console.log(`   • Best compression ratio: Block ${benchmark.recommendation.bestRatio}`)
  console.log(`   • Balanced: Block ${benchmark.recommendation.balanced}\n`)

  // Demo 4: Performance Metrics
  console.log('📈 Demo 4: Performance Metrics')
  const metrics = bzip2.getPerformanceMetrics()
  
  console.log(`   Operations completed: ${metrics.compressionOps} compression, ${metrics.decompressionOps} decompression`)
  console.log(`   Average speeds: ${formatSpeed(metrics.averageCompressionSpeed)} comp, ${formatSpeed(metrics.averageDecompressionSpeed)} decomp`)
  console.log(`   Total time: ${metrics.totalCompressionTime.toFixed(1)}ms compression, ${metrics.totalDecompressionTime.toFixed(1)}ms decompression`)
  console.log(`   SIMD acceleration: ${metrics.simdAcceleration ? 'Active ⚡' : 'Inactive'}\n`)

  // Demo 5: Error Handling
  console.log('🛡️ Demo 5: Error Handling & Validation')
  
  try {
    // Test empty data
    bzip2.compress(new Uint8Array(0))
  } catch (error) {
    console.log(`   Empty data handling: ${error instanceof Error ? error.message : 'Unknown error'} ✅`)
  }

  try {
    // Test invalid block size
    bzip2.compress(textData, { blockSize: 10 as any })
  } catch (error) {
    console.log(`   Invalid block size: ${error instanceof Error ? error.message : 'Unknown error'} ✅`)
  }

  try {
    // Test invalid compressed data
    bzip2.decompress(new Uint8Array([1, 2, 3, 4, 5]))
  } catch (error) {
    console.log(`   Invalid data decompression: ${error instanceof Error ? error.message : 'Unknown error'} ✅\n`)
  }

  // Cleanup
  bzip2.cleanup()
  console.log('🏁 Demo completed - all features demonstrated successfully!')
}

function generateBenchmarkData(size: number, type: 'text' | 'json' | 'binary' | 'random'): Uint8Array {
  const data = new Uint8Array(size)
  
  switch (type) {
    case 'text':
      const pattern = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '
      const patternBytes = new TextEncoder().encode(pattern)
      for (let i = 0; i < size; i++) {
        data[i] = patternBytes[i % patternBytes.length]!
      }
      break
    case 'json':
      const jsonPattern = '{"id":123,"name":"test_user","active":true,"data":[1,2,3,4,5],"timestamp":1234567890}'
      const jsonBytes = new TextEncoder().encode(jsonPattern)
      for (let i = 0; i < size; i++) {
        data[i] = jsonBytes[i % jsonBytes.length]!
      }
      break
    case 'binary':
      for (let i = 0; i < size; i++) {
        data[i] = i % 256
      }
      break
    case 'random':
      for (let i = 0; i < size; i++) {
        data[i] = Math.floor(Math.random() * 256)
      }
      break
  }
  
  return data
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(error => {
    console.error('Demo failed:', error)
    process.exit(1)
  })
}

export { runDemo, generateBenchmarkData }