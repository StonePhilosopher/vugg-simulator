#!/usr/bin/env node
// Read-only inspection. Acquiring in a short-lived CLI would abandon the lease.
import { runTestLeaseStatus } from './test-lease-lib.mjs';
process.exitCode = await runTestLeaseStatus();
