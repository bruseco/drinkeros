import React from 'react';
import {
  Truck,
  Package,
  ShieldCheck,
  Tag,
  Sparkles,
  ClipboardList,
  Smartphone,
  Beaker,
  Briefcase,
  PartyPopper,
  Trophy,
  DollarSign,
} from 'lucide-react';
import CourseLanding, {
  type CourseTheme,
  type LearnItem,
  type ModuleItem,
  type ProfileItem,
  type BonusItem,
  type FaqItem,
} from './CourseLanding';

import logo from '@/assets/landing/delivery/logo.png';
import instructor from '@/assets/landing/delivery/instructor.jpg';
import dep1 from '@/assets/landing/delivery/dep-1.jpg';
import dep2 from '@/assets/landing/delivery/dep-2.jpg';
import dep3 from '@/assets/landing/delivery/dep-3.jpg';

// Paleta: rosa choque + roxo (do logotipo Drink Delivery)
const theme: CourseTheme = {
  primary: '#ec4899',
  secondary: '#a855f7',
  accent: '#f0abfc',
  glow1: 'rgba(236, 72, 153, 0.55)',
  glow2: 'rgba(168, 85, 247, 0.55)',
  glow3: 'rgba(240, 171, 252, 0.30)',
};

const learnItems: LearnItem[] = [
  { icon: Beaker, title: 'Engarrafamento perfeito', description: 'Higienização, vedação, durabilidade e armazenamento dos seus drinks engarrafados.' },
  { icon: ClipboardList, title: 'Legislação e higiene', description: 'Tudo que você precisa saber para vender drinks engarrafados de forma legal e segura.' },
  { icon: Package, title: 'Tipos de embalagem', description: 'Conheça os tipos de embalagens, validade e armazenamento ideal para cada drink.' },
  { icon: Tag, title: 'Identidade visual', description: 'Crie rótulos, escolha embalagens e construa uma marca que valoriza seu produto.' },
  { icon: DollarSign, title: 'Custo e precificação', description: 'Calcule o custo real de produção e defina preços lucrativos para o delivery.' },
  { icon: Truck, title: 'Transporte e logística', description: 'Como entregar seus drinks com qualidade, sem comprometer o sabor ou a vedação.' },
  { icon: Sparkles, title: 'Técnicas de venda', description: 'Estratégias para conquistar e fidelizar clientes no delivery.' },
  { icon: Smartphone, title: 'Aplicativos de entrega', description: 'Como usar iFood e outras plataformas para vender mais drinks engarrafados.' },
  { icon: PartyPopper, title: 'Experiência do cliente', description: 'Surpreenda quem recebe seu drink em casa e gere recompra recorrente.' },
];

const modules: ModuleItem[] = [
  { number: '01', title: 'Introdução', topics: ['Sobre o curso', 'Oportunidade', 'Legislação', 'Higiene', 'Público-alvo', 'Tipos de embalagem', 'Vedação', 'Validade', 'Armazenamento', 'Estilo de drinks'] },
  { number: '02', title: 'Teoria na prática', topics: ['Higienização de garrafas', 'Negroni engarrafado', 'Vedação na prática', 'Ingredientes perecíveis', 'Durabilidade', 'Armazenamento', 'Custo de produção', 'Engarrafando drinks para viagem', 'Classificando drinks engarrafados'] },
  { number: '03', title: 'Identidade visual', topics: ['Rótulo', 'Tipos de embalagem', 'Construindo uma marca', 'Validação de produção'] },
  { number: '04', title: 'Delivery', topics: ['Transporte e logística', 'Técnicas de venda', 'Experiência do cliente', 'Aplicativo de entrega'] },
];

const profiles: ProfileItem[] = [
  { icon: Briefcase, title: 'Empreendedor', description: 'Para você que quer criar um negócio escalável de drinks engarrafados a partir da sua casa.' },
  { icon: Trophy, title: 'Bartender', description: 'Para o bartender que quer multiplicar seu faturamento com uma fonte de renda recorrente.' },
  { icon: PartyPopper, title: 'Drinkero(a)', description: 'Para você que faz drinks por hobby e quer transformar a paixão em uma renda extra.' },
];

