import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { BenchmarkRun, BenchmarkSample } from './buildBenchmarkRun';
import type { BenchmarkRunStore, InsertRunResult } from './store';

type Sql = NeonQueryFunction<false, false>;

export function createNeonBenchmarkRunStore(databaseUrl: string): BenchmarkRunStore {
  const sql = neon(databaseUrl);
  return {
    insertRunIfAbsent(run, samples) {
      return insertRunIfAbsentWithSql(sql, run, samples);
    },
  };
}

/**
 * Idempotent write. If samples fail after the Run row is inserted, the Run is
 * deleted so a retry can complete the sweep (HTTP neon has no interactive txn).
 */
export async function insertRunIfAbsentWithSql(
  sql: Sql,
  run: BenchmarkRun,
  samples: readonly BenchmarkSample[],
): Promise<InsertRunResult> {
  const inserted = await sql`
    INSERT INTO benchmark_runs (boundary_ms, status, duration_ms, app_version, source)
    VALUES (${run.boundaryMs}, ${run.status}, ${run.durationMs}, ${run.appVersion}, ${run.source})
    ON CONFLICT (boundary_ms) DO NOTHING
    RETURNING id
  `;

  if (inserted.length === 0) {
    const existing = await sql`
      SELECT id FROM benchmark_runs WHERE boundary_ms = ${run.boundaryMs} LIMIT 1
    `;
    const runId = String(existing[0]?.id ?? '');
    return { outcome: 'already_exists', runId };
  }

  const runId = String(inserted[0]!.id);

  try {
    for (const sample of samples) {
      await sql`
        INSERT INTO benchmark_samples (
          run_id,
          target_price,
          spot,
          coupon,
          reserve,
          legs_cost,
          leg_count,
          net_apr,
          anker_settlement_ms,
          benchmark_settlement_ms,
          benchmark_apr,
          benchmark_product_id,
          match_status,
          source,
          app_version,
          headline_eligible
        ) VALUES (
          ${runId},
          ${sample.targetPrice},
          ${sample.spot},
          ${sample.coupon},
          ${sample.reserve},
          ${sample.legsCost},
          ${sample.legCount},
          ${sample.netApr},
          ${sample.ankerSettlementMs},
          ${sample.benchmarkSettlementMs},
          ${sample.benchmarkApr},
          ${sample.benchmarkProductId},
          ${sample.matchStatus},
          ${sample.source},
          ${sample.appVersion},
          ${sample.headlineEligible}
        )
      `;
    }
  } catch (error) {
    await sql`DELETE FROM benchmark_runs WHERE id = ${runId}`;
    throw error;
  }

  return { outcome: 'inserted', runId };
}
