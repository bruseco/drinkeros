import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BarChart3, Send, Users, UserCheck, TrendingUp } from 'lucide-react';

interface ReminderStats {
  total_reminders: number;
  total_sent: number;
  total_notified_users: number;
  total_reconquered: number;
}

const StudyReminderStats: React.FC = () => {
  const { data: stats, isLoading } = useQuery<ReminderStats>({
    queryKey: ['study-reminder-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_study_reminder_stats');
      if (error) throw error;
      return data as unknown as ReminderStats;
    },
    refetchInterval: 60_000,
  });

  const reconquestRate =
    stats && stats.total_notified_users > 0
      ? Math.round((stats.total_reconquered / stats.total_notified_users) * 100)
      : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Métricas de Lembrete de Estudo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border p-4">
                <div className="h-4 w-20 bg-muted rounded mb-2" />
                <div className="h-8 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      label: 'Lembretes enviados',
      value: stats?.total_reminders ?? 0,
      description: 'Disparos realizados',
      icon: Send,
    },
    {
      label: 'Notificações entregues',
      value: stats?.total_sent ?? 0,
      description: 'Push + emails enviados',
      icon: BarChart3,
    },
    {
      label: 'Alunos notificados',
      value: stats?.total_notified_users ?? 0,
      description: 'Alunos únicos alcançados',
      icon: Users,
    },
    {
      label: 'Alunos reconquistados',
      value: stats?.total_reconquered ?? 0,
      description: `${reconquestRate}% de reconquista`,
      icon: UserCheck,
      highlight: true,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Métricas de Lembrete de Estudo
        </CardTitle>
        <CardDescription>
          Acompanhe o impacto dos lembretes automáticos de estudo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`rounded-lg border p-4 space-y-1 ${
                metric.highlight ? 'border-primary/50 bg-primary/5' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {metric.label}
                </span>
                <metric.icon
                  className={`h-4 w-4 ${
                    metric.highlight ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
              </div>
              <p className={`text-2xl font-bold ${metric.highlight ? 'text-primary' : 'text-foreground'}`}>
                {metric.value}
              </p>
              <p className="text-xs text-muted-foreground">{metric.description}</p>
            </div>
          ))}
        </div>

        {stats && stats.total_notified_users > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <TrendingUp className="h-4 w-4 text-primary shrink-0" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">{reconquestRate}%</strong> dos alunos que receberam
              lembretes voltaram a acessar aulas — 
              <strong className="text-foreground">{stats.total_reconquered}</strong> de{' '}
              <strong className="text-foreground">{stats.total_notified_users}</strong> alunos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudyReminderStats;
