export function purchaseDestination(productType?: string): string | null {
  if (productType === 'ebook') return '/app/ebooks';
  if (productType === 'course') return '/app/cursos';
  return null;
}

// Account and login URLs may only select a known internal purchase section.
export function accountDestination(value: string | null): string {
  return value === '/app/ebooks' || value === '/app/cursos' ? value : '/app';
}
