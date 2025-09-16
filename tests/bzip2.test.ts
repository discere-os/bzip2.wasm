import { assertEquals, assertExists } from "@std/assert"
import Bzip2 from "../src/lib/index.ts"

Deno.test("Bzip2 - Basic compression and decompression", async () => {
  const bzip2 = new Bzip2()

  try {
    // Initialize
    await bzip2.initialize()

    // Test data
    const testText = "Hello, World! This is a test of bzip2.wasm compression. ".repeat(10)
    const testData = new TextEncoder().encode(testText)

    // Compress
    const compressed = await bzip2.compress(testData, { blockSize: 6 })

    assertExists(compressed.data)
    assertEquals(compressed.data.length > 0, true)
    assertEquals(compressed.compressionRatio > 1, true)

    // Decompress
    const decompressed = await bzip2.decompress(compressed.data)

    assertExists(decompressed.data)
    assertEquals(decompressed.data.length > 0, true)
    assertEquals(decompressed.data.length, testData.length)

    // Verify integrity
    const decompressedText = new TextDecoder().decode(decompressed.data)
    assertEquals(decompressedText, testText)

  } finally {
    bzip2.cleanup()
  }
})

Deno.test("Bzip2 - Different block sizes", async () => {
  const bzip2 = new Bzip2()

  try {
    await bzip2.initialize()

    const testData = new TextEncoder().encode("Test data for block size comparison")

    for (const blockSize of [1, 6, 9] as const) {
      const compressed = await bzip2.compress(testData, { blockSize })
      const decompressed = await bzip2.decompress(compressed.data)

      assertEquals(decompressed.data.length > 0, true)
      assertEquals(decompressed.data.length, testData.length)
    }

  } finally {
    bzip2.cleanup()
  }
})

Deno.test("Bzip2 - Performance metrics", async () => {
  const bzip2 = new Bzip2()

  try {
    await bzip2.initialize()

    const testData = new TextEncoder().encode("Performance test data")

    // Perform operations
    const compressed = await bzip2.compress(testData)
    await bzip2.decompress(compressed.data)

    // Check metrics
    const metrics = bzip2.getPerformanceMetrics()
    assertEquals(metrics.compressionOps, 1)
    assertEquals(metrics.decompressionOps, 1)
    assertEquals(metrics.totalCompressionTime > 0, true)
    assertEquals(metrics.totalDecompressionTime > 0, true)

  } finally {
    bzip2.cleanup()
  }
})

Deno.test("Bzip2 - System capabilities", async () => {
  const bzip2 = new Bzip2()

  try {
    await bzip2.initialize()

    const capabilities = bzip2.getSystemCapabilities()

    assertEquals(capabilities.wasmSupported, true)
    assertExists(capabilities.simdSupported !== undefined)

    const version = bzip2.getVersion()
    assertExists(version)
    assertEquals(typeof version, "string")

  } finally {
    bzip2.cleanup()
  }
})