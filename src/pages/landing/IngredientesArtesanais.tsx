import React from 'react';
import {
  Beaker,
  Droplets,
  Snowflake,
  Sparkles,
  Leaf,
  FlaskConical,
  Apple,
  Egg,
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

import logo from '@/assets/landing/ingredientes/logo.png';
import logoBg from '@/assets/landing/ingredientes/logo-bg.jpg';
import instructor from '@/assets/landing/ingredientes/instructor.jpg';
import dep1 from '@/assets/landing/ingredientes/dep-1.jpg';
import dep2 from '@/assets/landing/ingredientes/dep-2.jpg';
import dep3 from '@/assets/landing/ingredientes/dep-3.jpg';

// Paleta: verde esmeralda + âmbar (artesanal / natural / orgânico)
const theme: CourseTheme = {
  primary: '#10b981',
  secondary: '#14b8a6',
  accent: '#fbbf24',
  glow1: 'rgba(16, 185, 129, 0.55)',
  glow2: 'rgba(20, 184, 166, 0.50)',
  glow3: 'rgba(251, 191, 36, 0.30)',
};

const learnItems: LearnItem[] = [
  { icon: Droplets, title: 'Xaropes artesanais', description: 'Mais de 40 receitas com frutas, especiarias e ervas para dar identidade aos seus drinks.' },
  { icon: Sparkles, title: 'Espumas no sifão', description: 'Use o sifão com segurança e crie espumas perfeitas que dão textura e visual aos seus drinks.' },
  { icon: Snowflake, title: 'Gelo translúcido', description: 'Aprenda a fazer o gelo translúcido utilizado pela alta coquetelaria mundial.' },
  { icon: Beaker, title: 'Bitter artesanal', description: 'Crie bitters aromáticos a baixo custo e traga complexidade e equilíbrio aos seus coquetéis.' },
  { icon: Leaf, title: 'Decorações comestíveis', description: 'Técnicas criativas para desidratar frutas, conservar ingredientes e decorar como um artista.' },
  { icon: FlaskConical, title: 'Infusões', description: 'Faça rum com especiarias, gin infusionado com frutas e crie perfis únicos de sabor.' },
  { icon: Apple, title: 'Purês de frutas', description: 'Crie purês naturais e saborosos para elevar a base dos seus coquetéis.' },
  { icon: Egg, title: 'Aquafaba', description: 'Uma alternativa vegana à clara de ovo, ideal para coquetéis espumantes e mais éticos.' },
];

const profiles: ProfileItem[] = [
  { icon: PartyPopper, title: 'Hobbie / Lazer', description: 'Para você que ama drinks e quer elevar o nível das suas criações em casa com ingredientes únicos.' },
  { icon: Trophy, title: 'Bartender', description: 'Para o bartender que quer se diferenciar e criar uma assinatura própria nos seus coquetéis.' },
  { icon: Briefcase, title: 'Empresário(a)', description: 'Para donos de bar e restaurante que querem reduzir custos e aumentar a margem com produção própria.' },
];

const bonus: BonusItem[] = [
  { title: 'Receituário completo', description: 'PDF com todas as proporções, ingredientes e dicas de armazenamento para consulta rápida.' },
];

const faq: FaqItem[] = [
  { q: 'Não sou profissional, esse curso é pra mim?', a: 'Sim! O curso é didático e leva você do básico ao avançado para produzir seus próprios ingredientes em casa.' },
  { q: 'Quanto tempo terei acesso?', a: 'O acesso é de 1 ano, com direito a todos os vídeos durante 365 dias.' },
  { q: 'Como recebo o acesso?', a: 'Após a aprovação do pagamento, você recebe os dados automaticamente no e-mail cadastrado. Verifique também o spam.' },
  { q: 'Preciso de equipamentos caros?', a: 'A maior parte dos ingredientes é feita com utensílios simples de cozinha. Indicamos opções em conta para o sifão e moldes de gelo.' },
  { q: 'O pagamento é seguro?', a: 'Sim. Utilizamos o Stripe, uma das maiores plataformas de pagamento do mundo.' },
  { q: 'Em quanto tempo recupero o investimento?', a: 'Apenas economizando na produção dos próprios xaropes e ingredientes você já paga o curso em poucas semanas.' },
  { q: 'Como é a garantia?', a: 'Garantia incondicional de 15 dias. Não gostou? Devolvemos 100% do valor.' },
  { q: 'Como assisto às aulas?', a: 'Por qualquer dispositivo com internet: tablet, celular, desktop, Smart TV e mais.' },
  { q: 'Ainda tenho dúvida, o que faço?', a: 'Fale com nossa equipe pelo WhatsApp ou pelo e-mail suporte@drinkeros.com.br.' },
];

const IngredientesArtesanais: React.FC = () => (
  <CourseLanding
    slug="ingredientes-artesanais"
    brand="Ingredientes Artesanais"
    logoSrc={logo}
    logoBgSrc={logoBg}
    instructorSrc={instructor}
    instructorName="Bruno Abreu"
    heroVideoUrl="https://www.youtube.com/embed/YWZRA7NsL48?rel=0&playsinline=1"
    heroBadge="Com Bruno Abreu · Drinkeros"
    tagline="Economize no dia a dia produzindo seus próprios ingredientes artesanais."
    subheadline="Eleve o nível dos seus drinks com xaropes artesanais, gelo translúcido, espumas saborizadas, bitter artesanal e tudo o que você precisa para deixar seu drink ainda mais valioso."
    ctaHero="QUERO COMEÇAR"
    theme={theme}
    fallbackPrice={197}
    oldPriceLabel="De R$ 410,00"
    learnItems={learnItems}
    whatYouLearnTitle="O que você vai aprender"
    profiles={profiles}
    bonusTitle="BÔNUS exclusivo"
    bonus={bonus}
    testimonials={[{ src: dep1 }, { src: dep2 }, { src: dep3 }]}
    guaranteeDays={15}
    faq={faq}
  />
);

export default IngredientesArtesanais;
