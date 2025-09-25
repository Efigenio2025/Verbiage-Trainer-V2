import { notFound, redirect } from 'next/navigation';
import PolarCard from '@/components/PolarCard';
import ScenarioManager from '@/components/deice/ScenarioManager';
import { createServerSupabase } from '@/lib/serverSupabase';
import type { ScenarioFile, ScenarioManifestEntry } from '@/lib/deice/types';

export const metadata = {
  title: 'Manage de-ice scenarios'
};

type ScenarioRow = {
  id: string;
  label: string;
  description: string | null;
  scenario: ScenarioFile;
  updated_at: string | null;
};

type ManageScenariosPageProps = {
  params: {
    slug: string;
  };
};

export default async function ManageScenariosPage({ params }: ManageScenariosPageProps) {
  if (params.slug !== 'de-ice-procedures') {
    notFound();
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/app');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (profile?.role !== 'admin') {
    notFound();
  }

  const { data, error } = await supabase
    .from('deice_scenarios')
    .select('id, label, description, scenario, updated_at')
    .order('label');

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as ScenarioRow[];

  const manifest: ScenarioManifestEntry[] = rows
    .map((row) => ({
      id: row.id,
      label: row.label,
      description: row.description ?? '',
      updatedAt: row.updated_at ?? null
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const initialScenarioId = manifest[0]?.id;
  const initialScenario = initialScenarioId
    ? rows.find((row) => row.id === initialScenarioId)?.scenario ?? null
    : null;

  return (
    <main className="page">
      <PolarCard
        title="De-ice scenario catalog"
        subtitle="Update live simulator flows without redeploying the trainer."
        className="dashboard-card training-detail-card"
      >
        {manifest.length === 0 ? (
          <p className="muted">No scenarios have been published yet.</p>
        ) : null}
        <ScenarioManager manifest={manifest} initialScenario={initialScenario} />
      </PolarCard>
    </main>
  );
}
