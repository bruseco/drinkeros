import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus,
  Search,
  Phone,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  X,
  CalendarIcon,
  Settings2,
  Save,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  CRMLead,
  CRM_STAGES,
  PICO_VENDAS_STAGES,
  ATENDIMENTO_STAGES,
  useCRMLeads,
  useCreateCRMLead,
  useUpdateLeadStage,
  useCRMTasksDueToday,
} from '@/hooks/useCRMLeads';
import { AdminCRMLeadDetail } from './AdminCRMLeadDetail';
import { CRMExcelImporter } from '@/components/admin/CRMExcelImporter';
import { CRMBulkTemplateDispatch } from '@/components/admin/CRMBulkTemplateDispatch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

function useAdminProfiles() {
  return useQuery({
    queryKey: ['admin-profiles-crm'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('is_admin', true);
      if (error) throw error;
      return data;
    },
  });
}

function useNurturingSettings() {
  return useQuery({
    queryKey: ['crm-automation-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_automation_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as { id: string; nurturing_enabled: boolean; nurturing_days: number; nurturing_stage: string };
    },
  });
}

const AdminCRM: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeFunnel, setActiveFunnel] = useState<'recovery' | 'pico_vendas' | 'atendimento'>('recovery');
  const activeStages = activeFunnel === 'recovery' ? CRM_STAGES : activeFunnel === 'pico_vendas' ? PICO_VENDAS_STAGES : ATENDIMENTO_STAGES;

  const { data: leads = [], isLoading } = useCRMLeads(false, activeFunnel);
  const { data: tasksDue = [] } = useCRMTasksDueToday();
  const { data: adminProfiles = [] } = useAdminProfiles();
  const createLead = useCreateCRMLead();
  const updateStage = useUpdateLeadStage();

  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const CARDS_PER_PAGE = 50;
  const getVisibleCount = (stageKey: string) => visibleCounts[stageKey] || CARDS_PER_PAGE;
  const showMore = (stageKey: string) =>
    setVisibleCounts(prev => ({ ...prev, [stageKey]: (prev[stageKey] || CARDS_PER_PAGE) + CARDS_PER_PAGE }));
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nurturingOpen, setNurturingOpen] = useState(false);

  // Nurturing settings
  const { data: nurturingSettings } = useNurturingSettings();
  const [nurturingEnabled, setNurturingEnabled] = useState(false);
  const [nurturingDays, setNurturingDays] = useState(7);

  useEffect(() => {
    if (nurturingSettings) {
      setNurturingEnabled(nurturingSettings.nurturing_enabled);
      setNurturingDays(nurturingSettings.nurturing_days);
    }
  }, [nurturingSettings]);

  // Auto-open lead from URL param (?lead=<id>)
  useEffect(() => {
    const leadId = searchParams.get('lead');
    if (!leadId || isLoading || leads.length === 0) return;
    const found = leads.find(l => l.id === leadId);
    if (found) {
      setSelectedLead(found);
      setDetailOpen(true);
    }
    // Clear param from URL
    setSearchParams(prev => {
      prev.delete('lead');
      return prev;
    }, { replace: true });
  }, [searchParams, leads, isLoading]);

  // Sync selectedLead with fresh data from query
  useEffect(() => {
    if (!selectedLead) return;
    const freshLead = leads.find(l => l.id === selectedLead.id);
    if (freshLead) {
      setSelectedLead(freshLead);
    } else {
      // Lead no longer in list (converted/lost and filtered out)
      setSelectedLead(null);
      setDetailOpen(false);
    }
  }, [leads]);

  const saveNurturing = useMutation({
    mutationFn: async () => {
      if (!nurturingSettings) return;
      const { error } = await (supabase as any)
        .from('crm_automation_settings')
        .update({ nurturing_enabled: nurturingEnabled, nurturing_days: nurturingDays })
        .eq('id', nurturingSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configurações de nurturing salvas');
      queryClient.invalidateQueries({ queryKey: ['crm-automation-settings'] });
    },
    onError: (e: Error) => toast.error('Erro ao salvar: ' + e.message),
  });

  // Advanced filters
  const [filterProduct, setFilterProduct] = useState('__all__');
  const [filterSource, setFilterSource] = useState('__all__');
  const [filterAssignedTo, setFilterAssignedTo] = useState('__all__');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();

  // New lead form
  const defaultStage = activeFunnel === 'recovery' ? 'carrinho_abandonado_1' : activeFunnel === 'pico_vendas' ? 'entrada_contato' : 'entrada_contato_atend';
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    email: '',
    product_name: '',
    sale_value: '',
    source: 'manual',
    stage: defaultStage,
    recovery_url: '',
  });

  // Reset filters & form when switching funnels
  useEffect(() => {
    clearFilters();
    setSearch('');
    setVisibleCounts({});
    setNewLead(p => ({ ...p, stage: activeFunnel === 'recovery' ? 'carrinho_abandonado_1' : activeFunnel === 'pico_vendas' ? 'entrada_contato' : 'entrada_contato_atend' }));
  }, [activeFunnel]);

  // Derive unique product names and sources from leads
  const uniqueProducts = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.product_name) set.add(l.product_name); });
    return Array.from(set).sort();
  }, [leads]);

  const uniqueSources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => set.add(l.source));
    return Array.from(set).sort();
  }, [leads]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterProduct !== '__all__') count++;
    if (filterSource !== '__all__') count++;
    if (filterAssignedTo !== '__all__') count++;
    if (filterDateFrom) count++;
    if (filterDateTo) count++;
    return count;
  }, [filterProduct, filterSource, filterAssignedTo, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterProduct('__all__');
    setFilterSource('__all__');
    setFilterAssignedTo('__all__');
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
  };

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        l =>
          l.name.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.product_name?.toLowerCase().includes(q)
      );
    }

    // Product filter
    if (filterProduct !== '__all__') {
      result = result.filter(l => l.product_name === filterProduct);
    }

    // Source filter
    if (filterSource !== '__all__') {
      result = result.filter(l => l.source === filterSource);
    }

    // Assigned to filter
    if (filterAssignedTo !== '__all__') {
      if (filterAssignedTo === '__unassigned__') {
        result = result.filter(l => !l.assigned_to);
      } else {
        result = result.filter(l => l.assigned_to === filterAssignedTo);
      }
    }

    // Date range filter
    if (filterDateFrom) {
      const from = startOfDay(filterDateFrom);
      result = result.filter(l => new Date(l.created_at) >= from);
    }
    if (filterDateTo) {
      const to = endOfDay(filterDateTo);
      result = result.filter(l => new Date(l.created_at) <= to);
    }

    return result;
  }, [leads, search, filterProduct, filterSource, filterAssignedTo, filterDateFrom, filterDateTo]);

  const leadsByStage = useMemo(() => {
    const map: Record<string, CRMLead[]> = {};
    activeStages.forEach(s => (map[s.key] = []));
    filteredLeads.forEach(l => {
      if (map[l.stage]) map[l.stage].push(l);
    });
    return map;
  }, [filteredLeads, activeStages]);

  const totalValue = useMemo(
    () => filteredLeads.reduce((sum, l) => sum + (Number(l.sale_value) || 0), 0),
    [filteredLeads]
  );

  const overdueTasks = tasksDue.filter(
    t => new Date(t.due_date) < new Date()
  );

  const handleCreateLead = () => {
    createLead.mutate(
      {
        name: newLead.name,
        phone: newLead.phone || null,
        email: newLead.email || null,
        product_name: newLead.product_name || null,
        sale_value: newLead.sale_value ? Number(newLead.sale_value) : null,
        source: newLead.source,
        stage: newLead.stage,
        recovery_url: newLead.recovery_url || null,
        funnel: activeFunnel,
      } as any,
      {
        onSuccess: () => {
          setNewLeadOpen(false);
          setNewLead({
            name: '',
            phone: '',
            email: '',
            product_name: '',
            sale_value: '',
            source: 'manual',
            stage: activeFunnel === 'recovery' ? 'carrinho_abandonado_1' : activeFunnel === 'pico_vendas' ? 'entrada_contato' : 'entrada_contato_atend',
            recovery_url: '',
          });
        },
      }
    );
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    if (draggedLeadId) {
      updateStage.mutate({ id: draggedLeadId, stage: stageKey, userId: user?.id });
      setDraggedLeadId(null);
    }
  };

  const openLeadDetail = (lead: CRMLead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  const sourceLabels: Record<string, string> = {
    manual: 'Manual',
    woocommerce: 'WooCommerce',
    whatsapp: 'WhatsApp',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">CRM</h1>
            <p className="text-sm text-muted-foreground">
              {activeFunnel === 'recovery' ? 'Gerencie leads e recupere vendas perdidas' : activeFunnel === 'pico_vendas' ? 'Gerencie contatos do Pico de Vendas' : 'Gerencie contatos de atendimento'}
            </p>
          </div>
          <Select value={activeFunnel} onValueChange={(v: 'recovery' | 'pico_vendas' | 'atendimento') => setActiveFunnel(v)}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recovery">Recuperação de Vendas</SelectItem>
              <SelectItem value="pico_vendas">Pico de Vendas</SelectItem>
              <SelectItem value="atendimento">Atendimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {activeFunnel === 'recovery' && (
            <Button variant="outline" size="sm" onClick={() => setNurturingOpen(!nurturingOpen)}>
              <Settings2 className="h-4 w-4 mr-1" /> Nurturing
            </Button>
          )}
          {activeFunnel === 'pico_vendas' && (
            <>
              <CRMExcelImporter />
              <CRMBulkTemplateDispatch leads={leads} />
            </>
          )}
          <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={newLead.name}
                  onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nome do contato"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={newLead.phone}
                    onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))}
                    placeholder="5511999999999"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={newLead.email}
                    onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Produto</Label>
                  <Input
                    value={newLead.product_name}
                    onChange={e => setNewLead(p => ({ ...p, product_name: e.target.value }))}
                    placeholder="Nome do produto"
                  />
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    value={newLead.sale_value}
                    onChange={e => setNewLead(p => ({ ...p, sale_value: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <Label>Estágio Inicial</Label>
                <Select
                  value={newLead.stage}
                  onValueChange={v => setNewLead(p => ({ ...p, stage: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     {activeStages.map(s => (
                       <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                     ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Origem</Label>
                <Select
                  value={newLead.source}
                  onValueChange={v => setNewLead(p => ({ ...p, source: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="woocommerce">WooCommerce</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {activeFunnel === 'recovery' && (
                <div>
                  <Label>URL de Recuperação</Label>
                  <Input
                    value={newLead.recovery_url}
                    onChange={e => setNewLead(p => ({ ...p, recovery_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              )}
              <Button onClick={handleCreateLead} disabled={!newLead.name || createLead.isPending} className="w-full">
                {createLead.isPending ? 'Criando...' : 'Criar Lead'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Nurturing Settings */}
      <Collapsible open={nurturingOpen} onOpenChange={setNurturingOpen}>
        <CollapsibleContent>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Automação de Nurturing</h3>
                <p className="text-xs text-muted-foreground">Após X dias sem conversão, move leads para oferta alternativa e dispara WhatsApp</p>
              </div>
              <Switch checked={nurturingEnabled} onCheckedChange={setNurturingEnabled} />
            </div>
            <div className="flex items-end gap-3">
              <div className="w-40">
                <Label className="text-xs">Dias sem conversão</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={nurturingDays}
                  onChange={e => setNurturingDays(Number(e.target.value))}
                  className="h-9"
                />
              </div>
              <Button size="sm" onClick={() => saveNurturing.mutate()} disabled={saveNurturing.isPending}>
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor Total</p>
            <p className="text-lg font-bold">R$ {totalValue.toFixed(2)}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Leads Filtrados</p>
            <p className="text-lg font-bold">{filteredLeads.length}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tarefas Hoje</p>
            <p className="text-lg font-bold">{tasksDue.length}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2 rounded-md bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Atrasadas</p>
            <p className="text-lg font-bold">{overdueTasks.length}</p>
          </div>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar lead..."
              className="pl-9"
            />
          </div>
          <Button
            variant={activeFilterCount > 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent>
            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Product filter */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Produto</Label>
                  <Select value={filterProduct} onValueChange={setFilterProduct}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos os produtos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {uniqueProducts.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source filter */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Origem</Label>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas as origens" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas</SelectItem>
                      {uniqueSources.map(s => (
                        <SelectItem key={s} value={s}>{sourceLabels[s] || s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assigned to filter */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
                  <Select value={filterAssignedTo} onValueChange={setFilterAssignedTo}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      <SelectItem value="__unassigned__">Sem responsável</SelectItem>
                      {adminProfiles.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.full_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date range */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Período de criação</Label>
                  <div className="flex gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-9 flex-1 justify-start text-left font-normal text-xs", !filterDateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {filterDateFrom ? format(filterDateFrom, 'dd/MM/yy') : 'De'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filterDateFrom}
                          onSelect={setFilterDateFrom}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-9 flex-1 justify-start text-left font-normal text-xs", !filterDateTo && "text-muted-foreground")}>
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {filterDateTo ? format(filterDateTo, 'dd/MM/yy') : 'Até'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filterDateTo}
                          onSelect={setFilterDateTo}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {activeStages.map(stage => (
            <div
              key={stage.key}
              className="flex-shrink-0 w-72"
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, stage.key)}
            >
              {/* Column Header */}
              <div className={`rounded-t-lg px-3 py-2 ${stage.color} text-white`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                    {leadsByStage[stage.key]?.length || 0}
                  </Badge>
                </div>
              </div>

              {/* Column Body */}
              <div className="max-h-[70vh] overflow-y-auto">
                <div className="bg-muted/30 rounded-b-lg min-h-[300px] p-2 space-y-2 border border-t-0 border-border">
                  {(() => {
                    const stageLeads = leadsByStage[stage.key] || [];
                    const visible = stageLeads.slice(0, getVisibleCount(stage.key));
                    const remaining = stageLeads.length - visible.length;
                    return (
                      <>
                        {visible.map(lead => (
                          <Card
                            key={lead.id}
                            draggable
                            onDragStart={e => handleDragStart(e, lead.id)}
                            onClick={() => openLeadDetail(lead)}
                            className="p-3 cursor-pointer hover:shadow-md transition-shadow border border-border"
                          >
                            <p className="font-medium text-sm truncate">{lead.name}</p>
                            {lead.phone && (
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {lead.phone}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/admin/whatsapp?phone=${lead.phone.replace(/\D/g, '')}&name=${encodeURIComponent(lead.name)}`);
                                  }}
                                  className="text-green-500 hover:text-green-600"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                            {lead.product_name && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {lead.product_name}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              {lead.sale_value ? (
                                <span className="text-xs font-semibold text-green-600">
                                  R$ {Number(lead.sale_value).toFixed(2)}
                                </span>
                              ) : (
                                <span />
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(lead.created_at), {
                                  addSuffix: false,
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                          </Card>
                        ))}
                        {remaining > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-muted-foreground"
                            onClick={() => showMore(stage.key)}
                          >
                            Mostrar mais {Math.min(remaining, CARDS_PER_PAGE)} de {remaining}
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lead Detail Sheet */}
      <AdminCRMLeadDetail
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        stages={activeStages}
      />
    </div>
  );
};

export default AdminCRM;
