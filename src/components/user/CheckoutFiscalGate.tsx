import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface FiscalData {
  cpf: string | null;
  cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
}

const isFiscalComplete = (d: FiscalData | null) =>
  !!d &&
  (d.cpf || "").replace(/\D/g, "").length === 11 &&
  (d.cep || "").replace(/\D/g, "").length === 8 &&
  !!d.address_street?.trim() &&
  !!d.address_number?.trim() &&
  !!d.address_neighborhood?.trim() &&
  !!d.address_city?.trim() &&
  !!d.address_state?.trim();

interface Props {
  userId: string;
  /** Chamado assim que os dados fiscais estiverem completos (na entrada ou após salvar). */
  onReady: () => void;
}

/**
 * Bloqueia o checkout até que o usuário tenha CPF + endereço completo salvos no perfil.
 * Obrigatório para emissão de NFSe (NIBO). Sem esses dados a prefeitura rejeita a nota.
 */
export default function CheckoutFiscalGate({ userId, onReady }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cpf, setCpf] = useState("");
  const [cpfLocked, setCpfLocked] = useState(false);
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [neighborhoodAutoFailed, setNeighborhoodAutoFailed] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [needsForm, setNeedsForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("cpf, cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const d = (data as FiscalData) || null;
      if (isFiscalComplete(d)) {
        onReady();
        setLoading(false);
        return;
      }
      // Preenche o form com o que já existe
      if (d?.cpf) {
        setCpf(d.cpf.length === 11 ? d.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d.cpf);
        setCpfLocked(true);
      }
      if (d?.cep) setCep(d.cep.length === 8 ? `${d.cep.slice(0, 5)}-${d.cep.slice(5)}` : d.cep);
      setStreet(d?.address_street || "");
      setNumber(d?.address_number || "");
      setComplement(d?.address_complement || "");
      setNeighborhood(d?.address_neighborhood || "");
      setCity(d?.address_city || "");
      setState(d?.address_state || "");
      setNeedsForm(true);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, onReady]);

  const formatCpf = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };
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
        // ViaCEP às vezes devolve bairro vazio (CEP único / geral de município).
        // Nesse caso sinalizamos para o usuário preencher manualmente.
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

  const validateCpf = (raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
    let r = (sum * 10) % 11;
    if (r === 10) r = 0;
    if (r !== parseInt(d[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
    r = (sum * 10) % 11;
    if (r === 10) r = 0;
    return r === parseInt(d[10]);
  };

  const handleSave = async () => {
    const cpfDigits = cpf.replace(/\D/g, "");
    const cepDigits = cep.replace(/\D/g, "");

    if (!cpfLocked && !validateCpf(cpfDigits)) {
      toast.error("CPF inválido");
      return;
    }
    if (cepDigits.length !== 8) {
      toast.error("CEP inválido");
      return;
    }
    if (!street.trim() || !number.trim() || !city.trim() || !state.trim()) {
      toast.error("Preencha o endereço completo");
      return;
    }
    if (!neighborhood.trim()) {
      toast.error("Preencha o bairro", {
        description: "O bairro é obrigatório para a emissão da nota fiscal.",
      });
      setNeighborhoodAutoFailed(true);
      return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        cep: cepDigits,
        address_street: street.trim(),
        address_number: number.trim(),
        address_complement: complement.trim() || null,
        address_neighborhood: neighborhood.trim() || null,
        address_city: city.trim(),
        address_state: state.trim().toUpperCase().slice(0, 2),
      };
      if (!cpfLocked) updateData.cpf = cpfDigits;

      const { error } = await supabase.from("profiles").update(updateData).eq("user_id", userId);
      if (error) throw error;
      toast.success("Dados fiscais salvos!");
      onReady();
      setNeedsForm(false);
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-white/60" />
      </div>
    );
  }

  if (!needsForm) return null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-full bg-primary/15 p-2">
          <FileText className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Dados para nota fiscal</h3>
          <p className="text-xs text-white/60 mt-0.5">
            Precisamos do seu CPF e endereço para emitir a nota fiscal da sua compra. Cadastro único — usado em todas as próximas compras.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <Label htmlFor="cpf" className="text-xs">CPF</Label>
          <Input
            id="cpf"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            disabled={cpfLocked}
            className="bg-white/5 border-white/10 text-white mt-1"
          />
        </div>

        <div className="grid grid-cols-[140px_1fr] gap-3">
          <div>
            <Label htmlFor="cep" className="text-xs">CEP</Label>
            <Input
              id="cep"
              value={cep}
              onChange={(e) => {
                const v = formatCep(e.target.value);
                setCep(v);
                if (v.replace(/\D/g, "").length === 8) lookupCep(v);
              }}
              placeholder="00000-000"
              inputMode="numeric"
              className="bg-white/5 border-white/10 text-white mt-1"
            />
            {cepLoading && <p className="text-[10px] text-white/50 mt-1">Buscando...</p>}
          </div>
          <div>
            <Label htmlFor="street" className="text-xs">Rua / Logradouro</Label>
            <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-[120px_1fr] gap-3">
          <div>
            <Label htmlFor="number" className="text-xs">Número</Label>
            <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label htmlFor="complement" className="text-xs">Complemento (opcional)</Label>
            <Input id="complement" value={complement} onChange={(e) => setComplement(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="neighborhood" className="text-xs">Bairro</Label>
          <Input
            id="neighborhood"
            value={neighborhood}
            onChange={(e) => {
              setNeighborhood(e.target.value);
              if (e.target.value.trim()) setNeighborhoodAutoFailed(false);
            }}
            aria-invalid={neighborhoodMissing}
            className={`bg-white/5 text-white mt-1 ${
              neighborhoodMissing
                ? "border-destructive ring-1 ring-destructive focus-visible:ring-destructive"
                : "border-white/10"
            }`}
          />
          {neighborhoodMissing && (
            <p className="text-[11px] text-destructive mt-1">
              Bairro não encontrado automaticamente, preencha manualmente
            </p>
          )}
        </div>

        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div>
            <Label htmlFor="city" className="text-xs">Cidade</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1" />
          </div>
          <div>
            <Label htmlFor="state" className="text-xs">UF</Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="bg-white/5 border-white/10 text-white mt-1 uppercase" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar e continuar"}
        </Button>
      </div>
    </div>
  );
}
