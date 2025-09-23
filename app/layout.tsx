import type { Metadata } from 'next';
import { PropsWithChildren } from 'react';
import '../polar.css';
import AppNav from '@/components/AppNav';
import { createServerSupabase } from '@/lib/serverSupabase';

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_BRAND ? `${process.env.NEXT_PUBLIC_APP_BRAND} | Polar Ops` : 'Polar Ops',
  description: 'Polar Ops themed authentication starter with Supabase.'
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const brand = process.env.NEXT_PUBLIC_APP_BRAND ?? 'Polar Ops';
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="polar-body">
        <AppNav brand={brand} userEmail={user?.email ?? null} />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
