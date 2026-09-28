export type AnswerKey = 'A' | 'B' | 'C' | 'D';
export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4';
export type Answers = Partial<Record<QuestionId, AnswerKey>>;

export type ProfileId =
  | 'criador'
  | 'aspirante'
  | 'profissional'
  | 'empreendedor_delivery'
  | 'empreendedor_eventos'
  | 'aventureiro';

export type QuizIcon =
  | 'party' | 'sparkles' | 'flask' | 'wallet'
  | 'sprout' | 'book' | 'shuffle' | 'trophy'
  | 'wand' | 'library' | 'target' | 'store'
  | 'truck' | 'music' | 'ship';

export interface QuizOption { key: AnswerKey; label: string; icon: QuizIcon }
export interface QuizQuestion { id: QuestionId; title: string; options: QuizOption[] }

export const QUESTIONS: Record<QuestionId, QuizQuestion> = {
  q1: {
    id: 'q1',
    title: 'O que te trouxe até aqui?',
    options: [
      { key: 'A', icon: 'party', label: 'Quero ser aquela pessoa que faz o drink que todo mundo comenta na festa' },
      { key: 'B', icon: 'sparkles', label: 'Sinto que tenho talento pra isso e quero levar a sério' },
      { key: 'C', icon: 'flask', label: 'Já faço uns drinks e quero parar de depender de receita' },
      { key: 'D', icon: 'wallet', label: 'Quero transformar isso numa fonte de renda de verdade' },
    ],
  },
  q2: {
    id: 'q2',
    title: 'Onde você está nessa jornada?',
    options: [
      { key: 'A', icon: 'sprout', label: 'Tô começando do zero, mas com muita vontade' },
      { key: 'B', icon: 'book', label: 'Faço uns clássicos, mas sempre preso na receita' },
      { key: 'C', icon: 'shuffle', label: 'Já improviso, quero deixar redondo' },
      { key: 'D', icon: 'trophy', label: 'Já vivo disso e quero subir de nível' },
    ],
  },
  q3: {
    id: 'q3',
    title: 'Qual seria o sonho pra você?',
    options: [
      { key: 'A', icon: 'wand', label: 'Chegar em qualquer lugar e fazer um drink do nada com o que tiver' },
      { key: 'B', icon: 'library', label: 'Ter um repertório enorme de receitas na mão' },
      { key: 'C', icon: 'target', label: 'Dominar a técnica como um bartender profissional' },
      { key: 'D', icon: 'store', label: 'Ter meu próprio negócio de drinks' },
    ],
  },
  q4: {
    id: 'q4',
    title: 'Como você se imagina ganhando dinheiro com drinks?',
    options: [
      { key: 'A', icon: 'truck', label: 'Montando um serviço de delivery de drinks' },
      { key: 'B', icon: 'music', label: 'Fazendo bar em festas e eventos' },
      { key: 'C', icon: 'ship', label: 'Viajando e trabalhando em cruzeiros pelo mundo' },
    ],
  },
};

/** P4 aparece quando há intenção de empreender (P1 = D ou P3 = D). */
export function needsBusinessQuestion(a: Answers): boolean {
  return a.q1 === 'D' || a.q3 === 'D';
}

/** Sequência de perguntas conforme as respostas até agora. */
export function getQuestionOrder(a: Answers): QuestionId[] {
  return needsBusinessQuestion(a) ? ['q1', 'q2', 'q3', 'q4'] : ['q1', 'q2', 'q3'];
}

type Scorable = 'criador' | 'aspirante' | 'profissional';

function q1Profile(a: Answers): Scorable {
  switch (a.q1) {
    case 'A': return 'criador';
    case 'B': return 'aspirante';
    case 'C': return a.q2 === 'C' || a.q2 === 'D' ? 'profissional' : 'criador';
    default: return 'criador';
  }
}

