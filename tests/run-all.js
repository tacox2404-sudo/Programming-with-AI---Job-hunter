#!/usr/bin/env node
"use strict";

/* Runs every tests/*.test.js in its own process (so one file's exit
   code can't be masked by another's) and reports overall pass/fail.
   Run: node tests/run-all.js */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith(".test.js")).sort();

let anyFailed = false;
files.forEach(f => {
  console.log(`\n--- ${f} ---`);
  const result = spawnSync(process.execPath, [path.join(dir, f)], { stdio: "inherit" });
  if (result.status !== 0) anyFailed = true;
});

console.log(anyFailed ? "\nSome test files failed." : `\nAll ${files.length} test file(s) passed.`);
if (anyFailed) process.exitCode = 1;
