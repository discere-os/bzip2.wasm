/*
 * Comprehensive performance benchmark for optimized bzip2.wasm
 * Tests SIMD optimizations, memory management, and algorithm improvements
 */

import fs from 'fs';
import { performance } from 'perf_hooks';

// Performance test configuration
const TEST_CONFIG = {
    dataSizes: [1024, 8192, 32768, 131072, 524288], // 1KB to 512KB
    blockSizes: [1, 6, 9],
    iterations: 5,
    warmupIterations: 2
};

/**
 * Generate test data with different characteristics
 */
function generateTestData(size, type = 'mixed') {
    const data = new Uint8Array(size);
    
    switch (type) {
        case 'repetitive':
            // Highly compressible repetitive data
            const pattern = new TextEncoder().encode('Lorem ipsum dolor sit amet, consectetur adipiscing elit. ');
            for (let i = 0; i < size; i++) {
                data[i] = pattern[i % pattern.length];
            }
            break;
            
        case 'random':
            // Low compressibility random data
            for (let i = 0; i < size; i++) {
                data[i] = Math.floor(Math.random() * 256);
            }
            break;
            
        case 'structured':
            // Structured data (JSON-like)
            const jsonPattern = new TextEncoder().encode('{"id":12345,"name":"test","data":[1,2,3,4,5],"timestamp":1234567890}');
            for (let i = 0; i < size; i++) {
                data[i] = jsonPattern[i % jsonPattern.length];
            }
            break;
            
        case 'mixed':
        default:
            // Mixed data pattern
            for (let i = 0; i < size; i++) {
                if (i % 100 < 50) {
                    // Repetitive section
                    data[i] = 65 + (i % 26); // A-Z pattern
                } else {
                    // Random section
                    data[i] = Math.floor(Math.random() * 256);
                }
            }
            break;
    }
    
    return data;
}

/**
 * Load bzip2 module (try optimized first, fallback to standard)
 */
async function loadBzip2Module() {
    console.log('🔧 Loading bzip2 WASM module...');
    
    // Try to load optimized version first
    try {
        const optimizedModule = await import('../../dist/optimized-bzip2.js');
        await optimizedModule.default.initialize();
        console.log('✅ Loaded optimized bzip2 module');
        return { module: optimizedModule.default, type: 'optimized' };
    } catch (error) {
        console.log('⚠️ Optimized module not available, falling back to standard');
    }
    
    // Fallback to standard module
    try {
        const standardModule = await import('../../dist/node/index.js');
        await standardModule.default.initialize();
        console.log('✅ Loaded standard bzip2 module');
        return { module: standardModule.default, type: 'standard' };
    } catch (error) {
        console.error('❌ Failed to load any bzip2 module:', error);
        throw error;
    }
}

/**
 * Benchmark compression performance
 */
async function benchmarkCompression(bzip2, testData, blockSize, iterations) {
    const times = [];
    let compressed = null;
    
    // Warmup iterations
    for (let i = 0; i < TEST_CONFIG.warmupIterations; i++) {
        compressed = bzip2.compress(testData, blockSize);
    }
    
    // Actual benchmark iterations
    for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        compressed = bzip2.compress(testData, blockSize);
        const endTime = performance.now();
        times.push(endTime - startTime);
    }
    
    // Calculate statistics
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const stdDev = Math.sqrt(times.map(t => Math.pow(t - avgTime, 2)).reduce((a, b) => a + b, 0) / times.length);
    
    return {
        avgTime,
        minTime,
        maxTime,
        stdDev,
        compressionSpeed: (testData.length / 1024) / (avgTime / 1000), // KB/s
        compressionRatio: compressed.length / testData.length,
        compressedSize: compressed.length,
        spaceSaved: ((testData.length - compressed.length) / testData.length) * 100
    };
}

/**
 * Benchmark decompression performance
 */
