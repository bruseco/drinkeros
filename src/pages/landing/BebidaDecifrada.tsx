import React from 'react';
import {
  Wine,
  BookOpen,
  Sparkles,
  Lightbulb,
  Martini,
  GlassWater,
  PartyPopper,
  Trophy,
  Briefcase,
  History,
  Flame,
} from 'lucide-react';
import CourseLanding, {
  type CourseTheme,
  type LearnItem,
  type ProfileItem,
  type BonusItem,
  type FaqItem,
} from './CourseLanding';

import instructor from '@/assets/landing/bebida-decifrada/instructor.jpg';

// Paleta: âmbar/whisky (curiosidades de destilados)
const theme: CourseTheme = {
  primary: '#b45309',
  secondary: '#78350f',
  accent: '#fbbf24',
  glow1: 'rgba(180, 83, 9, 0.55)',
  glow2: 'rgba(120, 53, 15, 0.55)',
  glow3: 'rgba(251, 191, 36, 0.30)',
};

const learnItems: LearnItem[] = [
  { icon: History, title: 'História de cada bebida', description: 'A origem fascinante das marcas mais icônicas do mundo: Jack Daniel\'s, Absolut, Tanqueray e mais.' },
  { icon: Lightbulb, title: 'Curiosidades exclusivas', description: 'Fatos surpreendentes que poucos bartenders sabem — perfeito para impressionar clientes.' },
  { icon: Wine, title: 'Processo de produção', description: 'Como cada destilado é feito, do plantio à garrafa.' },
  { icon: Flame, title: 'Características sensoriais', description: 'Aroma, paladar e o que torna cada bebida única.' },
  { icon: Martini, title: 'Drink exclusivo por bebida', description: 'Uma receita autoral para cada uma das bebidas estudadas.' },
  { icon: GlassWater, title: 'Harmonização sugerida', description: 'Como combinar cada destilado com pratos e ocasiões.' },
  { icon: BookOpen, title: 'Conteúdo de referência', description: 'Material para consulta sempre que precisar atender com autoridade.' },
  { icon: Sparkles, title: 'Storytelling para o bar', description: 'Aprenda a contar histórias que vendem mais drinks.' },
];

const profiles: ProfileItem[] = [
  { icon: PartyPopper, title: 'Curioso(a) por bebidas', description: 'Para quem ama bebidas e quer entender o que está bebendo de verdade.' },
  { icon: Trophy, title: 'Bartender profissional', description: 'Para profissionais que querem se diferenciar com conhecimento técnico e histórias.' },
  { icon: Briefcase, title: 'Atendente / Garçom', description: 'Para quem trabalha em bar/restaurante e quer recomendar com autoridade.' },
];

const bonus: BonusItem[] = [
  { title: '7 receitas exclusivas', description: 'Um drink autoral para cada bebida estudada (Jack Daniel\'s, Amarula, Tanqueray, Frangelico, Absolut, José Cuervo).' },
  { title: 'Material complementar PDF', description: 'Resumo de todas as curiosidades para consulta rápida no dia a dia do bar.' },
  { title: 'Comunidade Drinkeros', description: 'Acesso ao grupo VIP para trocar experiências com outros alunos e bartenders.' },
];

const faq: FaqItem[] = [
  { q: 'Preciso ser bartender para fazer?', a: 'Não. O curso é para qualquer pessoa que ame bebidas e queira conhecer mais sobre as marcas mais famosas do mundo.' },
  { q: 'Quantas bebidas são estudadas?', a: 'O curso cobre as principais marcas: Jack Daniel\'s, Amarula, Tanqueray, Frangelico, Absolut, José Cuervo e mais.' },
  { q: 'Quanto tempo terei acesso?', a: 'Acesso de 1 ano com direito a todas as aulas durante 365 dias.' },
  { q: 'Como recebo o acesso?', a: 'Após a aprovação do pagamento, você recebe os dados automaticamente no e-mail cadastrado.' },
  { q: 'O pagamento é seguro?', a: 'Sim. Utilizamos Stripe, uma das maiores plataformas de pagamento do mundo.' },
  { q: 'Como é a garantia?', a: 'Garantia incondicional de 15 dias. Não gostou? Devolvemos 100% do valor pago.' },
  { q: 'Como assisto às aulas?', a: 'Por qualquer dispositivo com internet: tablet, celular, desktop, Smart TV e mais.' },
  { q: 'Ainda tenho dúvida, o que faço?', a: 'Fale com nossa equipe pelo WhatsApp ou pelo e-mail suporte@drinkeros.com.br.' },
];

const BebidaDecifrada: React.FC = () => (
  <CourseLanding
    slug="bebida-decifrada"
    brand="Bebida Decifrada"
    instructorSrc={instructor}
    instructorName="Bartenders Drinkeros"
    heroBadge="Minissérie exclusiva"
    tagline="Decifre as bebidas mais famosas do mundo."
    subheadline="Curiosidades, história e um drink exclusivo para cada uma das marcas mais icônicas da coquetelaria."
    ctaHero="QUERO DECIFRAR AS BEBIDAS"
    theme={theme}
    fallbackPrice={147}
    oldPriceLabel="De R$ 247,00"
    learnItems={learnItems}
    whatYouLearnTitle="O que você vai aprender"
    profiles={profiles}
    bonusTitle="3 BÔNUS exclusivos"
    bonus={bonus}
    guaranteeDays={15}
    offerSummary="Entenda de verdade o universo das bebidas: destilados, fermentados, vinhos e licores sem decoreba.
Aprenda história, produção, harmonização e como recomendar a bebida certa em qualquer ocasião.
Ideal para apaixonados, atendentes e profissionais que querem soar como especialistas.
Acesso completo + bônus exclusivos + garantia incondicional."
    faq={faq}
  />
);

export default BebidaDecifrada;
