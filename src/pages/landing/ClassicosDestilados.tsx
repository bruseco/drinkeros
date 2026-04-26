import React from 'react';
import {
  BookOpen,
  Wine,
  Droplets,
  Sparkles,
  Snowflake,
  Leaf,
  GlassWater,
  Lightbulb,
  Martini,
  PartyPopper,
  Trophy,
  Briefcase,
} from 'lucide-react';
import CourseLanding, {
  type CourseTheme,
  type LearnItem,
  type ProfileItem,
  type BonusItem,
  type FaqItem,
} from './CourseLanding';

import instructor from '@/assets/landing/classicos/instructor.jpg';
import logo from '@/assets/landing/classicos/logo.png';
import learnHistoria from '@/assets/landing/classicos/learn-historia.jpg';
import learnTacas from '@/assets/landing/classicos/learn-tacas.jpg';
import learnXaropes from '@/assets/landing/classicos/learn-xaropes.jpg';
import learnMexidos from '@/assets/landing/classicos/learn-mexidos.jpg';
import learnGelo from '@/assets/landing/classicos/learn-gelo.jpg';
import learnDecoracoes from '@/assets/landing/classicos/learn-decoracoes.jpg';
import learnBebidas from '@/assets/landing/classicos/learn-bebidas.jpg';
import learnCuriosidades from '@/assets/landing/classicos/learn-curiosidades.jpg';
import learnClassicos from '@/assets/landing/classicos/learn-classicos.jpg';
import heroVideo from '@/assets/landing/classicos/hero-video.mp4';

// Paleta: verde musgo → verde bandeira (estrutura) + dourado profundo (amarelo + marrom) nos CTAs/ícones
const theme: CourseTheme = {
  primary: '#b8860b',     // dark goldenrod (dourado escuro com marrom)
  secondary: '#5c3a12',   // marrom profundo (vinho/uísque)
  accent: '#e8b923',      // dourado quente (amarelo puxado pro mel)
  glow1: 'rgba(184, 134, 11, 0.55)',
  glow2: 'rgba(92, 58, 18, 0.55)',
  glow3: 'rgba(232, 185, 35, 0.35)',
};

const learnItems: LearnItem[] = [
  { icon: BookOpen, imageSrc: learnHistoria, title: 'História da coquetelaria', description: 'Conheça os tipos de bares e a diferença entre os cargos dentro de um bar.' },
  { icon: GlassWater, imageSrc: learnTacas, title: 'Mise en place, taças e copos', description: 'Aprenda a organizar a estação, mexer nos utensílios e usar cada taça e copo.' },
  { icon: Droplets, imageSrc: learnXaropes, title: 'Xaropes artesanais', description: 'Diferentes técnicas para produzir seus próprios xaropes em casa.' },
  { icon: Martini, imageSrc: learnMexidos, title: 'Drinks mexidos, montados e batidos', description: 'Domine as três grandes técnicas de preparo da coquetelaria.' },
  { icon: Snowflake, imageSrc: learnGelo, title: 'Tudo sobre o gelo', description: 'O ingrediente mais primordial — e mais subestimado — da coquetelaria.' },
  { icon: Leaf, imageSrc: learnDecoracoes, title: 'Decorações elegantes', description: 'Tipos de decorações para elevar o nível visual dos seus drinks.' },
  { icon: Wine, imageSrc: learnBebidas, title: 'Tipos de bebidas', description: 'Fermentados, destilados e bebidas compostas explicados de forma clara.' },
  { icon: Lightbulb, imageSrc: learnCuriosidades, title: 'Curiosidades dos destilados', description: 'Origem, produção, armazenamento e tipos de cada destilado clássico.' },
  { icon: Sparkles, imageSrc: learnClassicos, title: 'Os clássicos mais importantes', description: 'Os principais coquetéis derivados de cada destilado, do Mojito ao Negroni.' },
];

const profiles: ProfileItem[] = [
  { icon: PartyPopper, title: 'Hobbie / Lazer', description: 'Para você que quer aproveitar melhor com amigos e família proporcionando momentos especiais.' },
  { icon: Trophy, title: 'Bartender', description: 'Para você que já é bartender profissional ou quer seguir carreira e aprimorar conhecimentos.' },
  { icon: Briefcase, title: 'Empresário(a)', description: 'Para donos de bar, restaurante, quiosque ou casa noturna que querem capacitar a equipe.' },
];

