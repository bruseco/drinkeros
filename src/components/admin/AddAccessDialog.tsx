import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Loader2 } from 'lucide-react';
import { useCourses } from '@/hooks/useCourses';
import { useEbooks } from '@/hooks/useEbooks';
import { useCombos } from '@/hooks/useCombos';
import { usePackages } from '@/hooks/usePackages';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

type Kind = 'course' | 'ebook' | 'combo' | 'package';

const tableMap: Record<Kind, { table: string; col: string }> = {
  course: { table: 'user_courses', col: 'course_id' },
  ebook: { table: 'user_ebooks', col: 'ebook_id' },
  combo: { table: 'user_combos', col: 'combo_id' },
  package: { table: 'user_packages', col: 'package_id' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  excludeIds: { courses: string[]; ebooks: string[]; combos: string[]; packages: string[] };
}

export const AddAccessDialog: React.FC<Props> = ({ open, onOpenChange, userId, excludeIds }) => {
  const [kind, setKind] = useState<Kind>('course');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: courses = [] } = useCourses();
  const { data: ebooks = [] } = useEbooks();
  const { data: combos = [] } = useCombos();
  const { data: packages = [] } = usePackages();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const items = useMemo(() => {
    const map: Record<Kind, { id: string; name: string }[]> = {
      course: courses.filter((c: any) => !excludeIds.courses.includes(c.id)).map((c: any) => ({ id: c.id, name: c.name })),
      ebook: ebooks.filter((e: any) => !excludeIds.ebooks.includes(e.id)).map((e: any) => ({ id: e.id, name: e.name })),
      combo: combos.filter((c: any) => !excludeIds.combos.includes(c.id)).map((c: any) => ({ id: c.id, name: c.name })),
      package: packages.filter((p: any) => !excludeIds.packages.includes(p.id)).map((p: any) => ({ id: p.id, name: p.name })),
    };
    const list = map[kind];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((i) => i.name.toLowerCase().includes(q));
  }, [kind, search, courses, ebooks, combos, packages, excludeIds]);

  const grant = async (id: string) => {
    setSaving(true);
    const { table, col } = tableMap[kind];
    const { error } = await (supabase as any).from(table).insert({ user_id: userId, [col]: id });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao conceder acesso', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Acesso concedido' });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conceder acesso</DialogTitle>
          <DialogDescription>Selecione o conteúdo para liberar a este aluno. Expira em 1 ano por padrão (ou vitalício se o aluno tiver acesso vitalício).</DialogDescription>
        </DialogHeader>
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList className="w-full">
            <TabsTrigger value="course" className="flex-1">Cursos</TabsTrigger>
            <TabsTrigger value="ebook" className="flex-1">E-books</TabsTrigger>
            <TabsTrigger value="combo" className="flex-1">Combos</TabsTrigger>
            <TabsTrigger value="package" className="flex-1">Pacotes</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum item disponível</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
                <span className="text-sm font-medium">{item.name}</span>
                <Button size="sm" variant="outline" onClick={() => grant(item.id)} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" /> Conceder</>}
                </Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
