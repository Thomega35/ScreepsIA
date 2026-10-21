"use strict";

import clear from "rollup-plugin-clear";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import { config } from "dotenv";
import nodePolyfills from "rollup-plugin-node-polyfills";

config();
const build_path = process.env.BUILD_PATH || "dist";

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
    clear({ targets: [build_path + "/*"] }),
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