const bonus: BonusItem[] = [
  { title: 'Acesso VIP por 1 Ano', description: 'Acesso completo ao Clube VIP Drinkeros por 12 meses: app com mais de 1.000 receitas, conteúdos exclusivos e benefícios premium.', originalPrice: 'R$ 247,00' },
  { title: 'Mais de 40 receitas de Xaropes', description: 'Receituário exclusivo de xaropes artesanais para gerar economia e elevar seus drinks.' },
  { title: 'Minissérie Bebida Decifrada', description: '6 episódios contando curiosidades das bebidas mais famosas (Jack Daniels, Amarula, Absolut e mais), com receitas exclusivas.', originalPrice: 'R$ 97,00' },
];

const faq: FaqItem[] = [
  { q: 'Não sou profissional, esse curso é pra mim?', a: 'Sim! Mais de 60% dos nossos alunos fazem o curso por hobby — é quase uma terapia. O conteúdo começa do zero.' },
  { q: 'Quanto tempo terei acesso?', a: 'O acesso é de 1 ano, com direito a todos os vídeos durante 365 dias.' },
  { q: 'Como recebo o acesso?', a: 'Após a aprovação do pagamento, você recebe os dados automaticamente no e-mail cadastrado. Verifique também o spam.' },
  { q: 'O pagamento é seguro?', a: 'Sim. Utilizamos o Stripe, uma das maiores plataformas de pagamento do mundo.' },
  { q: 'Sou menor de 18 anos, posso fazer o curso?', a: 'O curso não é recomendado para menores de 18 anos. Se for menor, peça para um responsável — também ensinamos drinks sem álcool.' },
  { q: 'Já sou bartender profissional, esse curso é pra mim?', a: 'Sim. Você vai atualizar suas habilidades, expandir a criatividade e revisar fundamentos com uma nova perspectiva.' },
  { q: 'Como é a garantia?', a: 'Garantia incondicional de 15 dias. Não gostou? Devolvemos 100% do valor pago.' },
  { q: 'Como assisto às aulas?', a: 'Por qualquer dispositivo com internet: tablet, celular, desktop, Smart TV e mais.' },
  { q: 'Ainda tenho dúvida, o que faço?', a: 'Fale com nossa equipe pelo WhatsApp ou pelo e-mail suporte@drinkeros.com.br.' },
];

const aboutInstructor = {
  name: 'Rand Bartender',
  photoSrc: instructor,
  title: 'Quem é o seu professor?',
  paragraphs: [
    'Rand Bartender é um dos profissionais que mais cresce no mercado de coquetelaria nacional. Com anos de bar, eventos e bancadas, transformou a paixão pelos clássicos em método — ensinando do básico ao avançado, da Vodka ao Bourbon, da Caipirinha ao Negroni.',
    'Apaixonado por destilados e suas histórias, Rand acredita que entender a bebida é o que separa um bartender comum de um grande bartender. Por isso, cada aula é construída para você dominar a técnica, a teoria e a criatividade por trás de cada drink.',
    'No curso Clássicos & Destilados você aprende com quem vive a coquetelaria todos os dias e está disposto a compartilhar tudo o que sabe — de forma divertida, interativa e no estilo Netflix.',
  ],
  credentials: [
    'Bartender profissional em atividade',
    'Especialista em coquetelaria clássica',
    'Mentor de novos bartenders no Brasil',
    'Criador de conteúdo Drinkeros',
  ],
};

const ClassicosDestilados: React.FC = () => (
  <CourseLanding
    slug="classicos-destilados"
    brand="Clássicos & Destilados"
    instructorSrc={instructor}
    instructorName="Rand Bartender"
    logoSrc={logo}
    logoClassName="h-44 sm:h-60"
    logoWrapperClassName="-mt-4 sm:-mt-6 mb-2"
    titleFontClassName="[font-family:'Playfair_Display',serif] tracking-tight"
    heroBadge="Com Rand Bartender"
    tagline="Aprenda coquetelaria com quem está crescendo a cada dia nesse mercado."
    taglineClassName="text-[#e8b923] [text-shadow:_0_0_24px_rgba(232,185,35,0.65),_0_0_48px_rgba(232,185,35,0.4)]"
    subheadline="Do básico ao avançado, da Vodka ao Bourbon, da Caipirinha ao Negroni. Divertido e interativo, no estilo Netflix."
    heroVideoUrl={heroVideo}
    heroVideoAspect="square"
    subheadlineBelowVideo
    ctaHero="MATRICULE-SE AGORA"
    theme={theme}
    fallbackPrice={697}
    oldPriceLabel="De R$ 1.041,00"
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

export default ClassicosDestilados;
