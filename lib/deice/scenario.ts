import { PreparedScenario, PreparedScenarioStep, ScenarioFile } from './types';

function generateStepId(step: ScenarioFile['steps'][number], index: number) {
  const base = `${step.role}-${index + 1}`;
  if (step.cue) {
    return `${base}-${step.cue}`;
  }
  const slug = step.text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${base}-${slug}`;
}

export function prepareScenarioForGrading(raw: ScenarioFile): PreparedScenario {
  const steps: PreparedScenarioStep[] = raw.steps.map((step, index) => ({
    ...step,
    index,
    id: generateStepId(step, index)
  }));

  const captainCues = Array.from(
    new Set(
      steps
        .filter((step) => step.role === 'captain' && step.cue)
        .map((step) => step.cue as string)
    )
  );

  return {
    id: raw.id,
    label: raw.label,
    description: raw.description,
    metadata: raw.metadata,
    steps,
    captainCues
  };
}
