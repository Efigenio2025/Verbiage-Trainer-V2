import Link from 'next/link';

type AppNavProps = {
  brand: string;
  userEmail: string | null;
};

export default function AppNav({ brand, userEmail }: AppNavProps) {
  return (
    <header className="app-nav">
      <Link href="/" className="app-nav__brand">
        {brand}
      </Link>
      {userEmail ? (
        <nav className="app-nav__links">
          <span className="app-nav__user">{userEmail}</span>
          <Link href="/auth/logout" className="btn btn-outline">
            Sign out
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