/** Regra de resultado. A intenção (P1) pesa mais e desempata. */
export function computeProfile(a: Answers): ProfileId {
  if (a.q4 === 'A') return 'empreendedor_delivery';
  if (a.q4 === 'B') return 'empreendedor_eventos';
  if (a.q4 === 'C') return 'aventureiro';

  const score: Record<Scorable, number> = { criador: 0, aspirante: 0, profissional: 0 };
  const intent = q1Profile(a);
  if (a.q1 && a.q1 !== 'D') score[intent] += 3;

  if (a.q2 === 'A') score.aspirante += 2;
  else if (a.q2 === 'B') score.criador += 2;
  else if (a.q2 === 'C' || a.q2 === 'D') score.profissional += 2;

  if (a.q3 === 'A') score.criador += 1;
  else if (a.q3 === 'B') score.aspirante += 1;
  else if (a.q3 === 'C') score.profissional += 1;

  const max = Math.max(score.criador, score.aspirante, score.profissional);
  if (score[intent] === max) return intent;
  return (['criador', 'aspirante', 'profissional'] as Scorable[]).find((p) => score[p] === max)!;
}

export interface QuizProfile {
  id: ProfileId;
  title: string;
  text: string;
  cta: string;
  path: string;
  product: string;
  image: 'hobbie' | 'bartender' | 'empresario';
}

export const PROFILES: Record<ProfileId, QuizProfile> = {
  criador: {
    id: 'criador', title: 'Seu perfil: O Criador', product: 'Drinkeros Xperience', path: '/drinkeros-xperience', image: 'hobbie',
    text: 'Você não quer decorar receitas — você quer chegar em qualquer lugar, olhar o que tem na mesa e criar um drink incrível do nada. Isso se aprende, e é mais simples do que parece: é entender proporções e equilíbrio.',
    cta: 'Quero criar meus próprios drinks',
  },
  aspirante: {
    id: 'aspirante', title: 'Seu perfil: O Aspirante', product: 'Drinkeros Xperience', path: '/drinkeros-xperience', image: 'hobbie',
    text: 'Você sente que tem talento e quer levar isso a sério. O melhor caminho é começar pelo jeito divertido e envolvente, do básico ao avançado, sem pular etapas.',
    cta: 'Quero começar do jeito certo',
  },
  profissional: {
    id: 'profissional', title: 'Seu perfil: O Profissional', product: 'Mixologia Avançada', path: '/mixologia-avancada', image: 'bartender',
    text: 'Você já domina o básico e quer se diferenciar de verdade. Está na hora de mergulhar nas técnicas que separam o amador do profissional e aumentam seu faturamento.',
    cta: 'Quero dominar a mixologia avançada',
  },
  empreendedor_delivery: {
    id: 'empreendedor_delivery', title: 'Seu perfil: O Empreendedor', product: 'Drink Delivery', path: '/drinkdelivery-engarrafados', image: 'empresario',
    text: 'Você não quer só fazer drinks, quer ganhar dinheiro com eles. O delivery de drinks é um dos modelos mais lucrativos e fáceis de começar em casa.',
    cta: 'Quero montar meu delivery',
  },
  empreendedor_eventos: {
    id: 'empreendedor_eventos', title: 'Seu perfil: O Empreendedor', product: 'Bar para Eventos', path: '/bar-p-eventos', image: 'empresario',
    text: 'Você tem perfil pra transformar festas e eventos em negócio. Um bar para eventos bem montado fatura alto em uma única noite.',
    cta: 'Quero fazer bar em eventos',
  },
  aventureiro: {
    id: 'aventureiro', title: 'Seu perfil: O Aventureiro', product: 'Bartender de Bordo', path: '/bartender-a-bordo', image: 'bartender',
    text: 'Você quer ver o mundo e ganhar em dólar fazendo o que ama. Trabalhar como bartender em cruzeiros une viagem, carreira e uma renda que poucos imaginam.',
    cta: 'Quero trabalhar em cruzeiros',
  },
};

const PASSTHROUGH = /^(utm_|fbclid$|gclid$)/;

/** Monta o link da landing mantendo UTMs/fbclid do anúncio e marcando utm_content. */
export function buildDestinationUrl(profile: QuizProfile, currentSearch: string): string {
  const incoming = new URLSearchParams(currentSearch);
  const out = new URLSearchParams();
  incoming.forEach((v, k) => { if (PASSTHROUGH.test(k)) out.set(k, v); });
  out.set('utm_content', `quiz-${profile.id}`);
  return `${profile.path}?${out.toString()}`;
}
