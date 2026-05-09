import React, { useMemo, useState } from 'react';
import { useAccessMetrics } from '@/hooks/useAccessMetrics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Users, TrendingUp, Clock, Award, Wine, Download, BookOpen, Activity, User as UserIcon, CalendarIcon } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import defaultCover from '@/assets/default-cover.png';

type Preset = 'today' | '7d' | '30d' | 'mtd' | 'custom';

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const formatSeconds = (sec: number) => {
  if (!sec || sec < 60) return `${Math.round(sec || 0)}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const presetLabels: Record<Exclude<Preset, 'custom'>, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
  mtd: 'Mês vigente',
};

const AdminAccessMetrics: React.FC = () => {
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (preset === 'today') return { from: startOfDay(now), to: endOfDay(now) };
    if (preset === '7d') {
      const f = new Date(now);
      f.setDate(f.getDate() - 6);
      return { from: startOfDay(f), to: endOfDay(now) };
    }
    if (preset === '30d') {
      const f = new Date(now);
      f.setDate(f.getDate() - 29);
      return { from: startOfDay(f), to: endOfDay(now) };
    }
    if (preset === 'mtd') {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(f), to: endOfDay(now) };
    }
    // custom — parse YYYY-MM-DD as LOCAL date (não UTC) pra não pular um dia em BRT
    const parseLocal = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    const f = customFrom ? parseLocal(customFrom) : startOfDay(now);
    const t = customTo ? parseLocal(customTo) : endOfDay(now);
    return { from: startOfDay(f), to: endOfDay(t) };
  }, [preset, customFrom, customTo]);

  const { data: metrics, isLoading } = useAccessMetrics(from, to);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Métricas de Acesso</h1>
        <p className="text-muted-foreground">Como os alunos estão usando a plataforma no período</p>
      </div>

      {/* Period selector */}
      <Card>
        <CardContent className="pt-4 pb-4 flex flex-wrap gap-2 items-center">
          {(['today', '7d', '30d', 'mtd'] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={preset === p ? 'default' : 'outline'}
              onClick={() => setPreset(p)}
            >
              {presetLabels[p]}
            </Button>
          ))}
          <Button size="sm" variant={preset === 'custom' ? 'default' : 'outline'} onClick={() => setPreset('custom')}>
            Personalizado
          </Button>
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-auto" />
              <span className="text-muted-foreground text-sm">até</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-auto" />
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : metrics ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">Acessos</span>
                </div>
                <p className="text-2xl font-bold">{metrics.total_sessions.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-medium">Usuários únicos</span>
                </div>
                <p className="text-2xl font-bold">{metrics.unique_users.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Tempo assistido</span>
                </div>
                <p className="text-2xl font-bold">{formatSeconds(metrics.total_watch_seconds)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Award className="h-4 w-4" />
                  <span className="text-xs font-medium">Certificados</span>
                </div>
                <p className="text-2xl font-bold">{metrics.certificates_total.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Cursos mais acessados */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />Cursos mais acessados</CardTitle>
                <CardDescription>Cada vez que a página do curso foi aberta</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  items={metrics.top_courses_views.map((c) => ({
                    id: c.id,
                    name: c.name,
                    image: c.cover_image_url,
                    metric: `${c.views.toLocaleString('pt-BR')} acessos`,
                  }))}
                  emptyText="Sem acessos no período"
                />
              </CardContent>
            </Card>

            {/* Cursos com mais tempo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Cursos com mais tempo de estudo</CardTitle>
                <CardDescription>Soma do tempo dos alunos assistindo aulas</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  items={metrics.top_courses_watch_time.map((c) => ({
                    id: c.id,
                    name: c.name,
                    image: c.cover_image_url,
                    metric: `${formatSeconds(c.total_seconds)} • ${c.unique_users} alunos`,
                  }))}
                  emptyText="Sem tempo registrado no período"
                />
              </CardContent>
            </Card>

            {/* Receitas exclusivas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Wine className="h-4 w-4" />Receitas mais visitadas</CardTitle>
                <CardDescription>Cada vez que uma receita exclusiva foi aberta</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  items={metrics.top_exclusive_posts.map((r) => ({
                    id: r.id,
                    name: r.name,
                    image: r.cover_image_url,
                    metric: `${r.views.toLocaleString('pt-BR')} visualizações`,
                  }))}
                  emptyText="Sem visualizações no período"
                />
              </CardContent>
            </Card>

            {/* Usuários ativos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Usuários mais ativos</CardTitle>
                <CardDescription>Pontos por engajamento (1 ponto por: sessão, receita, aula, curso, e-book, certificado)</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  items={metrics.top_active_users.map((u) => {
                    const parts: string[] = [];
                    if (u.sessions_count) parts.push(`${u.sessions_count} sess.`);
                    if (u.exclusive_posts) parts.push(`${u.exclusive_posts} receitas`);
                    if (u.lessons) parts.push(`${u.lessons} aulas`);
                    if (u.courses) parts.push(`${u.courses} cursos`);
                    if (u.ebooks) parts.push(`${u.ebooks} ebooks`);
                    if (u.certificates) parts.push(`${u.certificates} cert.`);
                    return {
                      id: u.user_id,
                      name: u.full_name || u.email,
                      subtitle: parts.join(' · ') || (u.full_name ? u.email : undefined),
                      image: u.avatar_url,
                      rounded: true,
                      metric: `${u.points.toLocaleString('pt-BR')} pts`,
                    };
                  })}
                  emptyText="Sem usuários ativos no período"
                />
              </CardContent>
            </Card>

            {/* Certificados */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />Certificados gerados</CardTitle>
                <CardDescription>Por curso/módulo no período</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  items={metrics.certificates_generated.map((c, i) => ({
                    id: `${c.name}-${i}`,
                    name: c.name,
                    subtitle: c.type,
                    metric: `${c.total.toLocaleString('pt-BR')} emitidos`,
                  }))}
                  emptyText="Nenhum certificado emitido no período"
                />
              </CardContent>
            </Card>

            {/* Ebooks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" />E-books mais baixados</CardTitle>
                <CardDescription>Cliques no botão "Baixar / Abrir e-book"</CardDescription>
              </CardHeader>
              <CardContent>
                <RankList
                  items={metrics.top_ebooks_downloads.map((e) => ({
                    id: e.id,
                    name: e.name,
                    image: e.cover_image_url,
                    metric: `${e.downloads.toLocaleString('pt-BR')} downloads`,
                  }))}
                  emptyText="Sem downloads no período"
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};

interface RankItem {
  id: string;
  name: string;
  subtitle?: string;
  image?: string | null;
  metric: string;
  rounded?: boolean;
}

const RankList: React.FC<{ items: RankItem[]; emptyText: string }> = ({ items, emptyText }) => {
  if (!items.length) {
    return <p className="text-muted-foreground text-sm text-center py-6">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((it, idx) => (
        <li key={it.id} className="flex items-center gap-3 py-1">
          <span className="w-6 text-xs font-bold text-muted-foreground tabular-nums text-right">{idx + 1}.</span>
          {it.rounded && !it.image ? (
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : (
            <img
              src={it.image || defaultCover}
              alt=""
              className={`h-10 w-10 ${it.rounded ? 'rounded-full' : 'rounded-md'} object-cover bg-muted shrink-0`}
              onError={(e) => {
                if (it.rounded) {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('[data-avatar-fallback]')) {
                    const div = document.createElement('div');
                    div.setAttribute('data-avatar-fallback', '');
                    div.className = 'h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0';
                    div.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                    e.currentTarget.insertAdjacentElement('afterend', div);
                  }
                } else {
                  (e.currentTarget as HTMLImageElement).src = defaultCover;
                }
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{it.name}</p>
            {it.subtitle && <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>}
          </div>
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">{it.metric}</span>
        </li>
      ))}
    </ul>
  );
};

export default AdminAccessMetrics;
