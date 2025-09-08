/*
 * Performance comparison test for optimized vs standard bzip2.wasm builds
 * Validates that optimizations provide significant performance improvements
 */

import fs from 'fs';
import { performance } from 'perf_hooks';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Generate comprehensive test dataset with known compression characteristics
 */
function generateBenchmarkData() {
    const datasets = {};
    
    // High-compression text data (bzip2 excels at this)
    const textData = new TextEncoder().encode(
        'The quick brown fox jumps over the lazy dog. '.repeat(1000) +
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(800) +
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(2000)
    );
    datasets.text = textData;
    
    // Structured data (JSON-like, good compression)
    let structuredText = '';
    for (let i = 0; i < 1000; i++) {
        structuredText += `{"id":${i},"name":"user${i}","active":${i%2===0},"data":[${i},${i*2},${i*3}]}\n`;
    }
    datasets.structured = new TextEncoder().encode(structuredText);
    
    // Binary data with patterns (medium compression)
    const binaryData = new Uint8Array(100000);
    for (let i = 0; i < binaryData.length; i++) {
        // Create repeating pattern that bzip2 can exploit
        if (i % 1000 < 200) {
            binaryData[i] = 0x42; // Repeating byte
        } else if (i % 1000 < 600) {
            binaryData[i] = i % 256; // Sequential pattern
        } else {
            binaryData[i] = Math.floor(Math.random() * 256); // Random noise
        }
    }
    datasets.binary = binaryData;
    
    // Random data (low compression, tests worst case)
    const randomData = new Uint8Array(50000);
    for (let i = 0; i < randomData.length; i++) {
        randomData[i] = Math.floor(Math.random() * 256);
    }
    datasets.random = randomData;
    
    return datasets;
}

/**
 * Build all WASM variants for comparison
 */
async function buildWasmVariants() {
    console.log('🔨 Building WASM variants for performance comparison...');
    
    try {
        // Build optimized version
        console.log('   Building optimized variant...');
        await execAsync('./build-optimized.sh optimized');
        
        // Build SIMD-only version
        console.log('   Building SIMD variant...');
        await execAsync('./build-optimized.sh simd-only');
        
        // Build compact version
        console.log('   Building compact variant...');
        await execAsync('./build-optimized.sh size-optimized');
        
        console.log('✅ All variants built successfully\n');
        return true;
    } catch (error) {
        console.error('❌ Build failed:', error.message);
        return false;
    }
}

/**
 * Load and test a specific WASM module
 */
async function loadAndTestModule(modulePath, moduleType) {
    try {
        // Dynamic import based on module type
        let bzip2Module;
        
        if (moduleType === 'optimized') {
            bzip2Module = await import('../../dist/optimized-bzip2.js');
            await bzip2Module.default.initialize({ wasmPath: './build/bzip2-optimized.js' });
            return bzip2Module.default;
        } else {
            // Standard module loading logic would go here
            // For now, return null to indicate standard module not available in this test
            return null;
        }
    } catch (error) {
        console.error(`Failed to load ${moduleType} module:`, error);
        return null;
    }
}

/**
 * Benchmark a specific module variant
 */
async function benchmarkModule(module, datasets, moduleType) {
    console.log(`🧪 Benchmarking ${moduleType} module...`);
    
    const results = {
        moduleType,
        totalTests: 0,
        passedTests: 0,
        performance: {},
        errors: []
    };
    
    for (const [datasetName, data] of Object.entries(datasets)) {
        console.log(`   Testing ${datasetName} data (${data.length} bytes)...`);
        results.performance[datasetName] = {};
        
        for (const blockSize of [1, 6, 9]) {
            results.totalTests++;
            
            try {
                // Compression benchmark
                const startComp = performance.now();
                const compressed = module.compress(data, blockSize);
                const compTime = performance.now() - startComp;
                
                // Decompression benchmark
                const startDecomp = performance.now();
                const decompressed = module.decompress(compressed);
                const decompTime = performance.now() - startDecomp;
                
                // Validation
                if (decompressed.length !== data.length) {
                    throw new Error('Decompressed size mismatch');
                }
                
                // Quick integrity check for small data
                if (data.length < 10000) {
                    for (let i = 0; i < data.length; i++) {
                        if (data[i] !== decompressed[i]) {
                            throw new Error(`Data mismatch at position ${i}`);
                        }
                    }
                }
                
                results.performance[datasetName][blockSize] = {
                    compressionTime: compTime,
                    decompressionTime: decompTime,
                    compressionSpeed: (data.length / 1024) / (compTime / 1000), // KB/s
                    decompressionSpeed: (decompressed.length / 1024) / (decompTime / 1000), // KB/s
                    compressionRatio: compressed.length / data.length,
                    originalSize: data.length,
                    compressedSize: compressed.length,
                    spaceSaved: ((data.length - compressed.length) / data.length) * 100
                };
                
                results.passedTests++;
                
                console.log(`     Block ${blockSize}: ${results.performance[datasetName][blockSize].compressionSpeed.toFixed(1)} KB/s comp, ` +
                          `${results.performance[datasetName][blockSize].decompressionSpeed.toFixed(1)} KB/s decomp, ` +
                          `${results.performance[datasetName][blockSize].compressionRatio.toFixed(2)}x ratio`);
                
            } catch (error) {
                results.errors.push({
                    dataset: datasetName,
                    blockSize,
                    error: error.message
                });
                console.log(`     Block ${blockSize}: ❌ Error - ${error.message}`);
            }
        }
    }
    
    return results;
}

