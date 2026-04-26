import React from 'react';
import {
  Ship,
  Globe,
  DollarSign,
  Briefcase,
  GraduationCap,
  Users,
  PartyPopper,
  Trophy,
  ClipboardList,
  Compass,
  Languages,
  Anchor,
} from 'lucide-react';
import CourseLanding, {
  type CourseTheme,
  type LearnItem,
  type ProfileItem,
  type BonusItem,
  type FaqItem,
} from './CourseLanding';

import instructor from '@/assets/landing/bartender-bordo/instructor.jpg';
import instructorAbout from '@/assets/landing/bartender-bordo/rick-sousa.jpg';
import heroVideo from '@/assets/landing/bartender-bordo/intro.mp4';
import logo from '@/assets/landing/bartender-bordo/logo.png';

// Paleta: vermelho Virgin + azul oceano + amarelo (logo)
const theme: CourseTheme = {
  primary: '#ef4444',
  secondary: '#1d4ed8',
  accent: '#facc15',
  glow1: 'rgba(239, 68, 68, 0.55)',
  glow2: 'rgba(29, 78, 216, 0.55)',
  glow3: 'rgba(250, 204, 21, 0.30)',
};

const learnItems: LearnItem[] = [
  { icon: ClipboardList, title: 'Requisitos básicos', description: 'Tudo que você precisa para se candidatar a uma vaga em cruzeiros.' },
  { icon: Anchor, title: 'Tipos de bares a bordo', description: 'Conheça cada bar do navio: pool, lobby, especialidades, lounges e mais.' },
  { icon: Users, title: 'Como ser um bom profissional', description: 'Postura, atendimento e diferencial para se destacar entre milhares de candidatos.' },
  { icon: Briefcase, title: 'Agências de recrutamento', description: 'As principais agências e como aplicar em cada uma com sucesso.' },
  { icon: Languages, title: 'Inglês para bartender', description: 'O vocabulário essencial para passar nas entrevistas e trabalhar a bordo.' },
  { icon: DollarSign, title: 'Salário e gorjetas', description: 'Quanto realmente se ganha em dólar trabalhando em cruzeiros.' },
  { icon: Compass, title: 'Vida a bordo', description: 'Rotina, folgas, alimentação e como é o dia a dia da tripulação.' },
  { icon: Globe, title: 'Viaje o mundo', description: 'Conheça países e culturas enquanto constrói sua carreira internacional.' },
];

const profiles: ProfileItem[] = [
  { icon: GraduationCap, title: 'Bartender iniciante', description: 'Para quem quer começar carreira internacional com renda em dólar.' },
  { icon: Trophy, title: 'Bartender profissional', description: 'Para quem já atua e quer dar um upgrade de carreira em cruzeiros.' },
  { icon: PartyPopper, title: 'Quem ama viajar', description: 'Para você que quer unir profissão e paixão por conhecer o mundo.' },
];

const bonus: BonusItem[] = [
  { title: 'Modelos de currículo aprovados', description: 'Templates de CV no padrão exigido pelas principais companhias de cruzeiro.' },
  { title: 'Lista de agências de recrutamento', description: 'Contatos diretos das agências que mais contratam bartenders no Brasil.' },
  { title: 'Mentoria com Rick Souza', description: 'Mais de 15 anos de experiência em cruzeiros internacionais ao seu lado.' },
];

const faq: FaqItem[] = [
  { q: 'Preciso falar inglês fluente?', a: 'Não precisa ser fluente, mas é importante ter um nível intermediário. O curso ajuda com o vocabulário técnico.' },
  { q: 'Quanto se ganha em cruzeiros?', a: 'Os ganhos variam de US$ 1.500 a US$ 4.000+ por mês com gorjetas, dependendo da posição e companhia.' },
  { q: 'Quanto tempo terei acesso?', a: 'Acesso de 1 ano com direito a todas as aulas durante 365 dias.' },
  { q: 'Como recebo o acesso?', a: 'Após a aprovação do pagamento, os dados chegam automaticamente no seu e-mail cadastrado.' },
  { q: 'O pagamento é seguro?', a: 'Sim. Utilizamos Stripe, uma das maiores plataformas de pagamento do mundo.' },
  { q: 'Como é a garantia?', a: 'Garantia incondicional de 15 dias. Não gostou? Devolvemos 100% do valor pago.' },
  { q: 'Como assisto às aulas?', a: 'Por qualquer dispositivo com internet: tablet, celular, desktop, Smart TV e mais.' },
  { q: 'Ainda tenho dúvida, o que faço?', a: 'Fale com nossa equipe pelo WhatsApp ou pelo e-mail suporte@drinkeros.com.br.' },
];

const aboutInstructor = {
  name: 'Rick Sousa',
  photoSrc: instructorAbout,
  title: 'Quem é o seu professor?',
  paragraphs: [
    'Meu nome é Ricardo Sousa — ou Rick Sousa, para os mais íntimos do Instagram. Sou mixologista, bartender clássico, barista, sommelier, chef e mestre destileiro. Falo e escrevo fluentemente 8 línguas (sim, graças ao navio) e trabalho no ramo de cruzeiros desde os 18 anos.',
    'Já passei por mais de 6 companhias de cruzeiro e atualmente faço parte dos encarregados dentro do sistema do bar da Virgin Voyages. Também sou participante e ganhador de algumas competições como Melhor Margarita do Mundo, World Class, Bacardi Legacy, Campari Competition e Flor de Caña Rum, entre outras.',
    'Mais do que uma formação profissional de qualidade, este curso será o seu passaporte para realizar sonhos ainda maiores e mais distantes — respeitando todas as nacionalidades. Aqui você vai entender o que as companhias realmente procuram: técnica, criatividade, postura, sociabilidade e domínio de outro idioma (inglês, essencialmente).',
    'Vamos começar uma etapa de muitas aprendizagens! Existem várias fases até você chegar a bordo, e o inglês é a mais importante de todas — junto com a sua formação profissional. Bora?',
  ],
  credentials: [
    'Mixologista formado pela EBS (European Bartender School)',
    'Bartender Clássico pelo IBA (International Bartender Association)',
    'Barista pela Faculdade Illy de Genova',
    'Sommelier pelo WSET Global LV1',
    'Chef pela Ferrandi — Paris',
    'Mestre Destileiro pela InovBev (Brasil)',
  ],
};

const BartenderABordo: React.FC = () => (
  <CourseLanding
    slug="bartender-a-bordo"
    brand="Bartender a Bordo"
    instructorSrc={instructor}
    instructorName="Rick Souza"
    logoSrc={logo}
    logoClassName="h-52 sm:h-72"
    logoWrapperClassName="-mt-6 sm:-mt-10 mb-2"
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
);

export default BartenderABordo;
