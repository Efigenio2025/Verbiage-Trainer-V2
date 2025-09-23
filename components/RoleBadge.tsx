const LABELS: Record<string, string> = {
  employee: 'Employee',
  manager: 'Manager',
  admin: 'Admin'
};

export default function RoleBadge({ role }: { role: string }) {
  const normalized = role?.toLowerCase() ?? 'employee';
  const label = LABELS[normalized] ?? LABELS.employee;
  const tone = normalized === 'admin' ? 'badge-admin' : normalized === 'manager' ? 'badge-manager' : 'badge-employee';

  return <span className={`role-badge ${tone}`}>{label}</span>;
}
