import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PROFILES, QUESTIONS } from "@/lib/quizLogic";
import {
  type FunnelDates,
  funnelPeriodBounds,
  type FunnelRange,
} from "@/lib/funnelPeriod";
const steps = [
  ["quiz_result", "Viu o resultado"],
  ["quiz_offer_viewed", "Viu a oferta"],
  ["quiz_checkout_clicked", "Clicou para comprar"],
  ["quiz_checkout_viewed", "Chegou ao checkout"],
  ["quiz_lead_captured", "Enviou WhatsApp"],
  ["quiz_purchase", "Compra aprovada"],
];
export default function QuizOfferMetrics(
  { range, dates }: { range: FunnelRange; dates: FunnelDates },
) {
  const [path, setPath] = useState(""),
    [product, setProduct] = useState(""),
    [purchased, setPurchased] = useState(""),
    [tab, setTab] = useState("metrics"),
    [offset, setOffset] = useState(0);
  const b = funnelPeriodBounds(range, dates),
    params = { _since: b?.since, _until: b?.until };
  const metrics = useQuery({
    queryKey: ["quiz-offer-metrics", params],
    enabled: !!b,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "quiz_admin_metrics" as never,
        params as never,
      );
      if (error) throw error;
      return data as Array<
        { path: string; product: string; event: string; count: number }
      >;
    },
  });
  const answers = useQuery({
    queryKey: ["quiz-new-answers", params, path],
    enabled: !!b && tab === "metrics",
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "quiz_admin_answers" as never,
        { ...params, _path: path || null } as never,
      );
      if (error) throw error;
      return data as Array<
        { question: string; answer: string; path: string; count: number }
      >;
    },
  });
  const leads = useQuery({
    queryKey: ["quiz-offer-leads", params, path, product, purchased, offset],
    enabled: !!b && tab === "leads",
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "quiz_admin_leads" as never,
        {
          ...params,
          _path: path || null,
          _product: product || null,
          _purchased: purchased === "" ? null : purchased === "yes",
          _offset: offset,
        } as never,
      );
      if (error) throw error;
      return data as any[];
    },
  });
  return (
    <section className="space-y-4 border rounded-xl p-5">
      <h2 className="text-xl font-bold">Quiz · ofertas exclusivas</h2>
      <div className="flex gap-3">
        <button className="underline" onClick={() => setTab("metrics")}>
          Funis por caminho e produto
        </button>
        <button className="underline" onClick={() => setTab("leads")}>
          Leads do quiz
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        <label>
          Caminho{" "}
          <select
            className="bg-background border rounded p-2"
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todos</option>
            {["casa", "profissional", "empreender"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Produto{" "}
          <select
            className="bg-background border rounded p-2"
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todos</option>
            {Object.values(PROFILES).map((p) => (
              <option key={p.id} value={p.id}>{p.product}</option>
            ))}
          </select>
        </label>
        {tab === "leads" && (
          <label>
            Compra{" "}
            <select
              className="bg-background border rounded p-2"
              value={purchased}
              onChange={(e) => {
                setPurchased(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Todos</option>
              <option value="yes">Comprou</option>
              <option value="no">Não comprou</option>
            </select>
          </label>
        )}
      </div>
      {tab === "metrics"
        ? (metrics.isError
          ? <p role="alert">Não foi possível carregar o novo funil.</p>
          : metrics.isLoading
          ? <p>Carregando…</p>
          : (
            <div className="grid md:grid-cols-2 gap-4">
              {Object.values(PROFILES).filter((p) =>
                !product || p.id === product
              ).map((p) => (
                <article key={p.id} className="border rounded p-4">
                  <h3 className="font-bold mb-3">{p.product}</h3>
                  {steps.map(([event, label]) => {
                    const count = (metrics.data || []).filter((r) =>
                      r.product === p.id && r.event === event &&
                      (!path || r.path === path)
                    ).reduce((s, r) => s + Number(r.count), 0);
                    return (
                      <div
                        key={event}
                        className="flex justify-between text-sm py-1"
                      >
                        <span>{label}</span>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </article>
              ))}
            </div>
          ))
        : leads.isError
        ? <p role="alert">Não foi possível carregar os leads.</p>
        : leads.isLoading
        ? <p>Carregando…</p>
        : (
          <>
            <p className="text-sm text-muted-foreground">
              Período aplicado pela data de captura. Compra confirmada por
              vínculo com o pedido; cliques não contam como compra.
            </p>
            {leads.data?.length === 0 && <p>Nenhum lead neste período.</p>}
            {leads.data?.map((l) => (
              <article key={l.id} className="border rounded p-4 space-y-2">
                <div className="font-bold">{l.name} · {l.phone}</div>
                <p>
                  {l.path} ·{" "}
                  {PROFILES[l.product as keyof typeof PROFILES]?.product} ·{" "}
                  {l.purchased ? "Comprou" : "Não comprou"}
                </p>
                <p className="text-sm">
                  Valor exibido: R$ {l.displayed_price} · Captura:{" "}
                  {new Date(l.created_at).toLocaleString("pt-BR")}{" "}
                  · Consentimento:{" "}
                  {new Date(l.consent_at).toLocaleString("pt-BR")}
                </p>
                <details>
                  <summary>Respostas e origem</summary>
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify({respostas:l.answers,origem:l.attribution},null,2)}</pre>
                </details>
              </article>
            ))}
            <div className="flex gap-4">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 100))}
              >
                Anterior
              </button>
              <button
                disabled={(leads.data?.length || 0) < 100}
                onClick={() => setOffset(offset + 100)}
              >
                Próximos
              </button>
            </div>
          </>
        )}
      {tab === "metrics" && (
        <section className="space-y-4">
          <h3 className="font-bold">Respostas do novo quiz por pergunta</h3>
          {answers.isError
            ? <p role="alert">Não foi possível carregar as respostas.</p>
            : Object.values(QUESTIONS).map((q) => {
              const rows = (answers.data || []).filter((r) =>
                  r.question === q.id
                ),
                total = rows.reduce((s, r) => s + Number(r.count), 0);
              return (
                <article key={q.id} className="border rounded p-4">
                  <h4 className="font-bold">{q.title}</h4>
                  {q.options.map((o) => {
                    const count = rows.filter((r) => r.answer === o.key).reduce(
                      (s, r) => s + Number(r.count),
                      0,
                    );
                    return (
                      <p key={o.key} className="text-sm mt-2">
                        {o.label}: <strong>{count}</strong> ·{" "}
                        {total ? Math.round(count / total * 100) : 0}%
                      </p>
                    );
                  })}
                </article>
              );
            })}
        </section>
      )}
    </section>
  );
}
