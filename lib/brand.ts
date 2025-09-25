export const defaultBrand = 'AeroElevate';

export function getBrandName(): string {
  return process.env.NEXT_PUBLIC_APP_BRAND ?? defaultBrand;
}
