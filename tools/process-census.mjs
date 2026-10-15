#!/usr/bin/env node
import { runProcessCensus } from './process-census-lib.mjs';

process.exitCode = await runProcessCensus();
