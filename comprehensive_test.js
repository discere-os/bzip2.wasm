import bzip2 from './dist/node/index.js';

async function runComprehensiveTests() {
    console.log('🚀 Starting bzip2.wasm Comprehensive Test Suite...\n');
    
    let passedTests = 0;
    let totalTests = 0;
    
    function test(name, fn) {
        totalTests++;
        try {
            fn();
            console.log(`✅ ${name}`);
            passedTests++;
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
        }
    }
    
    async function asyncTest(name, fn) {
        totalTests++;
        try {
            await fn();
            console.log(`✅ ${name}`);
            passedTests++;
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
        }
    }
    
    // Initialize the module
    await asyncTest('Module Initialization', async () => {
        await bzip2.initialize();
        if (!bzip2.initialized) {
            throw new Error('Module failed to initialize');
        }
    });
    
    // Test version information
    test('Version Information', () => {
        const version = bzip2.getVersion();
        if (!version || typeof version !== 'string') {
            throw new Error(`Invalid version: ${version}`);
        }
        console.log(`   Version: ${version}`);
    });
    
    // Test compress bound calculation
    test('Compress Bound Calculation', () => {
        const bound = bzip2.getCompressBound(1000);
        if (bound <= 1000) {
            throw new Error(`Compress bound too small: ${bound}`);
        }
        console.log(`   1000 bytes -> max ${bound} bytes`);
    });
    
    // Test basic compression and decompression
    await asyncTest('Basic Compression/Decompression', async () => {
        const input = new TextEncoder().encode('Hello, World! This is a test string for bzip2 compression.');
        const compressed = bzip2.compress(input);
        const decompressed = bzip2.decompress(compressed);
        
        const result = new TextDecoder().decode(decompressed);
        if (result !== 'Hello, World! This is a test string for bzip2 compression.') {
            throw new Error('Round-trip compression/decompression failed');
        }
        console.log(`   Input: ${input.length} bytes -> Compressed: ${compressed.length} bytes -> Output: ${decompressed.length} bytes`);
    });
    
    // Test empty input
    await asyncTest('Empty Input Handling', async () => {
        const input = new Uint8Array(0);
        const compressed = bzip2.compress(input);
        const decompressed = bzip2.decompress(compressed);
        
        if (decompressed.length !== 0) {
            throw new Error('Empty input should produce empty output');
        }
    });
    
    // Test various block sizes
    await asyncTest('Different Block Sizes', async () => {
        const input = new TextEncoder().encode('A'.repeat(10000));
        
        for (let blockSize = 1; blockSize <= 9; blockSize++) {
            const compressed = bzip2.compress(input, blockSize);
            const decompressed = bzip2.decompress(compressed);
            
            if (decompressed.length !== input.length) {
                throw new Error(`Block size ${blockSize} failed round-trip`);
            }
        }
        console.log(`   Tested block sizes 1-9 successfully`);
    });
    
    // Test large data compression
    await asyncTest('Large Data Compression', async () => {
        const size = 100000; // 100KB
        const input = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            input[i] = i % 256; // Repeating pattern for better compression
        }
        
        const compressed = bzip2.compress(input);
        const decompressed = bzip2.decompress(compressed);
        
        if (decompressed.length !== input.length) {
            throw new Error('Large data round-trip failed');
        }
        
        // Verify data integrity
        for (let i = 0; i < size; i++) {
            if (decompressed[i] !== input[i]) {
                throw new Error(`Data mismatch at position ${i}`);
            }
        }
        
        const compressionRatio = ((input.length - compressed.length) / input.length * 100).toFixed(1);
        console.log(`   ${size} bytes -> ${compressed.length} bytes (${compressionRatio}% reduction)`);
    });
    
    // Test random data (should not compress well)
    await asyncTest('Random Data Compression', async () => {
        const size = 10000;
        const input = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            input[i] = Math.floor(Math.random() * 256);
        }
        
        const compressed = bzip2.compress(input);
        const decompressed = bzip2.decompress(compressed);
        
        if (decompressed.length !== input.length) {
            throw new Error('Random data round-trip failed');
        }
        
        console.log(`   Random data: ${size} bytes -> ${compressed.length} bytes (minimal compression expected)`);
    });
    
    // Test error handling for invalid data
    await asyncTest('Invalid Compressed Data Handling', async () => {
        const invalidData = new Uint8Array([1, 2, 3, 4, 5]); // Not valid bzip2 data
        
        try {
            bzip2.decompress(invalidData);
            throw new Error('Should have thrown error for invalid data');
        } catch (error) {
            if (!error.message.includes('Decompression failed')) {
                throw new Error('Unexpected error message');
            }
        }
    });
    
    // Test error string functionality
    test('Error String Functionality', () => {
        const errorString = bzip2.getErrorString(0); // BZ_OK
        if (errorString !== 'BZ_OK') {
            throw new Error(`Unexpected error string: ${errorString}`);
        }
        
        const paramError = bzip2.getErrorString(-2); // BZ_PARAM_ERROR
        if (paramError !== 'BZ_PARAM_ERROR') {
            throw new Error(`Unexpected error string: ${paramError}`);
        }
    });
    
    // Performance baseline test
    await asyncTest('Performance Baseline', async () => {
        const testData = new TextEncoder().encode('Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(1000));
        
        const startTime = performance.now();
        const compressed = bzip2.compress(testData);
        const compressionTime = performance.now() - startTime;
        
        const decompStartTime = performance.now();
        const decompressed = bzip2.decompress(compressed);
        const decompressionTime = performance.now() - decompStartTime;
        
        if (decompressed.length !== testData.length) {
            throw new Error('Performance test round-trip failed');
        }
        
        const compressionSpeed = (testData.length / 1024 / (compressionTime / 1000)).toFixed(1); // KB/s
        const decompressionSpeed = (decompressed.length / 1024 / (decompressionTime / 1000)).toFixed(1); // KB/s
        
        console.log(`   Compression: ${compressionSpeed} KB/s, Decompression: ${decompressionSpeed} KB/s`);
    });
    
    // Final results
    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! bzip2.wasm is working correctly.');
        return true;
    } else {
        console.log('❌ Some tests failed. Please check the implementation.');
        return false;
    }
}

runComprehensiveTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});