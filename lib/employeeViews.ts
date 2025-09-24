export const EMPLOYEE_VIEWS = ['home', 'library', 'profile'] as const;

export type EmployeeView = (typeof EMPLOYEE_VIEWS)[number];

export function normalizeEmployeeView(view?: string | null | undefined): EmployeeView {
  if (!view) {
    return 'home';
  }

  return EMPLOYEE_VIEWS.includes(view as EmployeeView) ? (view as EmployeeView) : 'home';
}
