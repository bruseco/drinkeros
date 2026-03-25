import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

interface ParsedLead {
  phone: string;
  name: string;
  email: string;
}

interface ImportResult {
  imported: number;
  moved: number;
  duplicates: number;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 11) {
    return '55' + digits;
  }
  return digits;
}

function detectColumns(headers: string[]): { phoneIdx: number; nameIdx: number; emailIdx: number } {
  const lower = headers.map(h => (h || '').toString().toLowerCase().trim());
  const phoneKeywords = ['telefone', 'phone', 'número', 'numero', 'celular', 'whatsapp', 'fone'];
  const nameKeywords = ['nome', 'name', 'contato'];
  const emailKeywords = ['email', 'e-mail', 'correio'];

  let phoneIdx = lower.findIndex(h => phoneKeywords.some(k => h.includes(k)));
  const nameIdx = lower.findIndex(h => nameKeywords.some(k => h.includes(k)));
  const emailIdx = lower.findIndex(h => emailKeywords.some(k => h.includes(k)));

  if (phoneIdx === -1) phoneIdx = 0;

  return { phoneIdx, nameIdx, emailIdx };
}

async function queryInBatches<T>(
  phones: string[],
  table: 'crm_leads' | 'profiles',
  select: string,
): Promise<T[]> {
  const results: T[] = [];
  const withPlus = phones.map(p => '+' + p);
  const allVariants = [...phones, ...withPlus];

  for (let i = 0; i < allVariants.length; i += 500) {
    const batch = allVariants.slice(i, i + 500);
    const { data } = await supabase
      .from(table)
      .select(select)
      .in('phone', batch);
    if (data) results.push(...(data as T[]));
  }
  return results;
}

