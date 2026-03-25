import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRecipes } from '@/hooks/useRecipes';
import { usePackages } from '@/hooks/usePackages';
import { BookOpen, Package, FileCheck, FilePen, BellRing, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AdminDashboard: React.FC = () => {
  const { data: recipes = [] } = useRecipes();
  const { data: packages = [] } = usePackages();
  const [runningStudy, setRunningStudy] = useState(false);
  const [runningUpsell, setRunningUpsell] = useState(false);

  const publishedRecipes = recipes.filter((r) => r.status === 'published').length;
  const draftRecipes = recipes.filter((r) => r.status === 'draft').length;
  const activePackages = packages.filter((p) => p.is_active).length;

  const stats = [
    {
      title: 'Total de Receitas',
      value: recipes.length,
      description: 'Receitas cadastradas',
      icon: BookOpen,
      color: 'text-primary',
    },
    {
      title: 'Publicadas',
      value: publishedRecipes,
      description: 'Receitas ativas',
      icon: FileCheck,
      color: 'text-success',
    },
    {
      title: 'Rascunhos',
      value: draftRecipes,
      description: 'Aguardando publicação',
      icon: FilePen,
      color: 'text-warning',
    },
    {
      title: 'Pacotes Ativos',
      value: activePackages,
      description: `de ${packages.length} pacotes`,
      icon: Package,
      color: 'text-accent',
    },
  ];

  const handleRunStudyReminders = async () => {
    setRunningStudy(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-study-reminders', {
        body: { forceRun: true },
      });
      if (error) throw error;
      toast.success(`Study reminders disparados! ${data?.notified ?? 0} alunos notificados.`);
    } catch (err: any) {
      toast.error('Erro ao disparar study reminders: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setRunningStudy(false);
    }
  };

  const handleRunUpsell = async () => {
    setRunningUpsell(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const { data, error } = await supabase.functions.invoke('process-upsell', {
        body: {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (error) throw error;
      toast.success(`Upsell processado! ${data?.processed ?? 0} sequências processadas.`);
    } catch (err: any) {
      toast.error('Erro ao processar upsell: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setRunningUpsell(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu conteúdo</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <CardDescription>{stat.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Ações Rápidas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Study Reminders</CardTitle>
              </div>
              <CardDescription>
                Dispara lembretes de estudo para alunos inativos há mais de 7 dias.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleRunStudyReminders}
                disabled={runningStudy}
                variant="outline"
                className="w-full"
              >
                {runningStudy ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disparando...</>
                ) : (
                  <><BellRing className="h-4 w-4 mr-2" />Disparar agora</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Processar Upsell</CardTitle>
              </div>
              <CardDescription>
                Processa sequências de upsell ativas e envia próximas mensagens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleRunUpsell}
                disabled={runningUpsell}
                variant="outline"
                className="w-full"
              >
                {runningUpsell ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                ) : (
                  <><TrendingUp className="h-4 w-4 mr-2" />Processar agora</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
