import React from 'react';
import {
  Award,
  BookOpen,
  Wine,
  Beaker,
  TrendingUp,
  Users,
  Shield,
  Sparkles,
  GlassWater,
  Trophy,
  Briefcase,
  PartyPopper,
} from 'lucide-react';
import CourseLanding, {
  type CourseTheme,
  type LearnItem,
  type ModuleItem,
  type ProfileItem,
  type BonusItem,
  type FaqItem,
} from './CourseLanding';

import logo from '@/assets/landing/mix/logo.png';
import instructor from '@/assets/landing/mix/instructor.jpg';
import dep1 from '@/assets/landing/mix/dep-1.jpg';
import dep2 from '@/assets/landing/mix/dep-2.jpg';
import dep3 from '@/assets/landing/mix/dep-3.jpg';
import bonusFilmes from '@/assets/landing/mix/bonus-filmes.jpg';
import bonusHarmonizacao from '@/assets/landing/mix/bonus-harmonizacao.jpg';
import bonusBitter from '@/assets/landing/mix/bonus-bitter.jpg';
import bonusFatWash from '@/assets/landing/mix/bonus-fatwash.jpg';

// Paleta: roxo + azul (cores do logotipo Mixologia Avançada)
const theme: CourseTheme = {
  primary: '#7c3aed',     // roxo do logo
  secondary: '#2563eb',   // azul do logo
  accent: '#06b6d4',      // azul piscina (cyan vivo)
  glow1: 'rgba(124, 58, 237, 0.55)',
  glow2: 'rgba(37, 99, 235, 0.55)',
  glow3: 'rgba(6, 182, 212, 0.30)',
};

const learnItems: LearnItem[] = [
  { icon: BookOpen, title: 'História da coquetelaria', description: 'Da lei seca à coquetelaria molecular: entenda a evolução do mundo dos drinks.' },
  { icon: Beaker, title: 'Técnicas avançadas', description: 'Infusão, óleo saccharum, clarificação, fat wash, shrubs e pré-batched.' },
  { icon: Wine, title: 'Família de coquetéis', description: 'Punch, Cobbler, Collins, Crusta, Daisy, Sour, Highball, Julep, Martini e mais.' },
  { icon: GlassWater, title: 'Técnicas de manipulação', description: 'Free pour, batidos, mexidos, montados, throwing e rolling.' },
  { icon: Sparkles, title: 'Utensílios profissionais', description: 'Conheça e domine cada utensílio do bar como um verdadeiro mixologista.' },
  { icon: TrendingUp, title: 'Carreira de bar', description: 'Barback, bartender, chefe de bar, gestor de bar, mixologista e consultoria.' },
  { icon: Users, title: 'Hospitalidade e atendimento', description: 'Postura, contato visual, vestuário e discrição para um serviço impecável.' },
  { icon: Award, title: 'Mise en place e serviços', description: 'Montagem, organização, higiene e limpeza no padrão dos melhores bares.' },
  { icon: Trophy, title: 'Bônus de precificação', description: 'Aprenda a precificar drinks e aumentar o faturamento do seu bar em até 70%.' },
];

const modules: ModuleItem[] = [
  { number: '01', title: 'Introdução', topics: ['Apresentação', 'Sobre o curso'] },
  { number: '02', title: 'História da coquetelaria', topics: ['A história da coquetelaria', 'História americana', 'Lei seca americana', 'Coquetelaria Tiki', 'Anos 50 a 70', 'Coquetelaria contemporânea', 'Coquetelaria molecular'] },
  { number: '03', title: 'Utensílios de bar', topics: ['Utensílios de bar e seus usos'] },
  { number: '04', title: 'Serviços', topics: ['Montagem', 'Organização', 'Higiene e limpeza', 'Mise en place'] },
  { number: '05', title: 'Técnicas de manipulação', topics: ['Free pour', 'Coquetéis batidos', 'Coquetéis mexidos', 'Coquetéis montados', 'Coquetelaria Tiki', 'Throwing e rolling'] },
  { number: '06', title: 'Técnicas de produção', topics: ['Infusão', 'Óleo saccharum', 'Clarificação', 'Fat wash', 'Shrubs', 'Pré-batched'] },
  { number: '07', title: 'Família de coquetéis', topics: ['Punch', 'Cobbler', 'Collins', 'Crusta', 'Daisy', 'Sour 1 e 2', 'Nog', 'Highball', 'Julep', 'Smash', 'Martini Cocktail', 'Mule e Buck'] },
  { number: '08', title: 'Carreira de bar', topics: ['Barback', 'Bartender', 'Chefe de bar', 'Gestor de bar', 'Mixologista', 'Consultoria de bar', 'Bônus de precificação'] },
  { number: '09', title: 'Hospitalidade e atendimento', topics: ['Serviço e atendimento', 'Atendimento', 'Postura', 'Contato visual', 'Vestuário', 'Discrição'] },
];

