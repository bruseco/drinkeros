import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  /** Usuário logado (salva direto no perfil). Null = convidado (salva via edge function). */
  userId: string | null;
  /** E-mail do comprador — usado para localizar o perfil em compras de convidado. */
  buyerEmail?: string | null;
  /** ID do pagamento (Mercado Pago) — valida a origem no caso convidado. */
  paymentId?: string | null;
  /** Nome vindo do formulário do Mercado Pago (pré-preenche o campo). */
  initialName?: string;
  /** CPF vindo do formulário do Mercado Pago (pré-preenche e trava o campo). */
  initialCpf?: string;
  /** Chamado ao concluir ou ao pular. */
  onDone: () => void;
}

/**
 * Etapa 3 do checkout: coleta o endereço fiscal DEPOIS do pagamento.
 * Não bloqueia o acesso ao produto — o usuário pode pular e completar depois.
 */
export default function FiscalAddressDialog({ open, userId, buyerEmail, paymentId, initialName, initialCpf, onDone }: Props) {
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfLocked, setCpfLocked] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [neighborhoodAutoFailed, setNeighborhoodAutoFailed] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const formatCpf = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  };

  // Pré-preenche com o que veio do Mercado Pago e/ou com o perfil do usuário.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (initialName) setFullName((v) => v || initialName);
      if (initialCpf && initialCpf.replace(/\D/g, "").length === 11) {
        setCpf(formatCpf(initialCpf));
        setCpfLocked(true);
      }
      if (!userId) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, cpf, cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const d = data as any;
      if (d.full_name) setFullName((v) => v || d.full_name);
      if (d.cpf) { setCpf(formatCpf(d.cpf)); setCpfLocked(true); }
      if (d.cep) setCep(formatCep(d.cep));
      if (d.address_street) setStreet(d.address_street);
      if (d.address_number) setNumber(d.address_number);
      if (d.address_complement) setComplement(d.address_complement);
      if (d.address_neighborhood) setNeighborhood(d.address_neighborhood);
      if (d.address_city) setCity(d.address_city);
      if (d.address_state) setState(d.address_state);
    })();
    return () => { cancelled = true; };
  }, [open, userId, initialName, initialCpf]);

  const formatCep = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = await res.json();
      if (json && !json.erro) {
        if (json.logradouro) setStreet(json.logradouro);
        if (json.localidade) setCity(json.localidade);
        if (json.uf) setState(json.uf);
        if (json.bairro) {
          setNeighborhood(json.bairro);
          setNeighborhoodAutoFailed(false);
        } else {
          setNeighborhoodAutoFailed(true);
        }
      } else {
        toast.error("CEP não encontrado");
      }
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  const handleSave = async () => {
    const cpfDigits = cpf.replace(/\D/g, "");
    if (fullName.trim().replace(/\s+/g, " ").length < 3) return toast.error("Informe seu nome completo");
    if (cpfDigits.length !== 11) return toast.error("CPF inválido");
    const cepDigits = cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return toast.error("CEP inválido");
    if (!street.trim() || !number.trim() || !city.trim() || !state.trim()) {
      return toast.error("Preencha o endereço completo");
    }
    if (!neighborhood.trim()) {
      setNeighborhoodAutoFailed(true);
      return toast.error("Preencha o bairro", {
        description: "O bairro é obrigatório para a emissão da nota fiscal.",
      });
    }

    const address = {
      cep: cepDigits,
      address_street: street.trim(),
      address_number: number.trim(),
      address_complement: complement.trim() || null,
      address_neighborhood: neighborhood.trim(),
      address_city: city.trim(),
      address_state: state.trim().toUpperCase().slice(0, 2),
    };

    setSaving(true);
    try {
      if (userId) {
        const { error } = await supabase
          .from("profiles")
          .update({ ...address, full_name: fullName.trim().replace(/\s+/g, " "), cpf: cpfDigits })
          .eq("user_id", userId);
        if (error && (error as any).code !== "23505") throw error;
        if (error) {
          // CPF já cadastrado em outro perfil: salva o restante sem o CPF.
          const { error: err2 } = await supabase
            .from("profiles")
            .update({ ...address, full_name: fullName.trim().replace(/\s+/g, " ") })
            .eq("user_id", userId);
          if (err2) throw err2;
        }
      } else {
        const { data, error } = await supabase.functions.invoke("save-fiscal-address", {
          body: {
            email: buyerEmail,
            payment_id: paymentId,
            address: { ...address, full_name: fullName.trim().replace(/\s+/g, " "), cpf: cpfDigits },
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
      toast.success("Dados fiscais completos! Sua nota será emitida.");
      onDone();
    } catch (err: any) {
      toast.error("Erro ao salvar endereço", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const neighborhoodMissing = neighborhoodAutoFailed && !neighborhood.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDone(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Precisamos emitir sua nota fiscal</DialogTitle>
          <DialogDescription>
            Por favor preencha esses dados obrigatórios para você ter a garantia do seu produto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label htmlFor="fa-name" className="text-xs">Nome completo</Label>
            <Input id="fa-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" className="mt-1" />
          </div>

          <div>
            <Label htmlFor="fa-cpf" className="text-xs">CPF</Label>
            <Input
              id="fa-cpf"
              value={cpf}
              onChange={(e) => { if (!cpfLocked) setCpf(formatCpf(e.target.value)); }}
              placeholder="000.000.000-00"
              inputMode="numeric"
              disabled={cpfLocked}
              className={`mt-1 ${cpfLocked ? "opacity-60" : ""}`}
            />
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <Label htmlFor="fa-cep" className="text-xs">CEP</Label>
              <Input
                id="fa-cep"
                value={cep}
                onChange={(e) => {
                  const v = formatCep(e.target.value);
                  setCep(v);
                  if (v.replace(/\D/g, "").length === 8) lookupCep(v);
                }}
                placeholder="00000-000"
                inputMode="numeric"
                className="mt-1"
              />
              {cepLoading && <p className="text-[10px] text-muted-foreground mt-1">Buscando...</p>}
            </div>
            <div>
              <Label htmlFor="fa-street" className="text-xs">Rua / Logradouro</Label>
              <Input id="fa-street" value={street} onChange={(e) => setStreet(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <Label htmlFor="fa-number" className="text-xs">Número</Label>
              <Input id="fa-number" value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="fa-comp" className="text-xs">Complemento (opcional)</Label>
              <Input id="fa-comp" value={complement} onChange={(e) => setComplement(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label htmlFor="fa-neigh" className="text-xs">Bairro</Label>
            <Input
              id="fa-neigh"
              value={neighborhood}
              onChange={(e) => {
                setNeighborhood(e.target.value);
                if (e.target.value.trim()) setNeighborhoodAutoFailed(false);
              }}
              aria-invalid={neighborhoodMissing}
              className={`mt-1 ${neighborhoodMissing ? "border-destructive ring-1 ring-destructive" : ""}`}
            />
            {neighborhoodMissing && (
              <p className="text-[11px] text-destructive mt-1">
                Bairro não encontrado automaticamente, preencha manualmente
              </p>
            )}
          </div>

          <div className="grid grid-cols-[1fr_90px] gap-3">
            <div>
              <Label htmlFor="fa-city" className="text-xs">Cidade</Label>
              <Input id="fa-city" value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="fa-state" className="text-xs">UF</Label>
              <Input
                id="fa-state"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                className="mt-1 uppercase"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full mt-1">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar e acessar"}
          </Button>
          <button
            type="button"
            onClick={onDone}
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            Preencher depois
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