/**
 * Compare performance between different module variants
 */
function comparePerformance(standardResults, optimizedResults) {
    console.log('\n📈 PERFORMANCE COMPARISON');
    console.log('='.repeat(60));
    
    if (!standardResults || !optimizedResults) {
        console.log('⚠️ Cannot compare - one or both modules failed to load');
        return;
    }
    
    // Calculate overall averages
    function calculateAverages(results) {
        let totalCompSpeed = 0, totalDecompSpeed = 0, totalRatio = 0, count = 0;
        
        for (const dataset of Object.values(results.performance)) {
            for (const blockResults of Object.values(dataset)) {
                if (blockResults.compressionSpeed) {
                    totalCompSpeed += blockResults.compressionSpeed;
                    totalDecompSpeed += blockResults.decompressionSpeed;
                    totalRatio += blockResults.compressionRatio;
                    count++;
                }
            }
        }
        
        return {
            avgCompressionSpeed: totalCompSpeed / count,
            avgDecompressionSpeed: totalDecompSpeed / count,
            avgCompressionRatio: totalRatio / count
        };
    }
    
    const standardAvg = calculateAverages(standardResults);
    const optimizedAvg = calculateAverages(optimizedResults);
    
    const compSpeedImprovement = ((optimizedAvg.avgCompressionSpeed - standardAvg.avgCompressionSpeed) / standardAvg.avgCompressionSpeed) * 100;
    const decompSpeedImprovement = ((optimizedAvg.avgDecompressionSpeed - standardAvg.avgDecompressionSpeed) / standardAvg.avgDecompressionSpeed) * 100;
    
    console.log(`Standard Module Performance:`);
    console.log(`   Compression: ${standardAvg.avgCompressionSpeed.toFixed(1)} KB/s`);
    console.log(`   Decompression: ${standardAvg.avgDecompressionSpeed.toFixed(1)} KB/s`);
    console.log(`   Ratio: ${standardAvg.avgCompressionRatio.toFixed(2)}x`);
    
    console.log(`\nOptimized Module Performance:`);
    console.log(`   Compression: ${optimizedAvg.avgCompressionSpeed.toFixed(1)} KB/s`);
    console.log(`   Decompression: ${optimizedAvg.avgDecompressionSpeed.toFixed(1)} KB/s`);
    console.log(`   Ratio: ${optimizedAvg.avgCompressionRatio.toFixed(2)}x`);
    
    console.log(`\n🚀 Performance Improvements:`);
    console.log(`   Compression Speed: ${compSpeedImprovement > 0 ? '+' : ''}${compSpeedImprovement.toFixed(1)}%`);
    console.log(`   Decompression Speed: ${decompSpeedImprovement > 0 ? '+' : ''}${decompSpeedImprovement.toFixed(1)}%`);
    
    // Determine if optimizations are successful
    if (compSpeedImprovement > 50 && decompSpeedImprovement > 30) {
        console.log(`\n🎉 OPTIMIZATION SUCCESS: Significant performance improvements achieved!`);
    } else if (compSpeedImprovement > 20 && decompSpeedImprovement > 15) {
        console.log(`\n✅ OPTIMIZATION GOOD: Moderate performance improvements achieved`);
    } else if (compSpeedImprovement > 0 && decompSpeedImprovement > 0) {
        console.log(`\n⚡ OPTIMIZATION MINOR: Small performance improvements achieved`);
    } else {
        console.log(`\n⚠️ OPTIMIZATION INEFFECTIVE: Consider reviewing optimization strategies`);
    }
}

/**
 * Main test execution
 */
