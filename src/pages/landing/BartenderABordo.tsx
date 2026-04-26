import React from 'react';
import {
  Ship,
  DollarSign,
  Globe,
  GraduationCap,
  ClipboardCheck,
  Users,
  Plane,
  PartyPopper,
  TrendingUp,
} from 'lucide-react';
import CourseLanding, {
  type CourseTheme,
  type LearnItem,
  type ProfileItem,
  type BonusItem,
  type FaqItem,
} from './CourseLanding';

import logo from '@/assets/landing/bartender-bordo/logo.png';
import instructor from '@/assets/landing/bartender-bordo/rick-sousa.jpg';
import heroVideo from '@/assets/landing/bartender-bordo/intro.mp4';

const theme: CourseTheme = {
  primary: '#ef4444',
  secondary: '#1d4ed8',
  accent: '#facc15',
  glow1: 'rgba(239, 68, 68, 0.55)',
  glow2: 'rgba(29, 78, 216, 0.55)',
  glow3: 'rgba(250, 204, 21, 0.30)',
};

const learnItems: LearnItem[] = [
  { icon: Ship, title: 'Como ser contratado', description: 'O passo a passo completo para ser aprovado nas grandes companhias de cruzeiros internacionais.' },
  { icon: ClipboardCheck, title: 'Documentação', description: 'Vistos, contratos, exames médicos e tudo que você precisa para embarcar legalmente.' },
  { icon: GraduationCap, title: 'Treinamento de bordo', description: 'O que esperar do treinamento, da rotina e da hierarquia a bordo de um navio.' },
  { icon: DollarSign, title: 'Salário em dólar', description: 'Como funcionam as gorjetas, comissões e a estrutura salarial em moeda forte.' },
  { icon: Globe, title: 'Viajando o mundo', description: 'Conheça portos, países e culturas trabalhando no que você ama.' },
  { icon: Users, title: 'Networking internacional', description: 'Crie conexões com profissionais do mundo inteiro e abra portas para sua carreira.' },
];

const profiles: ProfileItem[] = [
  { icon: PartyPopper, title: 'Quem ama drinks', description: 'Para você que sonha em transformar a paixão por coquetelaria numa carreira internacional.' },
  { icon: Plane, title: 'Quem quer viajar', description: 'Para quem quer conhecer o mundo sendo pago por isso, ganhando em dólar.' },
  { icon: TrendingUp, title: 'Quem quer crescer', description: 'Para profissionais que buscam uma virada de chave na carreira e na vida financeira.' },
];

const bonus: BonusItem[] = [
  { title: 'BÔNUS 1 — Modelos de currículo', description: 'Templates prontos no padrão internacional usado pelas companhias.' },
  { title: 'BÔNUS 2 — Lista de companhias', description: 'Lista atualizada das principais companhias contratantes e como aplicar.' },
  { title: 'BÔNUS 3 — Mentoria em grupo', description: 'Acesso a sessões em grupo para tirar dúvidas e acelerar sua contratação.' },
];

const aboutInstructor = {
  name: 'Rick Souza',
  photoSrc: instructor,
  title: 'Quem é o seu professor?',
  paragraphs: [
    'Meu nome é Ricardo Sousa — ou Rick Sousa para os mais íntimos do Instagram. Sou mixologista formado pela EBS (European Bartender School), Bartender Clássico pelo IBA (International Bartender Association), Barista pela Faculdade Illy de Genova, Sommelier WSET Global LV1, Chef pela Ferrandi-Paris e Mestre Destilador pela InovBev (Brasil).',
    'Sou participante e ganhador de competições como melhor margarita do mundo, World Class, Bacardi Legacy, Campari Competition e Flor de Caña Rum, entre outras. Falo e escrevo fluentemente 8 idiomas (sim, graças aos navios) e trabalho no ramo de cruzeiros desde os 18 anos. Já passei por mais de 6 companhias e atualmente sou um dos encarregados do sistema de bar da Virgin Voyages.',
    'O curso será o seu passaporte para realizar sonhos ainda maiores e mais distantes — respeitando todas as nacionalidades. Vamos começar uma etapa de muitas aprendizagens! Aqui você descobre o que as companhias realmente procuram em um bartender, as técnicas, a postura, o atendimento e tudo o que separa quem sonha de quem embarca.',
  ],
  credentials: [
    'EBS — European Bartender School',
    'IBA — International Bartender Association',
    'Barista — Faculdade Illy (Genova)',
    'WSET Global LV1 — Sommelier',
    'Ferrandi — Paris (Chef)',
    'InovBev — Mestre Destilador (Brasil)',
    '15+ anos em cruzeiros · Virgin Voyages',
  ],
};

const faq: FaqItem[] = [
  { q: 'Preciso falar inglês fluente?', a: 'Inglês intermediário já te coloca no jogo. O curso te orienta sobre o nível necessário e como evoluir rapidamente.' },
  { q: 'Quanto tempo leva para ser contratado?', a: 'Varia de pessoa para pessoa. Com dedicação ao processo do curso, alunos têm conseguido em poucos meses.' },
  { q: 'Quanto tempo terei acesso?', a: 'Você tem 1 ano de acesso completo a todas as aulas e bônus.' },
  { q: 'Como recebo o acesso?', a: 'Após a aprovação do pagamento, os dados chegam automaticamente no seu e-mail (verifique também o spam).' },
  { q: 'O pagamento é seguro?', a: 'Sim. Utilizamos o Stripe, uma das maiores plataformas de pagamento do mundo.' },
  { q: 'Como é a garantia?', a: 'Garantia incondicional de 15 dias. Não gostou? Devolvemos 100% do valor.' },
  { q: 'Como assisto às aulas?', a: 'Por qualquer dispositivo com internet: tablet, celular, desktop, Smart TV e mais.' },
  { q: 'Ainda tenho dúvida, o que faço?', a: 'Fale com nossa equipe pelo WhatsApp ou pelo e-mail suporte@drinkeros.com.br.' },
];

const BartenderABordo: React.FC = () => (
  <div style={{ marginTop: '-10px' }}>
    <CourseLanding
      slug="bartender-a-bordo"
      brand="Bartender a Bordo"
      instructorSrc={instructor}
      instructorName="Rick Souza"
      logoSrc={logo}
      logoClassName="h-52 sm:h-72"
      logoWrapperClassName="-mt-10 sm:-mt-16 mb-0"
      heroBadge="Com Rick Souza · 15+ anos em cruzeiros"
      heroVideoUrl={heroVideo}
      heroVideoAspect="square"
      tagline="Viaje o mundo, ganhe em dólar e viva momentos incríveis."
      taglineClassName="text-yellow-400 drop-shadow-[0_2px_8px_rgba(250,204,21,0.35)]"
      subheadline="Saiba todos os detalhes para ser contratado em cruzeiros internacionais com quem viveu isso por mais de 15 anos."
      subheadlineBelowVideo
      ctaHero="QUERO TRABALHAR EM CRUZEIROS"
      theme={theme}
      fallbackPrice={397}
      oldPriceLabel="De R$ 697,00"
      learnItems={learnItems}
      whatYouLearnTitle="O que você vai aprender"
      profiles={profiles}
      bonusTitle="3 BÔNUS exclusivos"
      bonus={bonus}
      aboutInstructor={aboutInstructor}
      guaranteeDays={15}
      faq={faq}
    />
  </div>
);

export default BartenderABordo;
