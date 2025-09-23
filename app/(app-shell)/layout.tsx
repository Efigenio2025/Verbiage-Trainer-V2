import { PropsWithChildren } from 'react';

export default function AppShellLayout({ children }: PropsWithChildren) {
  return <div className="app-shell">{children}</div>;
}
