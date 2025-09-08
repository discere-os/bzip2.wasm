import bzip2 from './dist/node/index.js';

async function runPerformanceBenchmarks() {
    console.log('🏃 Starting bzip2.wasm Performance Benchmark Suite...\n');
    
    // Initialize the module
    await bzip2.initialize();
    console.log(`📦 bzip2 Version: ${bzip2.getVersion()}\n`);
    
    const results = [];
    
    async function benchmark(name, testData, iterations = 5) {
        console.log(`🔬 Testing: ${name}`);
        
        const compressionTimes = [];
        const decompressionTimes = [];
        let compressedSize = 0;
        let finalDecompressed = null;
        
        // Warm up
        const warmup = bzip2.compress(testData.slice(0, Math.min(1000, testData.length)));
        bzip2.decompress(warmup);
        
        for (let i = 0; i < iterations; i++) {
            // Compression benchmark
            const compStartTime = performance.now();
            const compressed = bzip2.compress(testData);
            const compEndTime = performance.now();
            compressionTimes.push(compEndTime - compStartTime);
            compressedSize = compressed.length;
            
            // Decompression benchmark
            const decompStartTime = performance.now();
            const decompressed = bzip2.decompress(compressed);
            const decompEndTime = performance.now();
            decompressionTimes.push(decompEndTime - decompStartTime);
            finalDecompressed = decompressed;
        }
        
        // Calculate statistics
        const avgCompressionTime = compressionTimes.reduce((a, b) => a + b) / compressionTimes.length;
        const avgDecompressionTime = decompressionTimes.reduce((a, b) => a + b) / decompressionTimes.length;
        
        const inputSizeMB = testData.length / (1024 * 1024);
        const outputSizeMB = finalDecompressed.length / (1024 * 1024);
        
        const compressionSpeedMBs = inputSizeMB / (avgCompressionTime / 1000);
        const decompressionSpeedMBs = outputSizeMB / (avgDecompressionTime / 1000);
        
        const compressionRatio = ((testData.length - compressedSize) / testData.length * 100);
        
        const result = {
            name,
            inputSize: testData.length,
            compressedSize,
            compressionRatio,
            compressionSpeedMBs,
            decompressionSpeedMBs,
            avgCompressionTime,
            avgDecompressionTime
        };
        
        results.push(result);
        
        console.log(`   Input Size: ${(testData.length / 1024).toFixed(1)} KB`);
        console.log(`   Compressed Size: ${(compressedSize / 1024).toFixed(1)} KB`);
        console.log(`   Compression Ratio: ${compressionRatio.toFixed(1)}%`);
        console.log(`   Compression Speed: ${compressionSpeedMBs.toFixed(2)} MB/s`);
        console.log(`   Decompression Speed: ${decompressionSpeedMBs.toFixed(2)} MB/s`);
        console.log(`   Compression Time: ${avgCompressionTime.toFixed(2)}ms`);
        console.log(`   Decompression Time: ${avgDecompressionTime.toFixed(2)}ms\n`);
        
        return result;
    }
    
    // Test 1: Highly repetitive data (best case for bzip2)
    const repetitiveData = new TextEncoder().encode('A'.repeat(100000));
    await benchmark('Highly Repetitive Data (100KB)', repetitiveData, 10);
    
    // Test 2: Text data (good case for bzip2)
    const textData = new TextEncoder().encode(`
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
        Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
    `.repeat(500));
    await benchmark('Text Data (Lorem Ipsum)', textData, 10);
    
    // Test 3: JSON-like data (structured data)
    const jsonData = new TextEncoder().encode(JSON.stringify({
        users: Array.from({length: 1000}, (_, i) => ({
            id: i,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            profile: {
                age: 20 + (i % 50),
                location: `City ${i % 100}`,
                interests: ['reading', 'coding', 'music'].slice(0, (i % 3) + 1)
            }
        }))
    }));
    await benchmark('Structured JSON Data', jsonData, 5);
    
    // Test 4: Binary pattern data
    const binaryData = new Uint8Array(50000);
    for (let i = 0; i < binaryData.length; i++) {
        binaryData[i] = (i % 4) * 64; // Repeating pattern: 0, 64, 128, 192
    }
    await benchmark('Binary Pattern Data (50KB)', binaryData, 10);
    
    // Test 5: Random data (worst case)
    const randomData = new Uint8Array(20000);
    for (let i = 0; i < randomData.length; i++) {
        randomData[i] = Math.floor(Math.random() * 256);
    }
    await benchmark('Random Data (20KB)', randomData, 10);
    
    // Test 6: Large file simulation (1MB text)
    const largeTextData = new TextEncoder().encode(`
        This is a large text file simulation for testing bzip2 performance on bigger datasets.
        It contains repeated paragraphs with some variations to simulate real-world text compression scenarios.
        The goal is to measure how well bzip2.wasm performs with larger inputs that are more realistic.
        
        Chapter 1: Introduction
        In the beginning, there was data. Lots and lots of data. And this data needed to be compressed efficiently.
        
        Chapter 2: The Solution
        bzip2 emerged as a powerful compression algorithm that could achieve excellent compression ratios.
        
        Chapter 3: WebAssembly Implementation
        By compiling bzip2 to WebAssembly, we can bring this powerful compression to web browsers and Node.js.
    `.repeat(200));
    await benchmark('Large Text File (1MB+)', largeTextData, 3);
    
    // Summary and Foundation Tier 1 validation
    console.log('📊 PERFORMANCE SUMMARY');
    console.log('='.repeat(50));
    
    let totalCompressionSpeed = 0;
    let totalDecompressionSpeed = 0;
    let bestCompressionRatio = 0;
    
    results.forEach(result => {
        totalCompressionSpeed += result.compressionSpeedMBs;
        totalDecompressionSpeed += result.decompressionSpeedMBs;
        bestCompressionRatio = Math.max(bestCompressionRatio, result.compressionRatio);
    });
    
    const avgCompressionSpeed = totalCompressionSpeed / results.length;
    const avgDecompressionSpeed = totalDecompressionSpeed / results.length;
    
    console.log(`Average Compression Speed: ${avgCompressionSpeed.toFixed(2)} MB/s`);
    console.log(`Average Decompression Speed: ${avgDecompressionSpeed.toFixed(2)} MB/s`);
    console.log(`Best Compression Ratio: ${bestCompressionRatio.toFixed(1)}%`);
    
    // Foundation Tier 1 Requirements Check
    console.log('\n🎯 FOUNDATION TIER 1 VALIDATION');
    console.log('='.repeat(50));
    
    const compressionTarget = 50; // MB/s
    const decompressionTarget = 100; // MB/s
    
    const compressionPass = avgCompressionSpeed >= compressionTarget;
    const decompressionPass = avgDecompressionSpeed >= decompressionTarget;
    
    console.log(`Compression Target: ${compressionTarget} MB/s`);
    console.log(`Achieved: ${avgCompressionSpeed.toFixed(2)} MB/s ${compressionPass ? '✅' : '❌'} (${(avgCompressionSpeed/compressionTarget*100).toFixed(0)}% of target)`);
    
    console.log(`\nDecompression Target: ${decompressionTarget} MB/s`);
    console.log(`Achieved: ${avgDecompressionSpeed.toFixed(2)} MB/s ${decompressionPass ? '✅' : '❌'} (${(avgDecompressionSpeed/decompressionTarget*100).toFixed(0)}% of target)`);
    
    if (compressionPass && decompressionPass) {
        console.log('\n🎉 Foundation Tier 1 requirements EXCEEDED!');
    } else {
        console.log('\n❌ Foundation Tier 1 requirements not met.');
    }
    
    // Performance characteristics analysis
    console.log('\n📈 PERFORMANCE CHARACTERISTICS');
    console.log('='.repeat(50));
    
    const textResult = results.find(r => r.name.includes('Text Data'));
    const randomResult = results.find(r => r.name.includes('Random Data'));
    const largeResult = results.find(r => r.name.includes('Large Text'));
    
    if (textResult && randomResult) {
        const compressionAdvantage = textResult.compressionRatio - randomResult.compressionRatio;
        console.log(`Text vs Random compression advantage: ${compressionAdvantage.toFixed(1)}% (shows algorithm strength)`);
    }
    
    if (largeResult) {
        console.log(`Large file performance: ${largeResult.compressionSpeedMBs.toFixed(2)} MB/s compression, ${largeResult.decompressionSpeedMBs.toFixed(2)} MB/s decompression`);
        console.log(`Large file compression ratio: ${largeResult.compressionRatio.toFixed(1)}% (demonstrates scalability)`);
    }
    
    return {
        avgCompressionSpeed,
        avgDecompressionSpeed,
        bestCompressionRatio,
        foundationTier1Pass: compressionPass && decompressionPass,
        results
    };
}

runPerformanceBenchmarks().then(summary => {
    console.log('\n✅ Performance benchmark complete.');
    process.exit(0);
}).catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
});