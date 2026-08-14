import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import FiscalAddressDialog from "./FiscalAddressDialog";

/**
 * Aviso amarelo fixo no topo do app para quem já comprou mas está com
 * os dados fiscais incompletos (CPF ou endereço). Some quando completo.
 */
export default function FiscalPendingBanner() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  const check = useCallback(async () => {
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("cpf, cep, address_street, address_number, address_neighborhood, address_city, address_state")
      .eq("user_id", user.id)
      .maybeSingle();
    const p = prof as any;
    const complete =
      !!p &&
      String(p.cpf || "").replace(/\D/g, "").length === 11 &&
      String(p.cep || "").replace(/\D/g, "").length === 8 &&
      !!String(p.address_street || "").trim() &&
      !!String(p.address_number || "").trim() &&
      !!String(p.address_neighborhood || "").trim() &&
      !!String(p.address_city || "").trim() &&
      !!String(p.address_state || "").trim();
    if (complete) {
      setPending(false);
      return;
    }
    // Só cobra de quem realmente comprou algo.
    const { count } = await supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setPending((count ?? 0) > 0);
  }, [user]);

  useEffect(() => {
    check();
  }, [check]);

  if (!user || !pending) return null;

  return (
    <>
      <div className="bg-yellow-400 text-black px-4 py-2 flex items-center gap-3 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="flex-1 leading-snug">
          Seus dados fiscais estão incompletos. Precisamos deles para emitir sua nota fiscal.
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md bg-black text-white text-xs font-medium px-3 py-1.5 hover:bg-black/85"
        >
          Completar dados fiscais
        </button>
      </div>

      <FiscalAddressDialog
        open={open}
        userId={user.id}
        buyerEmail={user.email ?? null}
        onDone={() => {
          setOpen(false);
          check();
        }}
      />
    </>
  );
}
