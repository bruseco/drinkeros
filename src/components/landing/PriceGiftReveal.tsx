import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag } from 'lucide-react';
import giftBody from '@/assets/gift-box-body.png';
import giftLid from '@/assets/gift-box-lid.png';

interface Props {
  open: boolean;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  /** Quando true, pede nome + e-mail antes de abrir o presente. */
  requireLead?: boolean;
  defaultName?: string;
  defaultEmail?: string;
  /** Valor do desconto concedido (ex.: 300). Exibido com destaque após abrir. */
  discountAmount?: number;
  /** Recebe os dados do lead antes da revelação. Erros não bloqueiam o desconto. */
  onSubmitLead?: (data: { name: string; email: string }) => Promise<void> | void;
  /** Chamado quando a animação de abertura termina (ou o usuário fecha). */
  onReveal: () => void;
  onClose: () => void;
}

/**
 * Overlay de presente para revelar desconto em páginas de venda.
 * Intro: presente animado + botão "Pegar desconto".
 * Ao clicar: (opcional) captura nome/e-mail, a tampa voa e o overlay fecha,
 * disparando onReveal().
 */
export const PriceGiftReveal: React.FC<Props> = ({
  open,
  title = 'Tem um desconto aqui pra você!',
  subtitle = 'Abra o presente e veja o seu preço especial.',
  ctaLabel = 'PEGAR DESCONTO',
  requireLead = false,
  defaultName = '',
  defaultEmail = '',
  discountAmount,
  onSubmitLead,
  onReveal,
  onClose,
}) => {
  const [opening, setOpening] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const timers = React.useRef<number[]>([]);


  useEffect(() => {
    if (!open) {
      setOpening(false);
      setLeaving(false);
      setShowForm(false);
      setFormError(null);
      setSaving(false);
    }
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [open]);

  useEffect(() => {
    if (defaultName) setName((prev) => prev || defaultName);
  }, [defaultName]);
  useEffect(() => {
    if (defaultEmail) setEmail((prev) => prev || defaultEmail);
  }, [defaultEmail]);


  const sparkles = React.useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.16);
        const dist = 72 + (i % 3) * 28;
        return {
          key: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          delay: (i % 5) * 28,
          size: 9 + (i % 3) * 4,
        };
      }),
    [],
  );

  if (!open) return null;

  const runReveal = () => {
    if (opening) return;
    setOpening(true);
    timers.current.push(window.setTimeout(() => setLeaving(true), 750));
    timers.current.push(window.setTimeout(() => onReveal(), 1150));
  };

  const handleOpenGift = () => {
    if (opening || saving) return;
    if (requireLead && !showForm) {
      setShowForm(true);
      return;
    }
    runReveal();
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || opening) return;
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2) {
      setFormError('Digite seu nome.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setFormError('Digite um e-mail válido.');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await onSubmitLead?.({ name: cleanName, email: cleanEmail });
    } catch {
      // Nunca bloqueia o desconto por falha na captura.
    }
    setSaving(false);
    runReveal();
  };


  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5 overflow-hidden"
      style={{ opacity: leaving ? 0 : 1, transition: 'opacity 400ms ease' }}
      aria-live="polite"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, hsl(310 55% 24%) 0%, hsl(280 70% 11%) 45%, hsl(260 70% 4%) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 45%, hsl(var(--primary) / 0.3) 0%, transparent 55%)',
          animation: 'pgr-bg-pulse 3.6s ease-in-out infinite',
        }}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-5 right-5 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative z-[1] w-full max-w-[400px] text-center select-none">
        <div
          className="text-white text-lg sm:text-2xl font-extrabold tracking-wide px-2"
          style={{
            animation: 'pgr-fade-up 520ms ease 80ms both',
            textShadow: '0 2px 18px rgba(236,72,153,0.55)',
          }}
        >
          {title}
        </div>

        <div className="relative mx-auto mt-6 mb-4 h-[280px] sm:h-[320px] w-full">
          {[
            { w: 540, h: 10, dur: '7s', dir: 'normal', op: 0.55, delay: '0s', color: 'hsl(320 95% 65%)' },
            { w: 600, h: 8, dur: '11s', dir: 'reverse', op: 0.4, delay: '-2s', color: 'hsl(280 90% 70%)' },
            { w: 500, h: 14, dur: '9s', dir: 'normal', op: 0.35, delay: '-4s', color: 'hsl(80 95% 60%)' },
          ].map((b, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 pointer-events-none"
              style={{
                width: b.w,
                height: b.h,
                marginLeft: -b.w / 2,
                marginTop: -b.h / 2,
                background: `radial-gradient(ellipse at center, ${b.color} 0%, transparent 75%)`,
                opacity: b.op,
                filter: 'blur(2px)',
                animation: `pgr-beam-spin ${b.dur} linear ${b.delay} infinite`,
                animationDirection: b.dir as any,
                mixBlendMode: 'screen',
              }}
            />
          ))}

          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[260px] w-[260px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, hsl(var(--primary) / 0.45) 0%, hsl(280 70% 55% / 0.2) 48%, transparent 72%)',
              animation: 'pgr-glow-pulse 2.2s ease-in-out infinite',
            }}
          />

          {sparkles.map((s) => (
            <span
              key={`burst-${s.key}`}
              className="absolute left-1/2 top-1/2 block rounded-full pointer-events-none"
              style={{
                width: s.size,
                height: s.size,
                background: 'radial-gradient(circle, #fff 0%, hsl(45 95% 70%) 55%, transparent 100%)',
                boxShadow: '0 0 16px hsl(45 95% 70% / 0.95)',
                '--sparkle-x': `${s.x * 1.7}px`,
                '--sparkle-y': `${s.y * 1.7}px`,
                opacity: 0,
                animation: `pgr-sparkle 1100ms cubic-bezier(.16,1,.3,1) ${(opening ? 0 : 300) + s.delay}ms forwards`,
              } as React.CSSProperties}
            />
          ))}

          <img
            src={giftBody}
            alt=""
            width={512}
            height={512}
            decoding="async"
            className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 h-[200px] sm:h-[230px] w-auto"
            style={{ animation: 'pgr-gift-in 720ms cubic-bezier(.18,1.5,.3,1) 200ms both' }}
          />
          <img
            src={giftLid}
            alt=""
            width={512}
            height={512}
            decoding="async"
            className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 h-[165px] sm:h-[190px] w-auto"
            style={{
              animation: opening
                ? 'pgr-lid-off 700ms cubic-bezier(.4,0,.2,1) forwards'
                : 'pgr-gift-in 720ms cubic-bezier(.18,1.5,.3,1) 320ms both, pgr-lid-bob 2.4s ease-in-out 1100ms infinite',
            }}
          />
        </div>

        <div
          className="text-white/85 text-base sm:text-lg font-light tracking-wide px-3"
          style={{ animation: 'pgr-fade-up 520ms ease 480ms both' }}
        >
          {opening
            ? 'Você acaba de desbloquear o desconto do Rand!'
            : showForm
            ? 'Preencha seus dados para desbloquear o desconto:'
            : subtitle}
        </div>

        {opening && discountAmount && discountAmount > 0 ? (
          <div
            className="mt-7 rounded-2xl border border-lime-300/40 bg-gradient-to-br from-lime-400/20 to-emerald-600/20 px-6 py-5 text-center shadow-[0_0_40px_rgba(132,204,22,0.35)]"
            style={{ animation: 'pgr-fade-up 420ms ease 160ms both, pgr-savings-pulse 2s ease-in-out 500ms both' }}
          >
            <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-lime-200 mb-2">
              <Tag className="h-4 w-4" />
              Desconto liberado
            </div>
            <p className="text-3xl sm:text-4xl font-black text-white drop-shadow-[0_2px_12px_rgba(132,204,22,0.55)]">
              R$ {discountAmount.toLocaleString('pt-BR')},00
            </p>
            <p className="text-sm text-lime-100/80 mt-1">
              de desconto no Pacote RAND
            </p>
          </div>
        ) : showForm ? (
          <form
            onSubmit={handleSubmitLead}
            className="mt-5 space-y-3 text-left"
            style={{ animation: 'pgr-fade-up 380ms ease both' }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              autoFocus
              className="w-full rounded-xl bg-white/95 px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-lime-400"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu melhor e-mail"
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-xl bg-white/95 px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-lime-400"
            />
            {formError && (
              <p className="text-sm font-medium text-rose-300">{formError}</p>
            )}
            <button
              type="submit"
              disabled={saving || opening}
              className="w-full inline-flex items-center justify-center rounded-full px-9 py-3.5 text-white font-extrabold text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-70"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, #65a30d 0%, #84cc16 25%, #bef264 50%, #84cc16 75%, #65a30d 100%)',
                backgroundSize: '300% 100%',
                boxShadow: '0 10px 26px rgba(101,163,13,0.55), 0 0 40px rgba(132,204,22,0.4)',
                animation: 'pgr-btn-shimmer 2.6s linear infinite',
              }}
            >
              {saving ? 'LIBERANDO...' : 'DESBLOQUEAR DESCONTO'}
            </button>
            <p className="text-center text-xs text-white/60">
              Usamos seus dados apenas para enviar o seu desconto.
            </p>
          </form>
        ) : (
          <button
            type="button"
            onClick={handleOpenGift}
            disabled={opening}
            className="mt-7 inline-flex items-center justify-center rounded-full px-9 py-3.5 text-white font-extrabold text-lg hover:scale-[1.03] active:scale-[0.98] transition-transform disabled:opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #65a30d 0%, #84cc16 25%, #bef264 50%, #84cc16 75%, #65a30d 100%)',
              backgroundSize: '300% 100%',
              boxShadow: '0 10px 26px rgba(101,163,13,0.55), 0 0 40px rgba(132,204,22,0.4)',
              animation:
                'pgr-fade-up 520ms ease 640ms both, pgr-btn-shimmer 2.6s linear 1100ms infinite',
            }}
          >
            {ctaLabel}
          </button>
        )}

      </div>

      <style>{`
        @keyframes pgr-sparkle {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
          12% { opacity: 1; }
          60% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--sparkle-x)), calc(-50% + var(--sparkle-y))) scale(0.15); }
        }
        @keyframes pgr-fade-up {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pgr-gift-in {
          0% { opacity: 0; transform: translate(-50%, -10%) scale(0.4) rotate(-8deg); }
          70% { opacity: 1; }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
        }
        @keyframes pgr-lid-bob {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
        }
        @keyframes pgr-lid-off {
          0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) translateY(-240px) rotate(-22deg) scale(0.7); }
        }
        @keyframes pgr-glow-pulse {
          0%, 100% { opacity: 0.85; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes pgr-bg-pulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes pgr-beam-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pgr-btn-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
        }
      `}</style>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

export default PriceGiftReveal;
