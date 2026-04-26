import React from 'react';
import {
  Sparkles,
  Wine,
  Martini,
  Flame,
  BookOpen,
  Trophy,
  PartyPopper,
  Briefcase,
  GlassWater,
  Lightbulb,
} from 'lucide-react';
import CourseLanding, {
  type CourseTheme,
  type LearnItem,
  type ProfileItem,
  type BonusItem,
  type FaqItem,
} from './CourseLanding';

import instructor from '@/assets/landing/classicos/instructor.jpg';

// Paleta: rubi/vinho intenso (workshop premium, "além dos clássicos")
const theme: CourseTheme = {
  primary: '#dc2626',
  secondary: '#7f1d1d',
  accent: '#fbbf24',
  glow1: 'rgba(220, 38, 38, 0.55)',
  glow2: 'rgba(127, 29, 29, 0.55)',
  glow3: 'rgba(251, 191, 36, 0.30)',
};

const learnItems: LearnItem[] = [
  { icon: Sparkles, title: 'Releituras autorais', description: 'Vá além dos clássicos: aprenda a criar releituras criativas dos drinks consagrados.' },
  { icon: Martini, title: 'Coquetelaria contemporânea', description: 'Técnicas modernas usadas em coquetelarias premiadas pelo mundo.' },
  { icon: Flame, title: 'Infusões e técnicas avançadas', description: 'Fat-washing, clarificação e infusões para drinks de assinatura.' },
  { icon: Wine, title: 'Harmonização de sabores', description: 'Domine as combinações que fazem um drink memorável.' },
  { icon: GlassWater, title: 'Apresentação profissional', description: 'Cristalaria, decoração e ritual de serviço de alto nível.' },
  { icon: Lightbulb, title: 'Criatividade aplicada', description: 'Como pensar receitas do zero a partir de um destilado e uma estação.' },
  { icon: BookOpen, title: '4 e-books exclusivos', description: 'Um e-book para cada aula, com receitas e referências para resgatar.' },
  { icon: Trophy, title: 'Mentoria com bartenders top', description: 'Conteúdo conduzido por profissionais que vivem a coquetelaria autoral.' },
];

const profiles: ProfileItem[] = [
  { icon: PartyPopper, title: 'Entusiasta avançado', description: 'Para quem já domina o básico e quer dar o próximo passo na criatividade.' },
  { icon: Trophy, title: 'Bartender profissional', description: 'Para profissionais que querem se destacar com drinks autorais.' },
  { icon: Briefcase, title: 'Empresário(a) do food service', description: 'Para donos de bar/restaurante que querem renovar a carta com releituras.' },
];

const bonus: BonusItem[] = [
  { title: '4 E-books exclusivos do Workshop', description: 'Um e-book por aula, com receitas, técnicas e curiosidades dos drinks apresentados.' },
  { title: 'Clube dos Drinkeros', description: 'Acesso ao app com mais de 1.000 receitas para pesquisar e salvar como favoritas.', originalPrice: 'R$ 247,00' },
  { title: 'Comunidade VIP no WhatsApp', description: 'Grupo exclusivo para tirar dúvidas e trocar experiências com outros alunos.' },
];

const faq: FaqItem[] = [
  { q: 'Esse workshop é para iniciantes?', a: 'Não. Recomendamos para quem já domina os clássicos e quer aprender releituras e técnicas avançadas.' },
  { q: 'Quanto tempo terei acesso?', a: 'Acesso de 1 ano com direito a todas as aulas e e-books durante 365 dias.' },
  { q: 'Como recebo o acesso?', a: 'Após a aprovação do pagamento, você recebe os dados automaticamente no e-mail cadastrado.' },
  { q: 'O pagamento é seguro?', a: 'Sim. Utilizamos Stripe, uma das maiores plataformas de pagamento do mundo.' },
  { q: 'Como é a garantia?', a: 'Garantia incondicional de 15 dias. Não gostou? Devolvemos 100% do valor pago.' },
  { q: 'Como assisto às aulas?', a: 'Por qualquer dispositivo com internet: tablet, celular, desktop, Smart TV e mais.' },
  { q: 'Ainda tenho dúvida, o que faço?', a: 'Fale com nossa equipe pelo WhatsApp ou pelo e-mail suporte@drinkeros.com.br.' },
];

const WorkshopAlemDosClassicos: React.FC = () => (
  <CourseLanding
    slug="workshop-alem-dos-classicos"
    brand="Workshop Além dos Clássicos"
    instructorSrc={instructor}
    instructorName="Bartenders Drinkeros"
    heroBadge="Workshop Premium"
    tagline="Vá além dos clássicos. Crie drinks autorais que ninguém esquece."
    subheadline="4 aulas + 4 e-books exclusivos com releituras criativas dos coquetéis mais famosos do mundo."
    ctaHero="QUERO PARTICIPAR"
    theme={theme}
    fallbackPrice={297}
    oldPriceLabel="De R$ 497,00"
    learnItems={learnItems}
    whatYouLearnTitle="O que você vai aprender"
    profiles={profiles}
    bonusTitle="3 BÔNUS exclusivos"
    bonus={bonus}
    guaranteeDays={15}
    offerSummary="Vá além dos clássicos: aprenda a criar autorais, releituras e drinks de assinatura que encantam e fidelizam clientes.
Técnicas modernas, equilíbrio de sabores e storytelling líquido para diferenciar sua carta.
Perfeito para bartenders, donos de bar e curiosos que querem sair do óbvio.
Acesso completo + bônus exclusivos + garantia incondicional."
    faq={faq}
  />
);

export default WorkshopAlemDosClassicos;
