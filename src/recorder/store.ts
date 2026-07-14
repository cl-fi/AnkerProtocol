import type { BenchmarkRun, BenchmarkSample } from './buildBenchmarkRun';

export type InsertRunResult =
  | { outcome: 'inserted'; runId: string }
  | { outcome: 'already_exists'; runId: string };

export interface BenchmarkRunStore {
  insertRunIfAbsent(run: BenchmarkRun, samples: readonly BenchmarkSample[]): Promise<InsertRunResult>;
}

interface StoredRun {
  runId: string;
  run: BenchmarkRun;
  samples: BenchmarkSample[];
}

/** In-memory store for unit tests — same idempotency contract as the Neon adapter. */
export function createMemoryBenchmarkRunStore(): BenchmarkRunStore & {
  getRun(boundaryMs: number): StoredRun | undefined;
} {
  const byBoundary = new Map<number, StoredRun>();
  let seq = 0;

  return {
    async insertRunIfAbsent(run, samples) {
      const existing = byBoundary.get(run.boundaryMs);
      if (existing) {
        return { outcome: 'already_exists', runId: existing.runId };
      }
      const runId = `mem-${++seq}`;
      byBoundary.set(run.boundaryMs, {
        runId,
        run: { ...run },
        samples: samples.map((sample) => ({ ...sample })),
      });
      return { outcome: 'inserted', runId };
    },
    getRun(boundaryMs) {
      return byBoundary.get(boundaryMs);
    },
  };
}
