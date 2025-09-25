import employeesData from '@/data/employees.json';

export type EmployeeLinks = {
  desktop?: string;
  mobile?: string;
  profile?: string;
};

export type EmployeeProfile = {
  id: string;
  name: string;
  role: string;
  base: string;
  department?: string;
  email?: string;
  defaultScenario?: string;
  prefersMobile?: boolean;
  tags?: string[];
  qualifications?: string[];
  links?: EmployeeLinks;
  isDefault?: boolean;
};

const EMPLOYEES: EmployeeProfile[] = employeesData as EmployeeProfile[];

export function listEmployees(): EmployeeProfile[] {
  return EMPLOYEES;
}

export function getEmployeeById(id: string): EmployeeProfile | undefined {
  return EMPLOYEES.find((employee) => employee.id === id);
}

export function getDefaultEmployee(): EmployeeProfile | undefined {
  return EMPLOYEES.find((employee) => employee.isDefault) ?? EMPLOYEES[0];
}

export function getEmployeeLauncher(
  id: string,
  type: keyof EmployeeLinks
): string | undefined {
  return getEmployeeById(id)?.links?.[type];
}
