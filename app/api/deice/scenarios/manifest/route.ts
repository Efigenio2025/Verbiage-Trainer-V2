import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/serverSupabase';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('deice_scenarios')
    .select('id, label, description, updated_at')
    .order('label');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const scenarios = (data ?? []).map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description ?? '',
    updatedAt: entry.updated_at ?? null
  }));

  return NextResponse.json({ scenarios });
}
