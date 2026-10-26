import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Sistema de Testes A/B para páginas de venda.
 *
 * - Cookie `ab:<page_key>` com valor 'a' ou 'b' fixa a variante para o visitante (30 dias).
 * - Hook `useAbTest(pageKey)` deve ser chamado dentro da PÁGINA ORIGINAL.
 *   Se o sorteio cair em 'b' (ou se houver vencedor declarado), redireciona pra `variant_path`.
 * - Hook `useAbVariantTrack(pageKey, 'b')` deve ser chamado dentro da PÁGINA VARIANTE
 *   pra registrar visita e marcar o cookie caso o visitante tenha chegado direto pelo link.
 * - `trackAbConversion(pageKey)` é disparado no clique do CTA principal (ex: InitiateCheckout).
 */

export interface AbTestRow {
  id: string;
  page_key: string;
  page_label: string;
  original_path: string;
  variant_path: string;
  traffic_split_pct: number;
  status: 'active' | 'paused' | 'finished';
  winner: 'a' | 'b' | null;
  visits_a: number;
  visits_b: number;
  conversions_a: number;
  conversions_b: number;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function readVariant(pageKey: string): 'a' | 'b' | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )ab:' + pageKey + '=([ab])'));
  return (m?.[1] as 'a' | 'b' | null) ?? null;
}

function writeVariant(pageKey: string, v: 'a' | 'b') {
  if (typeof document === 'undefined') return;
  document.cookie = `ab:${pageKey}=${v}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

function trackVisitOnce(pageKey: string, variant: 'a' | 'b') {
  if (typeof window === 'undefined') return;
  const key = `ab-visit:${pageKey}:${variant}`;
  if (window.sessionStorage.getItem(key)) return;
  // PostgrestBuilder é thenable preguiçoso: precisa de .then() pra disparar a request.
  // Marca como visitado SOMENTE após sucesso, evitando perder eventos se a request falhar.
  Promise.resolve(
    supabase.rpc('ab_increment_visit' as any, { _page_key: pageKey, _variant: variant }),
  )
    .then(() => {
      try { window.sessionStorage.setItem(key, '1'); } catch { /* ignore */ }
    })
    .catch(() => { /* fire-and-forget */ });
}

function clearVariant(pageKey: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `ab:${pageKey}=; path=/; max-age=0`;
}

/**
 * Lê apenas a configuração de roteamento do teste (sem métricas internas),
 * via RPC pública. As contagens de visita/conversão ficam restritas ao admin.
 */
async function fetchTest(pageKey: string): Promise<AbTestRow | null> {
  const { data } = await supabase.rpc('get_ab_test_config' as any, { _page_key: pageKey });
  const row = Array.isArray(data) ? data[0] : data;
  return (row as any) ?? null;
}

function pickVariant(splitPct: number): 'a' | 'b' {
  // splitPct = % de tráfego enviado pra B
  return Math.random() * 100 < splitPct ? 'b' : 'a';
}

/** Página ORIGINAL: sorteia, redireciona se necessário, conta visita. */
export function useAbTest(pageKey: string, enabled = true) {
  const navigate = useNavigate();
  const location = useLocation();

  const [ready,setReady]=useState(false);
  const { data: test, isFetched } = useQuery({
    queryKey: ['ab-test', pageKey],
    enabled,
    queryFn: () => fetchTest(pageKey),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!enabled || !isFetched) return;
    if (!test) {setReady(true);return;}
    // Teste encerrado: força o vencedor
    if (test.status === 'finished' && test.winner) {
      if (test.winner === 'b' && location.pathname === test.original_path) {
        setReady(false);navigate(test.variant_path + location.search + location.hash, { replace: true });
      } else setReady(true);
      return;
    }
    if (test.status !== 'active') {setReady(true);return;}

    let variant = readVariant(pageKey);
    if (!variant) {
      variant = pickVariant(test.traffic_split_pct);
      writeVariant(pageKey, variant);
    }

    if (variant === 'b' && location.pathname === test.original_path) {
      setReady(false);navigate(test.variant_path + location.search + location.hash, { replace: true });
      return; // B records its own visit after arriving; never count the redirect twice.
    }
    if(variant==='a') {trackVisitOnce(pageKey,variant);setReady(true);}
  }, [enabled, isFetched, test, pageKey, navigate, location.pathname, location.search, location.hash]);
  return !enabled || ready;
}

/** Página VARIANTE B: garante cookie e conta visita se visitante chegou direto. */
export function useAbVariantTrack(pageKey: string, variant: 'b' = 'b', enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const current = readVariant(pageKey);
    if (current !== variant) {
      writeVariant(pageKey, variant);
    }
    trackVisitOnce(pageKey, variant);
  }, [pageKey, variant, enabled]);
}

/** Dispara conversão pra variante atual do visitante (lê do cookie). */
export function trackAbConversion(pageKey: string) {
  const variant = readVariant(pageKey);
  if (!variant) return;
  // PostgrestBuilder é thenable preguiçoso: precisa de .then() pra disparar a request.
  Promise.resolve(
    supabase.rpc('ab_increment_conversion' as any, { _page_key: pageKey, _variant: variant }),
  ).catch(() => { /* fire-and-forget */ });
}

export const _ab = { readVariant, writeVariant, clearVariant };
