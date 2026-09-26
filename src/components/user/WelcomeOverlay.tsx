import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Briefcase, PartyPopper, ArrowRight } from 'lucide-react';
import { useUpdateInterests, type Interest } from '@/hooks/useInterests';
import { useUserPlan } from '@/hooks/useUserPlan';

const FLAG_KEY = 'drinkeros:just_signed_up';

type Step = 'welcome' | 'interests';

const PLAN_LABELS: Record<string, { text: string; className: string }> = {
  free: { text: 'grátis', className: 'text-green-400' },
  aluno: { text: 'Aluno', className: 'text-sky-400' },
  socio: { text: 'Sócio do Clube', className: 'text-yellow-400' },
  vitalicio: { text: 'Sócio Vitalício', className: 'text-amber-400' },
};

export const WelcomeOverlay: React.FC = () => {
  const { user } = useAuth();
  const { data: plan } = useUserPlan();
  const updateInterests = useUpdateInterests();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [step, setStep] = useState<Step>('welcome');
  const [selected, setSelected] = useState<Interest[]>([]);
  const [saving, setSaving] = useState(false);

  const planLabel = PLAN_LABELS[plan?.plan ?? 'free'] ?? PLAN_LABELS.free;


  useEffect(() => {
    if (!user) return;
    const shouldShow = sessionStorage.getItem(FLAG_KEY) === '1';
    if (!shouldShow) return;
    sessionStorage.removeItem(FLAG_KEY);

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const name = (data?.full_name || '').split(' ')[0] || '';
      setFirstName(name);
      setVisible(true);
    })();
  }, [user]);

  const close = () => {
    setClosing(true);
    window.setTimeout(() => {
      setVisible(false);
      window.dispatchEvent(new Event('welcome-overlay-closed'));
    }, 450);
  };

  const handleNext = () => {
    setStep('interests');
  };

  const toggle = (i: Interest) => {
    setSelected((prev) => (prev.includes(i) ? prev.filter((v) => v !== i) : [...prev, i]));
  };

  const pickBoth = () => setSelected(['profissional', 'curticao']);

  const handleSave = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      await updateInterests.mutateAsync(selected);
    } catch {
      // ignora — não vamos travar o usuário se falhar
    } finally {
      setSaving(false);
      close();
    }
  };

  if (!visible) return null;

  const interestCard = (
    key: Interest,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    desc: string,
  ) => {
    const active = selected.includes(key);
    return (
      <button
        type="button"
        onClick={() => toggle(key)}
        className={[
          'w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all border',
          active
            ? 'bg-accent/20 border-accent text-white shadow-lg shadow-accent/20 scale-[1.01]'
            : 'bg-white/5 border-white/15 text-white/90 hover:bg-white/10',
        ].join(' ')}
      >
        <span
          className={[
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            active ? 'bg-accent text-accent-foreground' : 'bg-white/10 text-white',
          ].join(' ')}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold leading-tight">{label}</span>
          <span className="block text-xs text-white/70 mt-0.5">{desc}</span>
        </span>
        <span
          className={[
            'h-5 w-5 rounded-md border-2 grid place-items-center transition-colors',
            active ? 'bg-accent border-accent' : 'border-white/40',
          ].join(' ')}
          aria-hidden
        >
          {active && (
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-accent-foreground">
              <path fill="currentColor" d="M7.5 13.5 4 10l1.4-1.4 2.1 2.1L14.6 3.6 16 5z" />
            </svg>
          )}
        </span>
      </button>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ pointerEvents: 'auto' }}
      className={`fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6 transition-opacity duration-500 ${
        closing ? 'opacity-0' : 'opacity-100 animate-fade-in'
      }`}
    >
      {step === 'welcome' && (
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-accent/30 to-primary/20 p-4 mb-5 shadow-lg shadow-accent/20">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight">
            {firstName ? `Bem-vindo, ${firstName}!` : 'Bem-vindo aos Drinkeros!'}
          </h2>
          <p className="mt-3 text-white/80 text-base leading-snug">
            Sua jornada no mundo dos drinks começa agora! Você está no plano{' '}
            <span className={`font-semibold ${planLabel.className}`}>{planLabel.text}</span>. 🍹
          </p>
          <button
            type="button"
            onClick={handleNext}
            onPointerUp={handleNext}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-accent text-accent-foreground px-7 py-3 text-base font-semibold shadow-lg shadow-accent/30 hover:scale-[1.03] active:scale-[0.98] transition-transform touch-manipulation select-none"
          >
            Próximo <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}


      {step === 'interests' && (
        <div className="w-full max-w-sm animate-fade-in">
          <div className="text-center mb-5">
            <h2 className="text-2xl font-bold text-white leading-tight">
              Um ajuste rápido pra você
            </h2>
            <p className="mt-2 text-white/75 text-sm leading-snug">
              Seu interesse com drinks é mais profissional, curtição, ou os dois?
            </p>
          </div>

          <div className="space-y-2.5">
            {interestCard(
              'profissional',
              'Profissional',
              Briefcase,
              'Sou ou quero ser bartender, trabalho com bar/eventos.',
            )}
            {interestCard(
              'curticao',
              'Curtição',
              PartyPopper,
              'É hobby, faço drinks pra mim e pra galera.',
            )}
            <button
              type="button"
              onClick={pickBoth}
              className="w-full text-xs text-white/70 underline underline-offset-2 hover:text-white transition py-1"
            >
              É os dois juntos
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={selected.length === 0 || saving}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-accent text-accent-foreground px-7 py-3 text-base font-semibold shadow-lg shadow-accent/30 hover:scale-[1.01] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {saving ? 'Salvando...' : 'Continuar'}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </button>
          <p className="mt-3 text-center text-[11px] text-white/50">
            Você pode mudar isso a qualquer momento no seu perfil.
          </p>
        </div>
      )}
    </div>
  );
};

export default WelcomeOverlay;
