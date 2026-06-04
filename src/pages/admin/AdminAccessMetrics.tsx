import React, { useMemo, useState } from 'react';
import { useAccessMetrics } from '@/hooks/useAccessMetrics';
import { useSignupsCount } from '@/hooks/useSignupsCount';
import { useDemographicsMetrics } from '@/hooks/useDemographicsMetrics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Users, TrendingUp, Clock, Award, Wine, Download, BookOpen, Activity, User as UserIcon, UserPlus, CalendarIcon, Heart, BarChart3, Repeat } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import defaultCover from '@/assets/default-cover.png';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';



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
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

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
    const f = customFrom ?? now;
    const t = customTo ?? now;
    return { from: startOfDay(f), to: endOfDay(t) };
  }, [preset, customFrom, customTo]);
  const { data: demographics } = useDemographicsMetrics();


  const { data: metrics, isLoading } = useAccessMetrics(from, to);
  const { data: signupsCount } = useSignupsCount(from, to);

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
            <div className="flex items-center gap-2 ml-2 flex-wrap">
              <DatePickerButton value={customFrom} onChange={setCustomFrom} placeholder="Data inicial" />
              <span className="text-muted-foreground text-sm">até</span>
              <DatePickerButton value={customTo} onChange={setCustomTo} placeholder="Data final" />
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <UserPlus className="h-4 w-4" />
                  <span className="text-xs font-medium">Cadastros</span>
                </div>
                <p className="text-2xl font-bold">{(signupsCount ?? 0).toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Usuários por categoria (totais da plataforma) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Usuários por categoria
              </CardTitle>
              <CardDescription>Total de cadastrados em cada plano (visão atual)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <PlanStat label="Grátis" value={metrics.users_by_plan?.free ?? 0} tone="muted" />
                <PlanStat label="Alunos" value={metrics.users_by_plan?.aluno ?? 0} tone="info" />
                <PlanStat label="Sócios" value={metrics.users_by_plan?.socio ?? 0} tone="primary" />
                <PlanStat label="Vitalícios" value={metrics.users_by_plan?.vitalicio ?? 0} tone="gold" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Total: {(metrics.users_by_plan?.total ?? 0).toLocaleString('pt-BR')} usuários
              </p>
            </CardContent>
          </Card>

          {/* Demografia: Sexo, Idade, Interesse */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4" /> Demografia dos usuários
              </CardTitle>
              <CardDescription>Distribuição por sexo, faixa etária e interesse declarado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DemoPie
                  title="Sexo"
                  data={[
                    { name: 'Masculino', value: demographics?.gender.masculino ?? 0, color: 'hsl(217 91% 60%)' },
                    { name: 'Feminino', value: demographics?.gender.feminino ?? 0, color: 'hsl(330 81% 60%)' },
                    { name: 'Outro', value: demographics?.gender.outro ?? 0, color: 'hsl(45 93% 58%)' },
                    { name: 'Não informou', value: demographics?.gender.nao_informado ?? 0, color: 'hsl(220 9% 46%)' },
                  ]}
                  total={demographics?.gender.total ?? 0}
                />
                <DemoPie
                  title="Idade"
                  data={[
                    { name: '< 18', value: demographics?.age.menor_18 ?? 0, color: 'hsl(280 70% 60%)' },
                    { name: '18-24', value: demographics?.age.de_18_24 ?? 0, color: 'hsl(217 91% 60%)' },
                    { name: '25-34', value: demographics?.age.de_25_34 ?? 0, color: 'hsl(160 65% 45%)' },
                    { name: '35-44', value: demographics?.age.de_35_44 ?? 0, color: 'hsl(45 93% 58%)' },
                    { name: '45-54', value: demographics?.age.de_45_54 ?? 0, color: 'hsl(20 90% 55%)' },
                    { name: '55+', value: demographics?.age.mais_55 ?? 0, color: 'hsl(0 75% 55%)' },
                    { name: 'Não informou', value: demographics?.age.nao_informado ?? 0, color: 'hsl(220 9% 46%)' },
                  ]}
                  total={demographics?.age.total ?? 0}
                />
                <DemoPie
                  title="Interesse"
                  data={[
                    { name: 'Profissional', value: demographics?.interests.profissional ?? 0, color: 'hsl(var(--primary))' },
                    { name: 'Curtição', value: demographics?.interests.curticao ?? 0, color: 'hsl(217 91% 60%)' },
                    { name: 'Ambos', value: demographics?.interests.ambos ?? 0, color: 'hsl(45 93% 58%)' },
                    { name: 'Não informou', value: demographics?.interests.nenhum ?? 0, color: 'hsl(220 9% 46%)' },
                  ]}
                  total={demographics?.interests.total ?? 0}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recorrência de uso */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Repeat className="h-4 w-4" /> Recorrência de uso do app
              </CardTitle>
              <CardDescription>Visão vitalícia: quantos dias distintos cada usuário acessou o app desde o cadastro</CardDescription>
            </CardHeader>
            <CardContent>
              <RecurrenceChart data={demographics?.recurrence} />
            </CardContent>
          </Card>





          {/* Acessos por categoria no período */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Acessos por categoria no período
              </CardTitle>
              <CardDescription>
                Cursos, receitas, e-books e aulas abertos — divididos pelo plano atual do usuário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <PlanStat
                  label="Grátis"
                  value={metrics.accesses_by_plan?.free ?? 0}
                  subtitle={`${metrics.unique_users_by_plan?.free ?? 0} usuários únicos`}
                  tone="muted"
                />
                <PlanStat
                  label="Alunos"
                  value={metrics.accesses_by_plan?.aluno ?? 0}
                  subtitle={`${metrics.unique_users_by_plan?.aluno ?? 0} usuários únicos`}
                  tone="info"
                />
                <PlanStat
                  label="Sócios"
                  value={metrics.accesses_by_plan?.socio ?? 0}
                  subtitle={`${metrics.unique_users_by_plan?.socio ?? 0} usuários únicos`}
                  tone="primary"
                />
                <PlanStat
                  label="Vitalícios"
                  value={metrics.accesses_by_plan?.vitalicio ?? 0}
                  subtitle={`${metrics.unique_users_by_plan?.vitalicio ?? 0} usuários únicos`}
                  tone="gold"
                />
              </div>
              {(metrics.accesses_by_plan?.unknown ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {(metrics.accesses_by_plan?.unknown ?? 0).toLocaleString('pt-BR')} acessos de usuários sem perfil identificado.
                </p>
              )}
            </CardContent>
          </Card>

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

const DatePickerButton: React.FC<{ value: Date | undefined; onChange: (d: Date | undefined) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal', !value && 'text-muted-foreground')}>
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={value} onSelect={onChange} initialFocus locale={ptBR} />
    </PopoverContent>
  </Popover>
);

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

const PlanStat: React.FC<{
  label: string;
  value: number;
  subtitle?: string;
  tone?: 'muted' | 'info' | 'primary' | 'gold';
}> = ({ label, value, subtitle, tone = 'muted' }) => {
  const toneClasses: Record<string, string> = {
    muted: 'border-border bg-muted/40 text-foreground',
    info: 'border-blue-500/30 bg-blue-500/5 text-foreground',
    primary: 'border-primary/40 bg-primary/5 text-foreground',
    gold: 'border-amber-400/40 bg-amber-400/5 text-foreground',
  };
  const dotClasses: Record<string, string> = {
    muted: 'bg-muted-foreground',
    info: 'bg-blue-500',
    primary: 'bg-primary',
    gold: 'bg-amber-400',
  };
  return (
    <div className={cn('rounded-lg border p-3', toneClasses[tone])}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
        <span className={cn('h-2 w-2 rounded-full', dotClasses[tone])} />
        {label}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString('pt-BR')}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
};

interface PieDatum { name: string; value: number; color: string }

const DemoPie: React.FC<{ title: string; data: PieDatum[]; total: number }> = ({ title, data, total }) => {
  const filtered = data.filter((d) => d.value > 0);
  const hasData = filtered.length > 0;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <span className="text-xs text-muted-foreground tabular-nums">{total.toLocaleString('pt-BR')}</span>
      </div>
      <div className="h-44">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={36} outerRadius={64} paddingAngle={2} stroke="none">
                {filtered.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <RTooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, n) => [`${v.toLocaleString('pt-BR')} (${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%)`, n]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Sem dados</div>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-muted-foreground flex-1 truncate">{d.name}</span>
            <span className="tabular-nums font-medium text-foreground">{d.value.toLocaleString('pt-BR')}</span>
            <span className="tabular-nums text-muted-foreground w-10 text-right">
              {total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const RecurrenceChart: React.FC<{ data?: DemographicsMetricsRecurrence }> = ({ data }) => {
  const rows = [
    { label: '1 dia', value: data?.b_1 ?? 0 },
    { label: '2–4 dias', value: data?.b_2_4 ?? 0 },
    { label: '5–49 dias', value: data?.b_5_plus ?? 0 },
    { label: '50–99 dias', value: data?.b_50_plus ?? 0 },
    { label: '100–499 dias', value: data?.b_100_plus ?? 0 },
    { label: '500–999 dias', value: data?.b_500_plus ?? 0 },
    { label: '+1000 dias', value: data?.b_1000_plus ?? 0 },
  ];
  return (
    <div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <RTooltip
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [v.toLocaleString('pt-BR'), 'Usuários']}
            />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]}>
              <LabelList dataKey="value" position="top" style={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Total de usuários com pelo menos 1 dia de acesso registrado desde a existência do app: {(data?.total ?? 0).toLocaleString('pt-BR')}
      </p>
    </div>
  );
};

type DemographicsMetricsRecurrence = NonNullable<ReturnType<typeof useDemographicsMetrics>['data']>['recurrence'];

export default AdminAccessMetrics;

