import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, FlaskConical, Library, Music, PartyPopper, RotateCcw,
  Ship, Shuffle, Sparkles, Sprout, Store, Target, Trophy, Truck, Wallet, Wand2, type LucideIcon,
} from 'lucide-react';
import { SeoHead } from '@/components/SeoHead';
import { trackFunnel, trackFunnelAsync } from '@/lib/funnelTracking';
import { trackFbEvent, waitForPixelFlush } from '@/lib/metaPixel';
import {
  QUESTIONS, PROFILES, computeProfile, getQuestionOrder, buildDestinationUrl,
  type Answers, type AnswerKey, type QuizIcon, type ProfileId,
} from '@/lib/quizLogic';
import imgHobbie from '@/assets/landing/classicos/profile-hobbie.jpg';
import imgBartender from '@/assets/landing/classicos/profile-bartender.jpg';
import imgEmpresario from '@/assets/landing/classicos/profile-empresario.jpg';
import logo from '@/assets/logotipo-drinkeros.png';

const PAGE_KEY = 'quiz';
const IMAGES = { hobbie: imgHobbie, bartender: imgBartender, empresario: imgEmpresario };
const ICONS: Record<QuizIcon, LucideIcon> = {
  party: PartyPopper, sparkles: Sparkles, flask: FlaskConical, wallet: Wallet,
  sprout: Sprout, book: BookOpen, shuffle: Shuffle, trophy: Trophy,
  wand: Wand2, library: Library, target: Target, store: Store,
  truck: Truck, music: Music, ship: Ship,
};

type Stage = { kind: 'intro' } | { kind: 'question'; index: number } | { kind: 'analyzing' } | { kind: 'result'; profile: ProfileId };

