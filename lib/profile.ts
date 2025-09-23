import type { PostgrestError } from '@supabase/supabase-js';

const missingTableCodes = new Set(['PGRST301', 'PGRST302', '42P01']);

export function mapProfileError(error: PostgrestError | null): string | null {
  if (!error) return null;

  const normalizedMessage = error.message.toLowerCase();

  if (missingTableCodes.has(error.code ?? '') || normalizedMessage.includes('schema cache')) {
    return 'Profiles table missing. Run the SQL in sql/init.sql against your Supabase project to provision it.';
  }

  return 'Unable to load profile details right now.';
}
