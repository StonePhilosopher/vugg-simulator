#!/usr/bin/env node
// Local full-guard verdict; --check reads the stamp without starting CI.
import { runColdCi } from './cold-ci-lib.mjs';

process.exitCode = runColdCi();
