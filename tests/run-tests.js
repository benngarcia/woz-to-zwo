#!/usr/bin/env node

/**
 * Test runner script
 * 
 * This script runs the tests using Node.js with ESM modules support.
 * Run with: node tests/run-tests.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as path from 'path';

// Get the directory name of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the test file
const testFilePath = path.join(__dirname, 'parser.test.js');

// Run the test with node
const testProcess = spawn('node', ['--enable-source-maps', testFilePath], {
  stdio: 'inherit'
});

testProcess.on('close', (code) => {
  process.exit(code);
}); 