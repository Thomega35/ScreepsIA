"use strict";

import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import { config } from "dotenv";
import nodePolyfills from "rollup-plugin-node-polyfills";

config();
const build_path = process.env.BUILD_PATH || "dist";

// Every .js file in the branch folder becomes a Screeps module, so drop stale ones before building
const cleanBuildPath = {
  name: "clean-build-path",
  buildStart() {
    if (!existsSync(build_path)) return;
    for (const file of readdirSync(build_path)) {
      if (file.endsWith(".js")) rmSync(join(build_path, file));
    }
  }
};

// Screeps can only require .js modules, so ship the sourcemap as main.js.map.js
const screepsSourceMap = {
  name: "screeps-sourcemap",
  generateBundle(_options, bundle) {
    for (const [name, asset] of Object.entries(bundle)) {
      if (asset.type !== "asset" || !name.endsWith(".map")) continue;
      const map = JSON.parse(asset.source);
      delete map.sourcesContent;
      delete bundle[name];
      this.emitFile({ type: "asset", fileName: name + ".js", source: `module.exports = ${JSON.stringify(map)};` });
    }
  }
};

export default {
  input: "src/main.ts",
  // Provided by the Screeps runtime (lodash 3.10)
  external: ["lodash"],
  output: {
    file: build_path + "/main.js",
    format: "cjs",
    sourcemap: true
  },

  plugins: [
    cleanBuildPath,
    resolve({
      rootDir: "src",
      preferBuiltins: true
    }),
    commonjs(),
    nodePolyfills(),
    // Explicit include: patched picomatch no longer matches rpt2's default "*.ts+(|x)" glob
    typescript({ tsconfig: "./tsconfig.json", include: ["**/*.ts", "**/*.tsx"] }),
    screepsSourceMap
  ]
};
