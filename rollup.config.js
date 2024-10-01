"use strict";

import clear from "rollup-plugin-clear";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import screeps from "rollup-plugin-screeps-world";

export default {
  input: "src/main.ts",
  output: {
    file: "C:/Users/thome/AppData/Local/Screeps/scripts/screeps.com/Typescript/main.js",
    format: "cjs",
    sourcemap: true
  },

  plugins: [
    clear({ targets: ["C:/Users/thome/AppData/Local/Screeps/scripts/screeps.com/Typescript/*"] }),
    resolve({ rootDir: "src" }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    screeps({ config: null, dryRun: true })
  ]
};
