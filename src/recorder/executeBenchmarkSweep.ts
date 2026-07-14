import packageJson from '../../package.json';
import { buildBenchmarkRun, type BenchmarkRun, type BenchmarkSample } from './buildBenchmarkRun';
import { loadRecorderInputs } from './loadRecorderInputs';
import type { BenchmarkRunStore, InsertRunResult } from './store';

function readAppVersion(): string {
  return typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
}

export interface ExecuteBenchmarkSweepResult {
  run: BenchmarkRun;
  samples: BenchmarkSample[];
  persist: InsertRunResult;
}

/**
 * One Benchmark Recorder sweep: load inputs → pure Run builder → idempotent persist.
 */
export async function executeBenchmarkSweep(input: {
  store: BenchmarkRunStore;
  wallClockMs?: number;
  appVersion?: string;
}): Promise<ExecuteBenchmarkSweepResult> {
  const wallClockMs = input.wallClockMs ?? Date.now();
  const startedAt = Date.now();
  const appVersion = input.appVersion ?? readAppVersion();

  const loaded = await loadRecorderInputs(wallClockMs);
  const { run, samples } = buildBenchmarkRun({
    markets: loaded.markets,
    binanceProducts: loaded.binanceProducts,
    spot: loaded.spot,
    nowMs: loaded.nowMs,
    appVersion,
    source: loaded.source,
    upstreamFailed: loaded.upstreamFailed,
    durationMs: Date.now() - startedAt,
  });

  // Duration includes persist prep; stamp final wall time before write.
  const finalized: BenchmarkRun = {
    ...run,
    durationMs: Date.now() - startedAt,
  };

  const persist = await input.store.insertRunIfAbsent(finalized, samples);
  return { run: finalized, samples, persist };
}
