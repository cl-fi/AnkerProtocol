export interface PredictManagerSummary {
  managerId: string;
  owner?: string;
}

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parsePredictManagers(payload: unknown): PredictManagerSummary[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as UnknownRecord;
    const managerId = asString(record.manager_id ?? record.managerId ?? record.id ?? record.object_id);
    if (!managerId) return [];
    const owner = asString(record.owner);
    return [{ managerId, ...(owner ? { owner } : {}) }];
  });
}

export async function fetchPredictManagers(owner: string): Promise<PredictManagerSummary[]> {
  const response = await fetch(`/api/predict/managers?owner=${encodeURIComponent(owner)}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Predict manager request failed: ${response.status} ${response.statusText}`);
  }
  return parsePredictManagers(await response.json());
}
