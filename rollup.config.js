"use strict";

import clear from "rollup-plugin-clear";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import screeps from "rollup-plugin-screeps-world";
import { config } from "dotenv";
import nodePolyfills from "rollup-plugin-node-polyfills";

config();
const build_path = process.env.BUILD_PATH || "dist";

export default {
  input: "src/main.ts",
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
    typescript({ tsconfig: "./tsconfig.json" }),
    screeps({ config: null, dryRun: true })
  ]
};
