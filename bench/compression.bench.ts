/**
 * bzip2.wasm Deno Benchmarks - Performance analysis with SIMD
 * Run with: deno task benchmark
 */

import Bzip2 from "../src/lib/index.ts";

// Test data generators
function generateTextData(size: number): Uint8Array {
  const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(
    Math.ceil(size / 55)
  );
  return new TextEncoder().encode(text.slice(0, size));
}

function generateRandomData(size: number): Uint8Array {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  return data;
}

function generateRepeatingData(size: number): Uint8Array {
  const pattern = "ABCD".repeat(64); // 256 bytes repeating
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = pattern.charCodeAt(i % pattern.length);
  }
  return data;
}

async function runBenchmarks() {
  console.log("bzip2.wasm Performance Benchmarks");
  console.log("=================================");

  const bzip2 = new Bzip2({
    simdOptimizations: true,
    maxMemoryMB: 512
  });

  try {
    // Initialize bzip2
    await bzip2.initialize();
    console.log("bzip2.wasm initialized successfully");

    // System capabilities
    const capabilities = bzip2.getCapabilities();
    console.log("\n=== SYSTEM INFORMATION ===");
    console.log("━".repeat(40));
    console.log(`bzip2 Version:     ${capabilities.version}`);
    console.log(`SIMD Support:      ${capabilities.simdSupported ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`SIMD Features:     ${'None' /* TODO: implement simdCapabilities */}`);
    console.log(`Max Memory:        ${capabilities.maxMemoryMB} MB`);

    // Data sizes to benchmark
    const dataSizes = [
      { size: 1024, name: "1KB" },
      { size: 10240, name: "10KB" },
      { size: 51200, name: "50KB" }  // Reduced from 100KB to avoid buffer issues
    ];

    // Block sizes to test
    const blockSizes = [
      { blockSize: 1, name: "Fast" },
      { blockSize: 6, name: "Default" },
      { blockSize: 9, name: "Maximum" }
    ];

    console.log("\n=== COMPRESSION BENCHMARK ===");

    for (const dataSize of dataSizes) {
      console.log(`\n📊 ${dataSize.name} Test Data (${dataSize.size.toLocaleString()} bytes):`);
      console.log("━".repeat(50));

      for (const blockSize of blockSizes) {
        // Generate test data
        const testData = generateTextData(dataSize.size);

        // Run compression benchmark
        const iterations = Math.max(1, Math.floor(1000000 / dataSize.size));
        const benchResult = await bzip2.benchmark(testData, iterations);

        // Extract results for the current block size
        const blockResult = benchResult.results[blockSize.blockSize];
        const compressionResult = blockResult ? {
          throughput: blockResult.compressionSpeed / 1024 // Convert KB/s to MB/s
        } : null;
        const decompressionResult = blockResult ? {
          throughput: blockResult.decompressionSpeed / 1024 // Convert KB/s to MB/s
        } : null;

        if (compressionResult && decompressionResult) {
          // Get actual compression ratio
          const compressed = await bzip2.compress(testData, { blockSize: blockSize.blockSize as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });

          console.log(`\n${blockSize.name} Compression (Block Size ${blockSize.blockSize}):`);
          console.log(`  Original size:     ${testData.length.toLocaleString()} bytes`);
          console.log(`  Compressed size:   ${compressed.compressedSize.toLocaleString()} bytes`);
          console.log(`  Compression ratio: ${compressed.compressionRatio.toFixed(1)}:1`);
          console.log(`  Space saved:       ${(((testData.length - compressed.compressedSize) / testData.length) * 100).toFixed(1)}%`);
          console.log(`  Compression speed: ${compressionResult.throughput.toFixed(1)} MB/s`);
          console.log(`  Decompression:     ${decompressionResult.throughput.toFixed(1)} MB/s`);
          console.log(`  Iterations tested: ${iterations.toLocaleString()}`);
        }
      }
    }

    console.log("\n=== LARGE DATA EFFICIENCY ===");

    const memoryTestSizes = [1024 * 1024, 10 * 1024 * 1024]; // 1MB, 10MB

    for (const size of memoryTestSizes) {
      const sizeName = (size / 1024 / 1024).toFixed(0) + "MB";
      console.log(`\n📈 ${sizeName} Large Data Test:`);
      console.log("━".repeat(30));

      const testData = generateTextData(size);
      const startTime = performance.now();
      const compressed = await bzip2.compress(testData);
      const endTime = performance.now();

      const processingTime = (endTime - startTime) / 1000;
      const compressionPct = ((compressed.compressedSize / size) * 100);
      const spaceSaved = (((size - compressed.compressedSize) / size) * 100);
      const processingRate = (size / 1024 / 1024) / processingTime;

      console.log(`  Original size:      ${size.toLocaleString()} bytes`);
      console.log(`  Compressed size:    ${compressed.compressedSize.toLocaleString()} bytes`);
      console.log(`  Compression ratio:  ${compressed.compressionRatio.toFixed(1)}x smaller`);
      console.log(`  Space saved:        ${spaceSaved.toFixed(1)}%`);
      console.log(`  Processing time:    ${(processingTime * 1000).toFixed(1)}ms`);
      console.log(`  Processing speed:   ${processingRate.toFixed(1)} MB/s`);
    }

    // Performance metrics summary
    console.log("\n=== PERFORMANCE SUMMARY ===");
    const metrics = bzip2.getPerformanceMetrics();
    console.log("━".repeat(40));
    console.log(`Total operations:      ${metrics.compressionOps + metrics.decompressionOps}`);
    console.log(`Compression ops:       ${metrics.compressionOps}`);
    console.log(`Decompression ops:     ${metrics.decompressionOps}`);
    console.log(`Avg compression speed: ${metrics.averageCompressionSpeed.toFixed(1)} KB/s`);
    console.log(`Avg decompression:     ${metrics.averageDecompressionSpeed.toFixed(1)} KB/s`);
    console.log(`SIMD acceleration:     ${metrics.simdAcceleration ? '✅ Active' : '❌ Inactive'}`);

    bzip2.cleanup();
    console.log("\nBenchmark completed successfully");

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Benchmark failed:", errorMessage);
    console.error("This may occur if WASM modules need rebuilding");
    console.error("Run 'deno task build:wasm' to rebuild WASM files");
    Deno.exit(1);
  }
}

// Deno benchmark integration
Deno.bench("bzip2 compression - 1KB text", async () => {
  const bzip2 = new Bzip2();
  await bzip2.initialize();
  const data = generateTextData(1024);
  await bzip2.compress(data);
  bzip2.cleanup();
});

Deno.bench("bzip2 compression - 10KB text", {
  group: "compression",
  baseline: true
}, async () => {
  const bzip2 = new Bzip2();
  await bzip2.initialize();
  const data = generateTextData(10240);
  await bzip2.compress(data);
  bzip2.cleanup();
});

Deno.bench("bzip2 compression - 100KB text", {
  group: "compression"
}, async () => {
  const bzip2 = new Bzip2();
  await bzip2.initialize();
  const data = generateTextData(102400);
  await bzip2.compress(data);
  bzip2.cleanup();
});

// Run comprehensive benchmarks if called directly
if (import.meta.main) {
  runBenchmarks();
}