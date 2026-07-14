import { authorizeCronRequest } from '../../../../src/recorder/cronAuth';
import { ensureBenchmarkSchema } from '../../../../src/recorder/ensureSchema';
import { executeBenchmarkSweep } from '../../../../src/recorder/executeBenchmarkSweep';
import { createNeonBenchmarkRunStore } from '../../../../src/recorder/neonStore';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const authorized = authorizeCronRequest({
    authorizationHeader: request.headers.get('authorization'),
    cronSecret: process.env.CRON_SECRET,
  });
  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return Response.json({ error: 'DATABASE_URL is not configured' }, { status: 500 });
  }

  try {
    // Marketplace DATABASE_URL cannot be pulled via CLI; first hit creates tables.
    await ensureBenchmarkSchema(databaseUrl);
    const store = createNeonBenchmarkRunStore(databaseUrl);
    const result = await executeBenchmarkSweep({ store });
    return Response.json({
      outcome: result.persist.outcome,
      runId: result.persist.runId,
      boundaryMs: result.run.boundaryMs,
      status: result.run.status,
      durationMs: result.run.durationMs,
      sampleCount: result.samples.length,
      headlineEligibleCount: result.samples.filter((s) => s.headlineEligible).length,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Benchmark Recorder sweep failed.',
      },
      { status: 500 },
    );
  }
}