const profiles: ProfileItem[] = [
  { icon: PartyPopper, title: 'Hobbie / Lazer', description: 'Para você que quer aproveitar melhor com amigos e familiares e proporcionar momentos especiais com drinks de alto nível.' },
  { icon: Briefcase, title: 'Empresário(a)', description: 'Para você que é dono de bar, restaurante ou quiosque e quer aumentar o faturamento através dos drinks.' },
  { icon: Trophy, title: 'Bartender', description: 'Para você que já é bartender profissional ou quer seguir carreira e aprimorar suas técnicas.' },
];

const bonus: BonusItem[] = [
  { title: 'Clube dos Drinkeros', description: 'Acesso de 1 ano ao app com mais de 1.000 receitas para pesquisar e salvar nos seus favoritos.', originalPrice: 'R$ 247,00' },
  { title: '40 receitas de xaropes artesanais', description: 'Eleve o nível dos seus drinks com xaropes artesanais que dão identidade às suas receitas.', originalPrice: 'R$ 97,00' },
  { title: 'Filmes & seriados', description: 'Encontre vivências e inspirações através de filmes, livros e seriados sobre o mundo da coquetelaria.', originalPrice: 'R$ 57,00' },
  { title: 'Harmonização entre comida e drinks', description: 'Entenda com o que cada drink será servido para se destacar na hora de elaborar a carta.', originalPrice: 'R$ 87,00' },
  { title: 'Bitter artesanal', description: 'Receita exclusiva de bitter para economizar e elevar o nível dos seus coquetéis com mais valor agregado.', originalPrice: 'R$ 57,00' },
  { title: '3 receitas de fat washes', description: 'Whisky com bacon, rum com óleo de coco e tequila com azeite — três receitas exclusivas e inovadoras.', originalPrice: 'R$ 67,00' },
];

const faq: FaqItem[] = [
  { q: 'Não sou profissional, esse curso é pra mim?', a: 'Se você curte drinks por hobby, esse curso eleva o nível dos seus drinks e impressiona amigos e familiares. Mas lembrando que ele também aborda carreira de bar.' },
  { q: 'Quanto tempo terei acesso ao curso?', a: 'O acesso é de 1 ano, ou seja, você terá direito a todos os vídeos do Mixologia Avançada durante 365 dias.' },
  { q: 'Como recebo o acesso ao curso?', a: 'Após a aprovação do pagamento, você receberá os dados de acesso automaticamente no e-mail cadastrado. Verifique também a caixa de spam.' },
  { q: 'O pagamento é seguro?', a: 'Sim. Utilizamos o Stripe, uma das maiores plataformas de pagamento do mundo.' },
  { q: 'Em quanto tempo recupero o investimento?', a: 'A partir do momento que termina o curso, você já está apto a aplicar o conhecimento, buscar promoção no seu estabelecimento ou novos clientes.' },
  { q: 'Já sou bartender, esse curso é pra mim?', a: 'Perfeito pra você! São mais de 20 anos de carreira do Tom Oliveira compactados em um único curso.' },
  { q: 'Como é a garantia?', a: 'Garantia incondicional de 15 dias. Se não ficar satisfeito, basta enviar um e-mail e devolvemos 100% do valor.' },
  { q: 'Como assisto às aulas?', a: 'Por qualquer dispositivo com internet: tablet, celular, desktop, notebook, Smart TV, Xbox, Playstation e mais.' },
  { q: 'Ainda tenho dúvida, o que faço?', a: 'Fale com nossa equipe pelo WhatsApp ou pelo e-mail suporte@drinkeros.com.br.' },
];

const MixologiaAvancada: React.FC = () => (
  <CourseLanding
    slug="mixologia-avancada"
    brand="Mixologia Avançada"
    logoSrc={logo}
    instructorSrc={instructor}
    instructorName="Tom Oliveira"
    heroVideoUrl="https://www.youtube.com/embed/QFvnDgPX9jc?rel=0&playsinline=1"
    heroBadge="Com Tom Oliveira · 20+ anos de experiência"
    tagline="Domine os segredos da mixologia e aumente em até 70% o faturamento do seu bar."
    subheadline="Aprenda técnicas avançadas, famílias de coquetéis, produção e hospitalidade com quem já conquistou prêmios nacionais e formou milhares de profissionais."
    ctaHero="QUERO ELEVAR MEU NÍVEL"
    theme={theme}
    fallbackPrice={797}
    oldPriceLabel="De R$ 1.609,00"
    learnItems={learnItems}
    whatYouLearnTitle="O que você vai dominar"
    modules={modules}
    profiles={profiles}
    bonusTitle="6 BÔNUS exclusivos"
    bonus={bonus}
    testimonials={[{ src: dep1 }, { src: dep2 }, { src: dep3 }]}
    guaranteeDays={15}
    faq={faq}
  />
);

export default MixologiaAvancada;
