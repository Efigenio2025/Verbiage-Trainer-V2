'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent
} from 'react';
import type { ScenarioFile, ScenarioManifestEntry } from '@/lib/deice/types';

function stringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return '';
  }
}

type ScenarioManagerProps = {
  manifest: ScenarioManifestEntry[];
  initialScenario: ScenarioFile | null;
};

type EditorState = {
  label: string;
  description: string;
  metadata: string;
  steps: string;
};

function buildEditorState(scenario: ScenarioFile | null): EditorState {
  if (!scenario) {
    return {
      label: '',
      description: '',
      metadata: '',
      steps: ''
    };
  }

  return {
    label: scenario.label ?? '',
    description: scenario.description ?? '',
    metadata:
      scenario.metadata && typeof scenario.metadata === 'object'
        ? stringify(scenario.metadata)
        : '',
    steps: stringify(scenario.steps ?? [])
  };
}

function parseMetadata(value: string): Record<string, string> | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const result: Record<string, string> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, val]) => {
      if (val === undefined || val === null) {
        return;
      }
      result[key] = typeof val === 'string' ? val : String(val);
    });
    return result;
  }

  throw new Error('Metadata must be a JSON object.');
}

function parseSteps(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Steps JSON is required.');
  }

  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error('Steps must be an array.');
  }

  return parsed;
}

export default function ScenarioManager({ manifest, initialScenario }: ScenarioManagerProps) {
  const [scenarioList, setScenarioList] = useState(manifest);
  const [selectedId, setSelectedId] = useState<string>(() => initialScenario?.id ?? manifest[0]?.id ?? '');
  const [scenario, setScenario] = useState<ScenarioFile | null>(initialScenario);
  const [editor, setEditor] = useState<EditorState>(() => buildEditorState(initialScenario));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditor(buildEditorState(scenario));
  }, [scenario]);

  const currentManifest = useMemo(() => scenarioList.find((entry) => entry.id === selectedId) ?? null, [
    scenarioList,
    selectedId
  ]);

  async function loadScenario(id: string) {
    if (!id) {
      setScenario(null);
      setEditor(buildEditorState(null));
      return;
    }

    if (scenario && scenario.id === id) {
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const res = await fetch(`/api/deice/scenarios/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load scenario (${res.status})`);
      }

      const data = (await res.json()) as ScenarioFile;
      setScenario(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load scenario';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeSelection(event: ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    setSelectedId(id);
    await loadScenario(id);
  }

  function handleEditorChange(field: keyof EditorState, value: string) {
    setEditor((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedId) {
      setError('Select a scenario before saving.');
      return;
    }

    const label = editor.label.trim();
    if (!label) {
      setError('Scenario label is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setStatus(null);

      const metadata = parseMetadata(editor.metadata);
      const steps = parseSteps(editor.steps);

      const payload: ScenarioFile = {
        id: selectedId,
        label,
        ...(editor.description.trim() ? { description: editor.description.trim() } : {}),
        ...(metadata ? { metadata } : {}),
        steps
      };

      const res = await fetch(`/api/deice/scenarios/${selectedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scenario: payload })
      });

      if (!res.ok) {
        const message = await res.json().catch(() => ({ error: 'Unable to save scenario' }));
        throw new Error(message?.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as {
        scenario: ScenarioFile;
        manifest: ScenarioManifestEntry;
      };

      setScenario(data.scenario);
      setScenarioList((list) => {
        const existingIndex = list.findIndex((entry) => entry.id === data.manifest.id);
        if (existingIndex === -1) {
          return [...list, data.manifest].sort((a, b) => a.label.localeCompare(b.label));
        }

        const next = [...list];
        next.splice(existingIndex, 1, data.manifest);
        return next.sort((a, b) => a.label.localeCompare(b.label));
      });
      setStatus('Scenario saved successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save scenario';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scenario-manager">
      <div className="scenario-manager__header">
        <div>
          <label className="scenario-manager__label" htmlFor="scenario-select">
            Scenario
          </label>
          <select
            id="scenario-select"
            className="scenario-manager__select"
            value={selectedId}
            onChange={handleChangeSelection}
            disabled={loading || saving || scenarioList.length === 0}
          >
            {scenarioList.length === 0 ? (
              <option value="">No scenarios found</option>
            ) : null}
            {scenarioList.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        {currentManifest?.updatedAt ? (
          <p className="scenario-manager__meta">
            Last updated {new Date(currentManifest.updatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {error ? <p className="scenario-manager__status scenario-manager__status--error">{error}</p> : null}
      {status ? <p className="scenario-manager__status scenario-manager__status--success">{status}</p> : null}

      <form className="scenario-manager__form" onSubmit={handleSubmit}>
        <div className="scenario-manager__grid">
          <label className="scenario-manager__label" htmlFor="scenario-label">
            Label
          </label>
          <input
            id="scenario-label"
            type="text"
            className="scenario-manager__input"
            value={editor.label}
            onChange={(event) => handleEditorChange('label', event.target.value)}
            disabled={saving}
          />
        </div>

        <div className="scenario-manager__grid">
          <label className="scenario-manager__label" htmlFor="scenario-description">
            Description
          </label>
          <textarea
            id="scenario-description"
            className="scenario-manager__textarea"
            value={editor.description}
            onChange={(event) => handleEditorChange('description', event.target.value)}
            rows={3}
            disabled={saving}
          />
        </div>

        <div className="scenario-manager__grid">
          <label className="scenario-manager__label" htmlFor="scenario-metadata">
            Metadata JSON
          </label>
          <textarea
            id="scenario-metadata"
            className="scenario-manager__textarea scenario-manager__textarea--code"
            placeholder={`{
  "holdoverFluid": "Type IV"
}`}
            value={editor.metadata}
            onChange={(event) => handleEditorChange('metadata', event.target.value)}
            rows={6}
            disabled={saving}
          />
          <p className="scenario-manager__hint">Leave blank to remove metadata.</p>
        </div>

        <div className="scenario-manager__grid">
          <label className="scenario-manager__label" htmlFor="scenario-steps">
            Steps JSON
          </label>
          <textarea
            id="scenario-steps"
            className="scenario-manager__textarea scenario-manager__textarea--code"
            placeholder={`[{
  "role": "captain",
  "text": ""
}]`}
            value={editor.steps}
            onChange={(event) => handleEditorChange('steps', event.target.value)}
            rows={16}
            disabled={saving}
          />
          <p className="scenario-manager__hint">
            Provide an array of steps with <code>role</code>, <code>text</code>, optional <code>cue</code>, and
            <code>expected</code> phrases.
          </p>
        </div>

        <div className="scenario-manager__actions">
          <button type="submit" className="btn btn-primary" disabled={saving || loading || !selectedId}>
            {saving ? 'Saving...' : 'Save scenario'}
          </button>
        </div>
      </form>
    </div>
  );
}
