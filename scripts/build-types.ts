#!/usr/bin/env -S deno run -A
/**
 * Generate TypeScript declaration files for the library
 */

console.log("⚡ Generating TypeScript declarations...");

// Since we're using TypeScript directly, just copy the source types
await Deno.mkdir("./dist/types", { recursive: true });

// Copy type definitions
await Deno.copyFile("./src/lib/types.ts", "./dist/types/types.d.ts");
await Deno.copyFile("./src/lib/index.ts", "./dist/types/index.d.ts");

console.log("✅ TypeScript declarations generated in ./dist/types/");