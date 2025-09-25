import type { PreparedScenario, ScenarioFile } from './types';
import { prepareScenarioForGrading as internalPrepare } from './scoring';

export function prepareScenarioForGrading(raw: ScenarioFile): PreparedScenario {
  const prepared = internalPrepare(raw);
  if (!prepared) {
    throw new Error('Unable to prepare scenario');
  }
  return prepared;
}

export async function fetchScenarioManifest(signal?: AbortSignal) {
  const res = await fetch('/scenarios/index.json', { signal });
  if (!res.ok) {
    throw new Error(`Failed to load scenario manifest: ${res.status}`);
  }
  return res.json();
}

export async function fetchScenarioFile(id: string, signal?: AbortSignal): Promise<ScenarioFile> {
  const res = await fetch(`/scenarios/${id}.json`, { signal });
  if (!res.ok) {
    throw new Error(`Failed to load scenario ${id}`);
  }
  return res.json();
}
