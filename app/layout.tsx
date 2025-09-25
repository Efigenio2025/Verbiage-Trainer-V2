import type { Metadata } from 'next';
import { PropsWithChildren } from 'react';
import '../polar.css';
import AppNav from '@/components/AppNav';
import { defaultBrand, getBrandName } from '@/lib/brand';
import { createServerSupabase } from '@/lib/serverSupabase';

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_BRAND
    ? `${process.env.NEXT_PUBLIC_APP_BRAND} | ${defaultBrand}`
    : defaultBrand,
  description: `${defaultBrand} themed authentication starter with Supabase.`
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const brand = getBrandName();
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
