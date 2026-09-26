/** Helper de compatibilidade: o antigo banner de instalação foi substituído pelo
 *  EngagementOrchestrator (modal pós-login). Mantido porque outros componentes
 *  (ex.: UserRecipes) ainda consultam para evitar empilhar CTAs — sempre false. */
export function shouldShowPwaGate(_opts: {
  isStandalone: boolean;
  hasInstalledBefore: boolean | null;
  loading: boolean;
}): boolean {
  return false;
}
