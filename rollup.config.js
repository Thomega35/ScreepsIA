"use strict";

import clear from 'rollup-plugin-clear';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import screeps from 'rollup-plugin-screeps';

let cfg;
const dest = process.env.DEST;
if (!dest) {
  console.log("No destination specified - code will be compiled but not uploaded");
} else if ((cfg = require("./screeps.json")[dest]) == null) {
  throw new Error("Invalid upload destination");
}

export default [{
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
    typescript({tsconfig: "./tsconfig.json"}),
    screeps({config: cfg, dryRun: cfg == null})
  ]
},{
  input: "src/role.harvester.ts",
  output: {
    file: "C:/Users/thome/AppData/Local/Screeps/scripts/screeps.com/Typescript/role.harvester.js",
    format: "cjs",
    sourcemap: true
  },

  plugins: [
    resolve({ rootDir: "src" }),
    commonjs(),
    typescript({tsconfig: "./tsconfig.json"}),
    screeps({config: cfg, dryRun: cfg == null})
  ]
}];
