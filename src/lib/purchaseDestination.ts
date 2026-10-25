export function purchaseDestination(productType?: string): string | null {
  if (productType === 'ebook') return '/app/ebooks';
  if (productType === 'course') return '/app/cursos';
  return null;
}

// Account and login URLs may only select a known internal purchase section.
export function accountDestination(value: string | null): string {
  if (value === '/clube/boas-vindas') return value;
  if (value === '/clube-receitas') return value;
  if (value === '/pv-clube' || value === '/pv-clube-b') return '/pv-clube-b';
  if (value === '/checkout/club/clube-anual' || value === '/checkout/club/clube') return value;
  return value === '/app/ebooks' || value === '/app/cursos' ? value : '/app';
}
