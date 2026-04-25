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

// Paleta: âmbar/dourado clássico (whisky / bourbon)
const theme: CourseTheme = {
  primary: '#f59e0b',
  secondary: '#d97706',
  accent: '#fde047',
  glow1: 'rgba(245, 158, 11, 0.55)',
  glow2: 'rgba(217, 119, 6, 0.50)',
  glow3: 'rgba(253, 224, 71, 0.30)',
};

const learnItems: LearnItem[] = [
  { icon: BookOpen, title: 'História da coquetelaria', description: 'Conheça os tipos de bares e a diferença entre os cargos dentro de um bar.' },
  { icon: GlassWater, title: 'Mise en place, taças e copos', description: 'Aprenda a organizar a estação, mexer nos utensílios e usar cada taça e copo.' },
  { icon: Droplets, title: 'Xaropes artesanais', description: 'Diferentes técnicas para produzir seus próprios xaropes em casa.' },
  { icon: Martini, title: 'Drinks mexidos, montados e batidos', description: 'Domine as três grandes técnicas de preparo da coquetelaria.' },
  { icon: Snowflake, title: 'Tudo sobre o gelo', description: 'O ingrediente mais primordial — e mais subestimado — da coquetelaria.' },
  { icon: Leaf, title: 'Decorações elegantes', description: 'Tipos de decorações para elevar o nível visual dos seus drinks.' },
  { icon: Wine, title: 'Tipos de bebidas', description: 'Fermentados, destilados e bebidas compostas explicados de forma clara.' },
  { icon: Lightbulb, title: 'Curiosidades dos destilados', description: 'Origem, produção, armazenamento e tipos de cada destilado clássico.' },
  { icon: Sparkles, title: 'Os clássicos mais importantes', description: 'Os principais coquetéis derivados de cada destilado, do Mojito ao Negroni.' },
];

const profiles: ProfileItem[] = [
  { icon: PartyPopper, title: 'Hobbie / Lazer', description: 'Para você que quer aproveitar melhor com amigos e família proporcionando momentos especiais.' },
  { icon: Trophy, title: 'Bartender', description: 'Para você que já é bartender profissional ou quer seguir carreira e aprimorar conhecimentos.' },
  { icon: Briefcase, title: 'Empresário(a)', description: 'Para donos de bar, restaurante, quiosque ou casa noturna que querem capacitar a equipe.' },
];

const bonus: BonusItem[] = [
  { title: 'Clube dos Drinkeros', description: 'Acesso exclusivo ao app com mais de 1.000 receitas para pesquisar e salvar como favoritas.', originalPrice: 'R$ 247,00' },
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

const ClassicosDestilados: React.FC = () => (
  <CourseLanding
    slug="classicos-destilados"
    brand="Clássicos & Destilados"
    instructorSrc={instructor}
    instructorName="Rand Bartender"
    heroBadge="Com Rand Bartender"
    tagline="Aprenda coquetelaria com quem está crescendo a cada dia nesse mercado."
    subheadline="Do básico ao avançado, da Vodka ao Bourbon, da Caipirinha ao Negroni. Divertido e interativo, no estilo Netflix."
    ctaHero="MATRICULE-SE AGORA"
    theme={theme}
    fallbackPrice={697}
    oldPriceLabel="De R$ 1.041,00"
    learnItems={learnItems}
    whatYouLearnTitle="O que você vai aprender"
    profiles={profiles}
    bonusTitle="3 BÔNUS exclusivos"
    bonus={bonus}
    guaranteeDays={15}
    faq={faq}
  />
);

export default ClassicosDestilados;