export default function Quiz() {
  const location = useLocation();
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const [answers, setAnswers] = useState<Answers>({});
  const [selected, setSelected] = useState<AnswerKey | null>(null);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [leaving, setLeaving] = useState(false);

  const order = useMemo(() => getQuestionOrder(answers), [answers]);

  useEffect(() => { trackFunnel(PAGE_KEY, 'pageview'); }, []);

  const go = (next: Stage, direction: 'fwd' | 'back' = 'fwd') => {
    setDir(direction);
    setLeaving(true);
    window.setTimeout(() => {
      setStage(next);
      setSelected(null);
      setLeaving(false);
      window.scrollTo({ top: 0 });
    }, 180);
  };

  const start = () => {
    trackFunnel(PAGE_KEY, 'quiz_started');
    go({ kind: 'question', index: 0 });
  };

  const answer = (index: number, key: AnswerKey) => {
    if (selected) return;
    setSelected(key);
    const qid = order[index];
    const nextAnswers: Answers = { ...answers, [qid]: key };
    // Remove respostas posteriores que não se aplicam mais (ex.: saiu do caminho de negócio)
    const nextOrder = getQuestionOrder(nextAnswers);
    (['q1', 'q2', 'q3', 'q4'] as const).forEach((q) => { if (!nextOrder.includes(q)) delete nextAnswers[q]; });
    setAnswers(nextAnswers);
    trackFunnel(PAGE_KEY, `quiz_${qid}_answered` , { metadata: { answer: key } });

    window.setTimeout(() => {
      if (index + 1 < nextOrder.length) {
        go({ kind: 'question', index: index + 1 });
      } else {
        const profile = computeProfile(nextAnswers);
        go({ kind: 'analyzing' });
        window.setTimeout(() => {
          go({ kind: 'result', profile });
          const p = PROFILES[profile];
          trackFunnel(PAGE_KEY, 'quiz_result', { metadata: { profile } });
          trackFbEvent('ViewContent', {
            content_name: p.title, content_category: 'quiz', content_type: 'quiz_result', content_ids: [profile],
          }, { dedupeKey: `quiz:result:${profile}` });
        }, 1300);
      }
    }, 260);
  };

  const back = () => {
    if (stage.kind !== 'question') return;
    if (stage.index === 0) go({ kind: 'intro' }, 'back');
    else go({ kind: 'question', index: stage.index - 1 }, 'back');
  };

  const restart = () => { setAnswers({}); go({ kind: 'intro' }, 'back'); };

  const clickCta = async (profile: ProfileId) => {
    const p = PROFILES[profile];
    trackFbEvent('Lead', { content_name: p.product, content_category: 'quiz', content_ids: [profile] }, { dedupeKey: `quiz:lead:${profile}` });
    await trackFunnelAsync(PAGE_KEY, 'quiz_cta_clicked', { metadata: { profile } });
    await waitForPixelFlush();
    window.location.href = buildDestinationUrl(p, location.search);
  };

  const progress =
    stage.kind === 'question' ? ((stage.index + (selected ? 1 : 0)) / order.length) * 100
      : stage.kind === 'intro' ? 0 : 100;

  const anim = leaving
    ? dir === 'fwd' ? 'quiz-leave-left' : 'quiz-leave-right'
    : dir === 'fwd' ? 'quiz-enter-right' : 'quiz-enter-left';

  return (
    <div className="quiz-root min-h-[100dvh] text-foreground">
      <SeoHead
        title="Descubra seu perfil de Drinkero | Quiz Drinkeros"
        description="Responda 4 perguntas rápidas e descubra o caminho certo pra você no mundo dos drinks."
        path="/quiz"
      />
      <header className="sticky top-0 z-10 quiz-header" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          {stage.kind === 'question' ? (
            <button onClick={back} aria-label="Voltar" className="rounded-full p-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : <span className="w-9" />}
          <img src={logo} alt="Drinkeros" className="mx-auto h-7 w-auto" />
          <span className="w-9 text-right text-xs text-muted-foreground">
            {stage.kind === 'question' ? `${stage.index + 1}/${order.length}` : ''}
          </span>
        </div>
        <div className="h-1 w-full bg-foreground/10" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className="quiz-progress h-full transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6">
        <div key={JSON.stringify(stage)} className={anim}>
          {stage.kind === 'intro' && (
            <section className="flex min-h-[70dvh] flex-col justify-center text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] quiz-accent-text">Quiz Drinkeros</p>
              <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
                Qual é o seu momento no mundo dos drinks?
              </h1>
              <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
                Responda até 4 perguntas rápidas e descubra o caminho certo pra você. Leva menos de 1 minuto.
              </p>
              <button onClick={start} className="quiz-cta mx-auto mt-8 flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-bold">
                Descobrir meu perfil <ArrowRight className="h-5 w-5" />
              </button>
            </section>
          )}

          {stage.kind === 'question' && (() => {
            const q = QUESTIONS[order[stage.index]];
            return (
              <section>
                <h2 className="mb-6 text-center font-display text-2xl font-bold leading-snug sm:text-3xl">{q.title}</h2>
                <div className="grid gap-3">
                  {q.options.map((o) => {
                    const Icon = ICONS[o.icon];
                    const isSel = selected === o.key;
                    return (
                      <button
                        key={o.key}
                        onClick={() => answer(stage.index, o.key)}
                        className={`quiz-card flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.98] ${isSel ? 'quiz-card-selected' : ''}`}
                      >
                        <span className="quiz-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="text-[15px] font-medium leading-snug">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {stage.kind === 'analyzing' && (
            <section className="flex min-h-[65dvh] flex-col items-center justify-center text-center" aria-live="polite">
              <div className="quiz-spinner h-16 w-16 rounded-full" />
              <p className="mt-6 text-lg font-semibold">Analisando seu perfil...</p>
              <p className="mt-1 text-sm text-muted-foreground">Cruzando suas respostas</p>
            </section>
          )}

          {stage.kind === 'result' && (() => {
            const p = PROFILES[stage.profile];
            return (
              <section className="text-center">
                <div className="quiz-photo relative mx-auto mb-6 aspect-square w-full max-w-xs overflow-hidden rounded-3xl">
                  <img src={IMAGES[p.image]} alt={p.title} className="h-full w-full object-cover" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] quiz-accent-text">Resultado</p>
                <h1 className="mt-2 font-display text-3xl font-bold">{p.title}</h1>
                <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{p.text}</p>
                <p className="mt-5 text-sm">Caminho recomendado: <strong>{p.product}</strong></p>
                <button onClick={() => clickCta(stage.profile)} className="quiz-cta mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-bold">
                  {p.cta} <ArrowRight className="h-5 w-5 shrink-0" />
                </button>
                <button onClick={restart} className="mx-auto mt-5 flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-4">
                  <RotateCcw className="h-4 w-4" /> Refazer quiz
                </button>
              </section>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