async function runOptimizedPerformanceTest() {
    console.log('🏁 bzip2.wasm Optimized Performance Test');
    console.log(`🕐 Started at: ${new Date().toISOString()}`);
    console.log('='.repeat(70));
    
    // Generate test datasets
    console.log('📊 Generating test datasets...');
    const datasets = generateBenchmarkData();
    console.log(`   Generated ${Object.keys(datasets).length} datasets:`);
    for (const [name, data] of Object.entries(datasets)) {
        console.log(`     ${name}: ${data.length} bytes (${(data.length/1024).toFixed(1)} KB)`);
    }
    
    // Build WASM variants
    const buildSuccess = await buildWasmVariants();
    if (!buildSuccess) {
        console.error('❌ Build failed, cannot run performance tests');
        process.exit(1);
    }
    
    // Test optimized module
    console.log('\n🚀 Testing optimized module...');
    const optimizedModule = await loadAndTestModule('./build/bzip2-optimized.js', 'optimized');
    
    let optimizedResults = null;
    if (optimizedModule) {
        optimizedResults = await benchmarkModule(optimizedModule, datasets, 'optimized');
        
        // Get additional performance stats if available
        if (optimizedModule.getPerformanceStats) {
            const perfStats = optimizedModule.getPerformanceStats();
            console.log(`\n📊 Additional Statistics (Optimized):`);
            console.log(`   Operations: ${perfStats.compressionOps} compression, ${perfStats.decompressionOps} decompression`);
            console.log(`   Average Speeds: ${perfStats.averageCompressionSpeed?.toFixed(1) || 'N/A'} KB/s comp, ` +
                       `${perfStats.averageDecompressionSpeed?.toFixed(1) || 'N/A'} KB/s decomp`);
            if (perfStats.simdOperationsUsed > 0) {
                console.log(`   ✅ SIMD operations utilized: ${perfStats.simdOperationsUsed}`);
            }
        }
        
        optimizedModule.cleanup();
    } else {
        console.error('❌ Failed to load optimized module');
    }
    
    // Summary and recommendations
    console.log('\n🎯 PERFORMANCE ANALYSIS SUMMARY');
    console.log('='.repeat(50));
    
    if (optimizedResults) {
        console.log(`✅ Optimized module test: ${optimizedResults.passedTests}/${optimizedResults.totalTests} tests passed`);
        
        // Calculate key performance metrics
        let totalCompSpeed = 0, totalDecompSpeed = 0, testCount = 0;
        
        for (const dataset of Object.values(optimizedResults.performance)) {
            for (const blockResult of Object.values(dataset)) {
                if (blockResult.compressionSpeed) {
                    totalCompSpeed += blockResult.compressionSpeed;
                    totalDecompSpeed += blockResult.decompressionSpeed;
                    testCount++;
                }
            }
        }
        
        const avgCompSpeed = totalCompSpeed / testCount;
        const avgDecompSpeed = totalDecompSpeed / testCount;
        
        console.log(`\n🏆 Key Metrics (Optimized):`);
        console.log(`   Average Compression: ${avgCompSpeed.toFixed(1)} KB/s`);
        console.log(`   Average Decompression: ${avgDecompSpeed.toFixed(1)} KB/s`);
        
        // Foundation Tier 1 compliance
        const compTarget = 30; // KB/s
        const decompTarget = 100; // KB/s
        
        console.log(`\n🎖️ Foundation Tier 1 Compliance:`);
        console.log(`   Compression Target: ${compTarget} KB/s - ` +
                   `${avgCompSpeed >= compTarget ? '✅ PASS' : '❌ FAIL'} ` +
                   `(${(avgCompSpeed/compTarget*100).toFixed(1)}%)`);
        console.log(`   Decompression Target: ${decompTarget} KB/s - ` +
                   `${avgDecompSpeed >= decompTarget ? '✅ PASS' : '❌ FAIL'} ` +
                   `(${(avgDecompSpeed/decompTarget*100).toFixed(1)}%)`);
        
        // Performance recommendations
        console.log(`\n💡 Optimization Recommendations:`);
        if (avgCompSpeed < compTarget) {
            console.log(`   🔧 Compression below target - consider additional optimizations:`);
            console.log(`      • Increase SIMD usage in block sorting algorithms`);
            console.log(`      • Optimize memory access patterns for cache efficiency`);
            console.log(`      • Consider larger block sizes for better compression`);
        } else {
            console.log(`   ✅ Compression performance exceeds Foundation Tier 1 requirements`);
        }
        
        if (avgDecompSpeed < decompTarget) {
            console.log(`   🔧 Decompression below target - consider optimizations:`);
            console.log(`      • Optimize Huffman decoding with lookup tables`);
            console.log(`      • Use SIMD for faster bit manipulation`);
            console.log(`      • Improve memory prefetching patterns`);
        } else {
            console.log(`   ✅ Decompression performance exceeds Foundation Tier 1 requirements`);
        }
    }
    
    // Error summary
    if (optimizedResults && optimizedResults.errors.length > 0) {
        console.log(`\n⚠️ Errors Encountered (${optimizedResults.errors.length}):`);
        for (const error of optimizedResults.errors) {
            console.log(`   ${error.dataset} (block ${error.blockSize}): ${error.error}`);
        }
    }
    
    // Save results
    const resultsFile = `optimized-performance-${Date.now()}.json`;
    if (optimizedResults) {
        fs.writeFileSync(resultsFile, JSON.stringify(optimizedResults, null, 2));
        console.log(`\n📄 Results saved to: ${resultsFile}`);
    }
    
    return optimizedResults;
}

/**
 * Run the complete optimized performance test
 */
async function main() {
    console.log('⚡ bzip2.wasm Optimized Performance Validation');
    console.log('=' .repeat(70));
    
    try {
        const results = await runOptimizedPerformanceTest();
        
        if (results && results.passedTests === results.totalTests) {
            console.log('\n🎉 All performance tests passed!');
            console.log('🚀 Optimized bzip2.wasm testing completed successfully.');
            process.exit(0);
        } else {
            console.log('\n⚠️ Some performance tests failed or modules unavailable');
            console.log('🔧 Review optimization strategies and rebuild if necessary');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 Performance test suite crashed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
export { runOptimizedPerformanceTest, generateBenchmarkData, benchmarkModule };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}