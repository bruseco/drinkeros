import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Eye, MousePointerClick, Users, TrendingUp, BarChart3, Percent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

interface UxMetrics {
  total_sessions: number;
  total_views: number;
  total_clicks: number;
  unique_users: number;
  avg_scroll_depth: number | null;
  ctr: number;
  clicks_by_position: Array<{ position: number; clicks: number }>;
  views_by_position: Array<{ position: number; views: number }>;
  daily_events: Array<{ day: string; sessions: number; views: number; clicks: number }>;
  recent_agent_calls: Array<{ user_id: string; position: number; created_at: string }>;
}

const AdminUXMetrics: React.FC = () => {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['ux-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ux_metrics');
      if (error) throw error;
      return data as unknown as UxMetrics;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) return null;

  // Merge views and clicks by position for the bar chart
  const positionData = (() => {
    const map = new Map<number, { position: number; views: number; clicks: number; ctr: number }>();
    for (const v of metrics.views_by_position) {
      map.set(v.position, { position: v.position, views: v.views, clicks: 0, ctr: 0 });
    }
    for (const c of metrics.clicks_by_position) {
      const existing = map.get(c.position) || { position: c.position, views: 0, clicks: 0, ctr: 0 };
      existing.clicks = c.clicks;
      existing.ctr = existing.views > 0 ? Math.round((c.clicks / existing.views) * 100) : 0;
      map.set(c.position, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.position - b.position);
  })();

  const dailyData = [...(metrics.daily_events || [])].reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Métricas UX — Agente de Posicionamento</h1>
        <p className="text-muted-foreground">Performance do posicionamento dinâmico do upsell</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Usuários</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.unique_users}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Sessões</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.total_sessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-xs font-medium">Views</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.total_views}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-xs font-medium">Cliques</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.total_clicks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Percent className="h-4 w-4" />
              <span className="text-xs font-medium">CTR</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.ctr}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Scroll Médio</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.avg_scroll_depth ?? 0}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Performance by Position */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance por Posição</CardTitle>
            <CardDescription>Views vs Cliques em cada posição do upsell</CardDescription>
          </CardHeader>
          <CardContent>
            {positionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={positionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="position" label={{ value: 'Posição', position: 'insideBottom', offset: -5 }} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    labelFormatter={(v) => `Posição ${v}`}
                  />
                  <Legend />
                  <Bar dataKey="views" name="Views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clicks" name="Cliques" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">Sem dados de posição ainda</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendência Diária (30 dias)</CardTitle>
            <CardDescription>Sessões, views e cliques por dia</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString('pt-BR')}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="sessions" name="Sessões" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="views" name="Views" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="clicks" name="Cliques" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">Sem dados diários ainda</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Agent Decisions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas Decisões do Agente</CardTitle>
          <CardDescription>Posições onde o upsell foi exibido recentemente</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.recent_agent_calls.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Usuário</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Posição</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recent_agent_calls.map((call, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-xs text-foreground">{call.user_id.slice(0, 8)}...</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {call.position}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {new Date(call.created_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma decisão registrada ainda</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUXMetrics;