const bonus: BonusItem[] = [
  { title: 'E-book: Sucesso no iFood', description: 'O guia completo para alcançar o sucesso dentro do iFood, testado por inúmeros restaurantes.', originalPrice: 'R$ 97,00' },
];

const faq: FaqItem[] = [
  { q: 'Não tenho experiência, posso fazer?', a: 'Sim. O curso começa do absoluto zero, com legislação, higiene e técnicas práticas para você começar com segurança.' },
  { q: 'Quanto tempo terei acesso?', a: 'O acesso é de 1 ano, com direito a todos os vídeos durante 365 dias.' },
  { q: 'Como recebo o acesso?', a: 'Após a aprovação do pagamento, você recebe os dados automaticamente no e-mail cadastrado. Verifique também o spam.' },
  { q: 'O pagamento é seguro?', a: 'Sim. Utilizamos o Stripe, uma das maiores plataformas de pagamento do mundo.' },
  { q: 'Em quanto tempo recupero o investimento?', a: 'Com poucas vendas no delivery você já recupera o valor — drinks engarrafados têm margem alta.' },
  { q: 'Preciso ter CNPJ?', a: 'Abordamos a parte de legislação no curso e indicamos o melhor caminho para regularizar seu negócio.' },
  { q: 'Como é a garantia?', a: 'Garantia incondicional de 15 dias. Não gostou? Devolvemos 100% do valor.' },
  { q: 'Como assisto às aulas?', a: 'Por qualquer dispositivo com internet: tablet, celular, desktop, Smart TV e mais.' },
  { q: 'Ainda tenho dúvida, o que faço?', a: 'Fale com nossa equipe pelo WhatsApp ou pelo e-mail suporte@drinkeros.com.br.' },
];

const DrinkDeliveryEngarrafados: React.FC = () => (
  <CourseLanding
    slug="drinkdelivery-engarrafados"
    brand="Drink Delivery & Engarrafados"
    logoSrc={logo}
    instructorSrc={instructor}
    instructorName="Tom Oliveira"
    heroBadge="Com Tom Oliveira"
    tagline="Aprenda a engarrafar seus drinks, venda no delivery e ganhe uma renda extra."
    taglineClassName="text-[#00e4ff] !mb-8 sm:!mb-10"
    subheadline="Higiene, vedação, validade, identidade visual, precificação e logística — tudo o que você precisa para transformar drinks em uma fonte de renda escalável."
    subheadlineBelowVideo
    heroVideoUrl="/landing/drinkdelivery.mp4"
    heroVideoAspect="square"
    ctaHero="QUERO ADQUIRIR ESSE CURSO"
    theme={theme}
    fallbackPrice={397}
    oldPriceLabel="De R$ 694,00"
    learnItems={learnItems}
    whatYouLearnTitle="O que você vai aprender"
    modules={modules}
    profiles={profiles}
    bonusTitle="Super BÔNUS exclusivo"
    bonus={bonus}
    testimonials={[{ src: dep1 }, { src: dep2 }, { src: dep3 }]}
    guaranteeDays={15}
    aboutInstructor={{
      name: 'Tom Oliveira',
      photoSrc: instructor,
      title: 'Quem é Tom Oliveira?',
      paragraphs: [
        'Natural de São Paulo, trabalha com coquetelaria desde 2005, tendo passado por alguns dos principais bares de São Paulo.',
        'Participou de concursos de coquetelaria, sendo vice-campeão por duas vezes na etapa nacional do Gin Bombay e campeão nacional do Bacardi Legacy em 2018.',
        'Residindo em Florianópolis desde 2017, hoje presta serviços de consultoria e mentoria pela Gipsy Cocktails.',
      ],
    }}
    offerSummary="Crie seu próprio negócio de drinks engarrafados para delivery, com receitas estáveis e alto giro.
Aprenda formulação, conservação, rotulagem, precificação e canais de venda (iFood, Instagram, WhatsApp).
Para quem quer faturar com drinks sem precisar de ponto físico ou equipe grande.
Acesso completo + bônus exclusivos + garantia incondicional."
    faq={faq}
  />
);

export default DrinkDeliveryEngarrafados;