export const CRMExcelImporter: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedLead[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const queryClient = useQueryClient();

  const reset = () => {
    setParsed([]);
    setResult(null);
    setFileName('');
  };

  const handleFile = useCallback((file: File) => {
    setResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
          toast.error('Arquivo vazio ou sem dados');
          return;
        }

        const headers = rows[0];
        const { phoneIdx, nameIdx, emailIdx } = detectColumns(headers);

        const leads: ParsedLead[] = [];
        const seen = new Set<string>();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[phoneIdx]) continue;
          const phone = normalizePhone(String(row[phoneIdx]));
          if (!phone || phone.length < 10) continue;
          if (seen.has(phone)) continue;
          seen.add(phone);

          leads.push({
            phone,
            name: nameIdx >= 0 && row[nameIdx] ? String(row[nameIdx]).trim() : '',
            email: emailIdx >= 0 && row[emailIdx] ? String(row[emailIdx]).trim() : '',
          });
        }

        if (leads.length === 0) {
          toast.error('Nenhum telefone válido encontrado no arquivo');
          return;
        }

        setParsed(leads);
      } catch (err) {
        toast.error('Erro ao ler arquivo: ' + (err as Error).message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);

    try {
      const phones = parsed.map(l => l.phone);
      const phoneMap = new Map(parsed.map(l => [l.phone, l]));

      // 1. Query ALL existing crm_leads by phone (any funnel)
      const existingLeads = await queryInBatches<{
        id: string; phone: string; funnel: string; stage: string;
        name: string; email: string | null;
      }>(phones, 'crm_leads', 'id,phone,funnel,stage,name,email');

      const normalizeExisting = (p: string) => p?.replace(/^\+/, '') || '';
      const existingByPhone = new Map<string, typeof existingLeads[0]>();
      for (const lead of existingLeads) {
        existingByPhone.set(normalizeExisting(lead.phone), lead);
      }

      const alreadyInOferta: string[] = [];
      const toMove: string[] = []; // lead IDs to update
      const notFoundPhones: string[] = [];

      for (const phone of phones) {
        const existing = existingByPhone.get(phone);
        if (existing) {
          if (existing.funnel === 'pico_vendas' && existing.stage === 'oferta_enviada') {
            alreadyInOferta.push(phone);
          } else {
            toMove.push(existing.id);
          }
        } else {
          notFoundPhones.push(phone);
        }
      }

      // 2. Move existing leads to pico_vendas/oferta_enviada
      let movedCount = 0;
      const BATCH = 200;
      for (let i = 0; i < toMove.length; i += BATCH) {
        const batch = toMove.slice(i, i + BATCH);
        const { error } = await supabase
          .from('crm_leads')
          .update({ funnel: 'pico_vendas', stage: 'oferta_enviada' })
          .in('id', batch);
        if (error) throw error;
        movedCount += batch.length;
      }

      // 3. For not-found phones, query profiles to enrich
      let profilesByPhone = new Map<string, { full_name: string | null; email: string; phone: string; id: string }>();
      if (notFoundPhones.length > 0) {
        const profiles = await queryInBatches<{
          id: string; full_name: string | null; email: string; phone: string;
        }>(notFoundPhones, 'profiles', 'id,full_name,email,phone');

        for (const p of profiles) {
          profilesByPhone.set(normalizeExisting(p.phone), p);
        }
      }

      // 4. Create new leads (enriched with profile data or excel data)
      const newLeads = notFoundPhones.map(phone => {
        const excelData = phoneMap.get(phone)!;
        const profile = profilesByPhone.get(phone);

        return {
          name: profile?.full_name || excelData.name || `Lead ${phone.slice(-4)}`,
          email: profile?.email || excelData.email || null,
          phone,
          profile_id: profile?.id || null,
          stage: 'oferta_enviada',
          funnel: 'pico_vendas',
          source: 'whatsapp',
        };
      });

      let totalInserted = 0;
      for (let i = 0; i < newLeads.length; i += BATCH) {
        const batch = newLeads.slice(i, i + BATCH);
        const { error } = await supabase.from('crm_leads').insert(batch as any);
        if (error) throw error;
        totalInserted += batch.length;
      }

      setResult({
        imported: totalInserted,
        moved: movedCount,
        duplicates: alreadyInOferta.length,
      });
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });

      const parts: string[] = [];
      if (totalInserted > 0) parts.push(`${totalInserted} novos`);
      if (movedCount > 0) parts.push(`${movedCount} movidos`);
      toast.success(`${parts.join(' + ')} leads importados!`);
    } catch (err) {
      toast.error('Erro ao importar: ' + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" /> Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Leads do Excel
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <div className="space-y-1">
              {result.imported > 0 && (
                <p className="text-lg font-semibold">{result.imported} leads criados</p>
              )}
              {result.moved > 0 && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                  {result.moved} leads movidos para Oferta Enviada
                </p>
              )}
              {result.duplicates > 0 && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  {result.duplicates} duplicatas ignoradas
                </p>
              )}
              {result.imported === 0 && result.moved === 0 && (
                <p className="text-lg font-semibold">Nenhum lead novo para importar</p>
              )}
            </div>
            <Button onClick={() => { reset(); setOpen(false); }}>Fechar</Button>
          </div>
        ) : parsed.length === 0 ? (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById('excel-import-input')?.click()}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Arraste um arquivo Excel/CSV aqui</p>
            <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-3">
              Formatos: .xlsx, .xls, .csv · Detecta colunas de telefone, nome e email
            </p>
            <input
              id="excel-import-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{fileName}</span> · {parsed.length} telefones encontrados
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>Trocar arquivo</Button>
            </div>

            <div className="border rounded-md max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.slice(0, 20).map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{l.phone}</TableCell>
                      <TableCell>{l.name || <span className="text-muted-foreground italic">sem nome</span>}</TableCell>
                    </TableRow>
                  ))}
                  {parsed.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        ... e mais {parsed.length - 20} contatos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
              <p>• Leads já existentes em outros funis serão <strong className="text-foreground">movidos</strong> para Oferta Enviada</p>
              <p>• Telefones encontrados em perfis de alunos terão nome e email preenchidos automaticamente</p>
              <p>• Duplicatas já em Oferta Enviada serão ignoradas</p>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Importando...' : `Importar ${parsed.length} leads`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
