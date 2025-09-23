# Polar Ops Auth

A Next.js 14 App Router starter with Supabase email/password authentication and a frosted Polar Ops theme.

## Features

- Supabase email/password authentication with verification, login, logout, and password reset.
- Secure http-only cookies (`sb-access-token`, `sb-refresh-token`) for protected sessions.
- Polar themed UI with reusable `PolarCard`, `AppNav`, and `RoleBadge` components.
- Protected dashboard at `/app` guarded by middleware.
- Server/client Supabase helpers for both environments.
- Starter SQL for Supabase schema, trigger, and policies.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create an `.env.local` file with the required variables:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_APP_BRAND=Polar Ops Command
   ```

   > The service role key is only used on the server. Do not expose it to the browser.

3. Apply the SQL in [`sql/init.sql`](sql/init.sql) to your Supabase project to create the `profiles` table, trigger, and row-level policies.

4. Run the development server:

   ```bash
   npm run dev
   ```

   The app is available at [http://localhost:3000](http://localhost:3000).

## Supabase Environment

- After signing up, users must verify their email via the Supabase email link which redirects through `/auth/callback` and sets secure cookies.
- Password resets send users through the same callback flow before landing on `/auth/reset` to set a new password.

## Scripts

- `npm run dev` – start Next.js in development mode.
- `npm run build` – create an optimized production build.
- `npm run start` – run the production build.
- `npm run lint` – lint the project with ESLint.

## License

MIT