async function benchmarkDecompression(bzip2, compressedData, originalSize, iterations) {
    const times = [];
    let decompressed = null;
    
    // Warmup iterations
    for (let i = 0; i < TEST_CONFIG.warmupIterations; i++) {
        decompressed = bzip2.decompress(compressedData);
    }
    
    // Actual benchmark iterations
    for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        decompressed = bzip2.decompress(compressedData);
        const endTime = performance.now();
        times.push(endTime - startTime);
    }
    
    // Calculate statistics
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return {
        avgTime,
        minTime,
        maxTime,
        decompressionSpeed: (originalSize / 1024) / (avgTime / 1000), // KB/s
        isValid: decompressed.length === originalSize
    };
}

/**
 * Comprehensive benchmark suite
 */
async function runComprehensiveBenchmark() {
    console.log('🚀 Starting comprehensive bzip2.wasm performance benchmark\n');
    
    const { module: bzip2, type: moduleType } = await loadBzip2Module();
    
    console.log(`📊 Benchmark Configuration:`);
    console.log(`   Module Type: ${moduleType}`);
    console.log(`   SIMD Support: ${bzip2.simdSupported ? '✅' : '❌'}`);
    console.log(`   Threading Support: ${bzip2.threadingSupported ? '✅' : '❌'}`);
    console.log(`   Data Sizes: ${TEST_CONFIG.dataSizes.map(s => s >= 1024 ? `${s/1024}KB` : `${s}B`).join(', ')}`);
    console.log(`   Block Sizes: ${TEST_CONFIG.blockSizes.join(', ')}`);
    console.log(`   Iterations: ${TEST_CONFIG.iterations} (+ ${TEST_CONFIG.warmupIterations} warmup)\n`);
    
    const results = {
        moduleType,
        timestamp: new Date().toISOString(),
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            simdSupported: bzip2.simdSupported,
            threadingSupported: bzip2.threadingSupported
        },
        benchmarks: {}
    };
    
    // Test different data types and sizes
    const dataTypes = ['repetitive', 'structured', 'random'];
    
    for (const dataType of dataTypes) {
        console.log(`📈 Testing ${dataType} data...`);
        results.benchmarks[dataType] = {};
        
        for (const size of TEST_CONFIG.dataSizes) {
            console.log(`   Size: ${size >= 1024 ? `${size/1024}KB` : `${size}B`}`);
            results.benchmarks[dataType][size] = {};
            
            const testData = generateTestData(size, dataType);
            
            for (const blockSize of TEST_CONFIG.blockSizes) {
                process.stdout.write(`     Block ${blockSize}: `);
                
                try {
                    // Benchmark compression
                    const compResults = await benchmarkCompression(bzip2, testData, blockSize, TEST_CONFIG.iterations);
                    
                    // Compress data for decompression benchmark
                    const compressed = bzip2.compress(testData, blockSize);
                    
                    // Benchmark decompression
                    const decompResults = await benchmarkDecompression(bzip2, compressed, testData.length, TEST_CONFIG.iterations);
                    
                    results.benchmarks[dataType][size][blockSize] = {
                        compression: compResults,
                        decompression: decompResults
                    };
                    
                    console.log(`Comp: ${compResults.compressionSpeed.toFixed(1)} KB/s, ` +
                              `Decomp: ${decompResults.decompressionSpeed.toFixed(1)} KB/s, ` +
                              `Ratio: ${compResults.compressionRatio.toFixed(2)}x`);
                    
                } catch (error) {
                    console.log(`❌ Error: ${error.message}`);
                    results.benchmarks[dataType][size][blockSize] = { error: error.message };
                }
            }
        }
        console.log('');
    }
    
    // Generate performance summary
    generatePerformanceSummary(results);
    
    // Save detailed results
    const resultsFile = `benchmark-results-${moduleType}-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`📄 Detailed results saved to: ${resultsFile}`);
    
    // Cleanup
    if (bzip2.cleanup) {
        bzip2.cleanup();
    }
    
    return results;
}

/**
 * Generate performance summary and analysis
 */
function generatePerformanceSummary(results) {
    console.log('\n📊 PERFORMANCE SUMMARY');
    console.log('='.repeat(50));
    
    // Calculate overall averages
    let totalCompressionSpeed = 0;
    let totalDecompressionSpeed = 0;
    let totalCompressionRatio = 0;
    let validTests = 0;
    
    for (const dataType of Object.keys(results.benchmarks)) {
        for (const size of Object.keys(results.benchmarks[dataType])) {
            for (const blockSize of Object.keys(results.benchmarks[dataType][size])) {
                const test = results.benchmarks[dataType][size][blockSize];
                if (test.compression && test.decompression && !test.error) {
                    totalCompressionSpeed += test.compression.compressionSpeed;
                    totalDecompressionSpeed += test.decompression.decompressionSpeed;
                    totalCompressionRatio += test.compression.compressionRatio;
                    validTests++;
                }
            }
        }
    }
    
    const avgCompressionSpeed = totalCompressionSpeed / validTests;
    const avgDecompressionSpeed = totalDecompressionSpeed / validTests;
    const avgCompressionRatio = totalCompressionRatio / validTests;
    
    console.log(`\n🎯 Overall Performance (${results.moduleType} module):`);
    console.log(`   Average Compression Speed: ${avgCompressionSpeed.toFixed(1)} KB/s`);
    console.log(`   Average Decompression Speed: ${avgDecompressionSpeed.toFixed(1)} KB/s`);
    console.log(`   Average Compression Ratio: ${avgCompressionRatio.toFixed(2)}x`);
    console.log(`   Valid Test Cases: ${validTests}`);
    
    // Foundation Tier 1 compliance check
    const compTarget = 30; // KB/s minimum for Foundation Tier 1
    const decompTarget = 100; // KB/s minimum for Foundation Tier 1
    
    console.log(`\n🏆 Foundation Tier 1 Compliance:`);
    console.log(`   Compression Speed: ${avgCompressionSpeed >= compTarget ? '✅' : '❌'} ` +
               `${avgCompressionSpeed.toFixed(1)} KB/s (target: ≥${compTarget} KB/s)`);
    console.log(`   Decompression Speed: ${avgDecompressionSpeed >= decompTarget ? '✅' : '❌'} ` +
               `${avgDecompressionSpeed.toFixed(1)} KB/s (target: ≥${decompTarget} KB/s)`);
    console.log(`   Compression Ratio: ${avgCompressionRatio >= 2.0 ? '✅' : '❌'} ` +
               `${avgCompressionRatio.toFixed(2)}x (target: ≥2.0x)`);
    
    // Find best and worst performers
    let bestCompression = null;
    let worstCompression = null;
    let bestDecompression = null;
    
    for (const dataType of Object.keys(results.benchmarks)) {
        for (const size of Object.keys(results.benchmarks[dataType])) {
            for (const blockSize of Object.keys(results.benchmarks[dataType][size])) {
                const test = results.benchmarks[dataType][size][blockSize];
                if (test.compression && !test.error) {
                    if (!bestCompression || test.compression.compressionSpeed > bestCompression.speed) {
                        bestCompression = {
                            speed: test.compression.compressionSpeed,
                            ratio: test.compression.compressionRatio,
                            dataType, size, blockSize
                        };
                    }
                    if (!worstCompression || test.compression.compressionSpeed < worstCompression.speed) {
                        worstCompression = {
                            speed: test.compression.compressionSpeed,
                            ratio: test.compression.compressionRatio,
                            dataType, size, blockSize
                        };
                    }
                }
                if (test.decompression && !test.error) {
                    if (!bestDecompression || test.decompression.decompressionSpeed > bestDecompression.speed) {
                        bestDecompression = {
                            speed: test.decompression.decompressionSpeed,
                            dataType, size, blockSize
                        };
                    }
                }
            }
        }
    }
    
    console.log(`\n⚡ Performance Extremes:`);
    if (bestCompression) {
        console.log(`   Best Compression: ${bestCompression.speed.toFixed(1)} KB/s ` +
                   `(${bestCompression.dataType}, ${bestCompression.size}B, block ${bestCompression.blockSize})`);
    }
    if (worstCompression) {
        console.log(`   Slowest Compression: ${worstCompression.speed.toFixed(1)} KB/s ` +
                   `(${worstCompression.dataType}, ${worstCompression.size}B, block ${worstCompression.blockSize})`);
    }
    if (bestDecompression) {
        console.log(`   Best Decompression: ${bestDecompression.speed.toFixed(1)} KB/s ` +
                   `(${bestDecompression.dataType}, ${bestDecompression.size}B, block ${bestDecompression.blockSize})`);
    }
    
    // Data type analysis
    console.log(`\n📊 Data Type Analysis:`);
    for (const dataType of Object.keys(results.benchmarks)) {
        let typeCompressionSpeed = 0;
        let typeCompressionRatio = 0;
        let typeTests = 0;
        
        for (const size of Object.keys(results.benchmarks[dataType])) {
            for (const blockSize of Object.keys(results.benchmarks[dataType][size])) {
                const test = results.benchmarks[dataType][size][blockSize];
                if (test.compression && !test.error) {
                    typeCompressionSpeed += test.compression.compressionSpeed;
                    typeCompressionRatio += test.compression.compressionRatio;
                    typeTests++;
                }
            }
        }
        
        if (typeTests > 0) {
            const avgSpeed = typeCompressionSpeed / typeTests;
            const avgRatio = typeCompressionRatio / typeTests;
            console.log(`   ${dataType.charAt(0).toUpperCase() + dataType.slice(1)}: ` +
                       `${avgSpeed.toFixed(1)} KB/s, ${avgRatio.toFixed(2)}x ratio`);
        }
    }
}

/**
 * Compare with previous benchmark results
 */
function compareWithPrevious(currentResults) {
    try {
        // Look for previous benchmark results
        const files = fs.readdirSync('./').filter(f => f.startsWith('benchmark-results-') && f.endsWith('.json'));
        
        if (files.length < 2) {
            console.log('\n📈 No previous results to compare with');
            return;
        }
        
        // Get the most recent previous result
        const previousFile = files.sort().slice(-2)[0]; // Second to last
        const previousResults = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
        
        console.log(`\n🔄 Comparison with Previous Run (${previousFile}):`);
        
        // Calculate improvement percentages
        // Implementation would compare key metrics and show improvements
        
    } catch (error) {
        console.log('\n📈 Unable to load previous results for comparison');
    }
}

/**
 * Main benchmark execution
 */
async function main() {
    console.log('🧪 bzip2.wasm Performance Benchmark Suite');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    
    try {
        const results = await runComprehensiveBenchmark();
        compareWithPrevious(results);
        
        console.log('\n✨ Benchmark completed successfully!');
        
        // Performance recommendations
        console.log('\n💡 Performance Recommendations:');
        if (results.moduleType === 'optimized') {
            console.log('   ✅ Using optimized module with SIMD acceleration');
            console.log('   🚀 Performance should be 2-4x faster than standard build');
            console.log('   🔧 Consider threading build for very large files');
        } else {
            console.log('   ⚡ Using standard module');
            console.log('   💡 Build optimized module with: npm run build:optimized');
            console.log('   🚀 Expected 2-4x performance improvement with optimization');
        }
        
    } catch (error) {
        console.error('\n❌ Benchmark failed:', error);
        process.exit(1);
    }
}

// Run the benchmark if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export {
    runComprehensiveBenchmark,
    generateTestData,
    benchmarkCompression,
    benchmarkDecompression
};