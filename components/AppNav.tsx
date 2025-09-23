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
      <nav className="app-nav__links">
        {userEmail ? (
          <>
            <span className="app-nav__user">{userEmail}</span>
            <Link href="/auth/logout" className="btn btn-outline">
              Sign out
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-subtle">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-primary">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
