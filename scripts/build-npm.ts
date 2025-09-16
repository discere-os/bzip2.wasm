#!/usr/bin/env -S deno run -A
/**
 * Build NPM package for Node.js compatibility
 */

import { build, emptyDir } from "https://deno.land/x/dnt@0.40.0/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/lib/index.ts"],
  outDir: "./npm",
  shims: {
    // provide deno APIs
    deno: true,
  },
  package: {
    // package.json properties
    name: "@discere-os/bzip2.wasm",
    version: Deno.args[0] || "1.1.0",
    description: "High-performance bzip2 compression library with SIMD optimizations",
    main: "./esm/mod.js",
    module: "./esm/mod.js",
    types: "./esm/mod.d.ts",
    exports: {
      ".": {
        "import": "./esm/mod.js",
        "types": "./esm/mod.d.ts"
      }
    },
    keywords: [
      "bzip2",
      "compression",
      "wasm",
      "webassembly",
      "decompression",
      "simd"
    ],
    author: "Superstruct Ltd, New Zealand",
    license: "MIT",
    repository: {
      type: "git",
      url: "https://github.com/discere-os/bzip2.wasm.git"
    },
    homepage: "https://github.com/discere-os/bzip2.wasm",
    bugs: {
      url: "https://github.com/discere-os/bzip2.wasm/issues"
    }
  },
  postBuild() {
    // Copy WASM files to the npm package
    Deno.copyFileSync("./install/wasm/bzip2-release.wasm", "./npm/esm/bzip2-release.wasm");
    Deno.copyFileSync("./install/wasm/bzip2-release.js", "./npm/esm/bzip2-release.js");
  },
});

console.log("✅ NPM package built successfully in ./npm/");
console.log("📦 Install with: npm install ./npm/");