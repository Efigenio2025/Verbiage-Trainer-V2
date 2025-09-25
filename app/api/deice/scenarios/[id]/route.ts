import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/serverSupabase';

function normalizeScenarioPayload(payload: unknown, fallbackId: string) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Scenario payload must be an object.');
  }

  const scenario = payload as Record<string, unknown>;
  const scenarioId = typeof scenario.id === 'string' && scenario.id.length > 0 ? scenario.id : fallbackId;

  if (!scenarioId) {
    throw new Error('Scenario must include an id.');
  }

  const label = scenario.label;
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error('Scenario label is required.');
  }

  const rawDescription =
    typeof scenario.description === 'string' ? scenario.description.trim() : '';
  const description = rawDescription.length ? rawDescription : null;
  const metadata =
    scenario.metadata && typeof scenario.metadata === 'object' ? scenario.metadata : null;
  const steps = scenario.steps;

  if (!Array.isArray(steps)) {
    throw new Error('Scenario steps must be an array.');
  }

  return {
    id: scenarioId,
    label: label.trim(),
    description,
    scenario: {
      id: scenarioId,
      label: label.trim(),
      ...(description ? { description } : {}),
      ...(metadata ? { metadata } : {}),
      steps
    }
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('deice_scenarios')
    .select('scenario')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.scenario) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data.scenario);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const scenarioInput = (payload as { scenario?: unknown })?.scenario ?? payload;

  let normalized;

  try {
    normalized = normalizeScenarioPayload(scenarioInput, params.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid scenario payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('deice_scenarios')
    .upsert(
      {
        id: normalized.id,
        label: normalized.label,
        description: normalized.description,
        scenario: normalized.scenario
      },
      { onConflict: 'id' }
    )
    .select('id, label, description, scenario, updated_at')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Unable to save scenario' }, { status: 500 });
  }

  return NextResponse.json({
    scenario: data.scenario,
    manifest: {
      id: data.id,
      label: data.label,
      description: data.description ?? '',
      updatedAt: data.updated_at ?? null
    }
  });
}
