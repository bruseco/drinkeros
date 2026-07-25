import React from 'react';
import {
  Briefcase,
  FileText,
  TrendingUp,
  Users,
  Calendar,
  Megaphone,
  Package,
  ClipboardList,
  PartyPopper,
  HandshakeIcon,
  DollarSign,
  Camera,
  Wine,
  Trophy,
} from 'lucide-react';
import CourseLanding, {
  type CourseTheme,
  type LearnItem,
  type ModuleItem,
  type ProfileItem,
  type BonusItem,
  type FaqItem,
} from './CourseLanding';

import logo from '@/assets/landing/bar/logo.png';
import instructor from '@/assets/landing/bar/instructor.jpg';
import henriqueAbout from '@/assets/landing/bar/henrique-about.png.asset.json';
import dep1 from '@/assets/landing/bar/dep-1.png';
import dep2 from '@/assets/landing/bar/dep-2.png';
import dep3 from '@/assets/landing/bar/dep-3.png';
import heroVideo from '@/assets/landing/bar/intro.mp4';
import learn1 from '@/assets/landing/bar/learn-1-empresa.jpg';
import learn2 from '@/assets/landing/bar/learn-2-captacao.jpg';
import learn3 from '@/assets/landing/bar/learn-3-contratos.jpg';
import learn4 from '@/assets/landing/bar/learn-4-cardapio.jpg';
import learn5 from '@/assets/landing/bar/learn-5-insumos.jpg';
import learn6 from '@/assets/landing/bar/learn-6-equipe.jpg';
import learn7 from '@/assets/landing/bar/learn-7-vendas.jpg';
import learn8 from '@/assets/landing/bar/learn-8-estoque.jpg';
import learn9 from '@/assets/landing/bar/learn-9-posvenda.jpg';

// Paleta: salmão + pink (vibrante, eventos)
const theme: CourseTheme = {
  primary: '#fb7185',    // pink/rose
  secondary: '#fda4af',  // salmão claro
  accent: '#f9a8d4',     // pink suave
  glow1: 'rgba(251, 113, 133, 0.55)',
  glow2: 'rgba(253, 164, 175, 0.45)',
  glow3: 'rgba(249, 168, 212, 0.30)',
};

const learnItems: LearnItem[] = [
  { icon: Briefcase, imageSrc: learn1, title: 'Monte sua empresa do zero', description: 'O passo a passo completo para abrir seu bar para eventos a partir da sua casa.' },
  { icon: Megaphone, imageSrc: learn2, title: 'Captação de clientes', description: 'Estratégias práticas para encontrar clientes e fechar parcerias.' },
  { icon: FileText, imageSrc: learn3, title: 'Modelos de contratos', description: 'Receba modelos de contrato e proposta prontos para usar no seu dia a dia.' },
  { icon: Wine, imageSrc: learn4, title: 'Cardápio de eventos', description: 'Modelo de cardápio com os melhores drinks para servir em eventos.' },
  { icon: ClipboardList, imageSrc: learn5, title: 'Cálculo de insumos', description: 'Calcule bebidas e ingredientes na medida certa para cada evento.' },
  { icon: Users, imageSrc: learn6, title: 'Gestão de equipe', description: 'Como selecionar, treinar e coordenar seu time para entregar serviço de alto nível.' },
  { icon: TrendingUp, imageSrc: learn7, title: 'Técnicas de venda', description: 'Aprenda a apresentar seu trabalho e fechar contratos com mais valor.' },
  { icon: Package, imageSrc: learn8, title: 'Organização e estoque', description: 'Como montar um estoque eficiente em casa e otimizar a logística.' },
  { icon: HandshakeIcon, imageSrc: learn9, title: 'Pós-venda', description: 'Fidelize clientes e crie um fluxo recorrente de eventos.' },
];

const modules: ModuleItem[] = [
  { number: '01', title: 'Introdução', topics: ['Boas-vindas', 'Como aproveitar o curso', 'Mindset empreendedor'] },
  { number: '02', title: 'Tipos de eventos', topics: ['Casamentos', 'Aniversários', 'Corporativos', 'Confraternizações', 'Eventos premium'] },
  { number: '03', title: 'Montando cardápios e o orçamento', topics: ['Estrutura de cardápio', 'Precificação por hora', 'Pacotes premium', 'Drinks autorais'] },
  { number: '04', title: 'Técnica de vendas', topics: ['Abordagem do cliente', 'Quebra de objeções', 'Apresentação da proposta', 'Negociação'] },
  { number: '05', title: 'Organizando uma degustação', topics: ['Estrutura', 'Apresentação dos drinks', 'Conversão em fechamento'] },
  { number: '06', title: 'Fechamento de contrato', topics: ['Modelos de contrato', 'Cláusulas essenciais', 'Sinal e pagamento'] },
  { number: '07', title: 'Selecionando equipe', topics: ['Perfil ideal', 'Treinamento', 'Remuneração', 'Fidelização'] },
  { number: '08', title: 'Programação da semana do evento', topics: ['Checklist completo', 'Logística', 'Cronograma do dia'] },
  { number: '09', title: 'Montando um estoque em casa', topics: ['Estrutura física', 'Organização', 'Controle de validade'] },
  { number: '10', title: 'Evento na prática', topics: ['Setup do bar', 'Atendimento', 'Resolução de imprevistos'] },
  { number: '11', title: 'Pós-venda', topics: ['Acompanhamento', 'Pedido de indicações', 'Recontratação'] },
];

const profiles: ProfileItem[] = [
  { icon: Briefcase, title: 'Empreendedor', description: 'Para você com espírito empreendedor que quer começar um novo negócio no mundo dos drinks.' },
  { icon: Trophy, title: 'Bartender', description: 'Para o bartender que quer se aventurar nos negócios e conquistar independência financeira sem largar o emprego atual.' },
  { icon: PartyPopper, title: 'Drinkero(a)', description: 'Para você que curte fazer drinks por diversão e quer criar uma renda extra que pode mudar sua vida.' },
];

const bonus: BonusItem[] = [
  { title: 'Clube dos Drinkeros', description: 'Acesso de 1 ano ao app Drinkeros com mais de 1.000 receitas para consultar a qualquer momento.', originalPrice: 'R$ 247,00' },
  { title: 'Tráfego online', description: 'Aula bônus com o passo a passo para fazer anúncios online e divulgar sua empresa de eventos.', originalPrice: 'R$ 197,00' },
  { title: 'Fotografia com celular', description: 'Técnicas para fotografar drinks com seu próprio celular e gerar conteúdo profissional para redes sociais.', originalPrice: 'R$ 97,00' },
  { title: 'Cálculo de bebidas e insumos para eventos', description: 'Aula gravada da mentoria mostrando como calcular tudo que precisa para cada evento.', originalPrice: 'R$ 197,00' },
];

const faq: FaqItem[] = [
  { q: 'Não sou profissional, esse curso é pra mim?', a: 'Sim! Esse curso é para todos que querem empreender com drinks. Mesmo sem conhecimento prévio, você terá receitas como bônus e suporte para sanar dúvidas.' },
  { q: 'Quanto tempo terei acesso ao curso?', a: 'O acesso é de 1 ano, com direito a todos os vídeos durante 365 dias.' },
  { q: 'Como recebo o acesso?', a: 'Após a aprovação do pagamento, você recebe os dados automaticamente no e-mail cadastrado. Verifique também a caixa de spam.' },
  { q: 'O pagamento é seguro?', a: 'Sim. Utilizamos o Stripe, uma das maiores plataformas de pagamento do mundo.' },
  { q: 'Em quanto tempo recupero o investimento?', a: 'Com apenas um evento fechado você já pode recuperar o valor investido no curso.' },
  { q: 'Já sou bartender, esse curso é pra mim?', a: 'É perfeito! Você sai da posição de bartender para empresário, comandando sua própria equipe.' },
  { q: 'Como é a garantia?', a: 'Super Garantia Incondicional de 15 dias. Não gostou? Devolvemos 100% do valor pago.' },
  { q: 'Como assisto às aulas?', a: 'Por qualquer dispositivo com internet: tablet, celular, desktop, Smart TV e mais.' },
  { q: 'Ainda tenho dúvida, o que faço?', a: 'Fale com nossa equipe pelo WhatsApp ou pelo e-mail suporte@drinkeros.com.br.' },
];

const BarParaEventos: React.FC = () => (
  <CourseLanding
    slug="bar-p-eventos"
    brand="Bar para Eventos"
    logoSrc={logo}
    logoClassName="h-16 sm:h-24"
    logoWrapperClassName="mt-6 sm:mt-10 mb-8 sm:mb-12"
    instructorSrc={instructor}
    instructorName="Henrique Todeschini"
    heroBadge="Com Henrique Todeschini · La Mafia Drinkeros"
    tagline="Monte sua empresa de bar para eventos do zero, na sua casa, e comece a faturar alto."
    taglineClassName="bg-gradient-to-r from-[#fff3a8] via-[#ffd58a] to-[#ff9a8a] bg-clip-text text-transparent [text-shadow:_0_0_24px_rgba(255,180,140,0.35)] !mb-8"
    subheadline="O primeiro e único curso online do Brasil que ensina o passo a passo para abrir e escalar uma empresa de bar para eventos — investindo muito pouco."
    subheadlineBelowVideo
    heroVideoUrl={heroVideo}
    heroVideoAspect="square"
    ctaHero="QUERO EMPREENDER COM DRINKS"
    theme={theme}
    fallbackPrice={697}
    oldPriceLabel="De R$ 1.938,00"
    learnItems={learnItems}
    whatYouLearnTitle="Tudo o que você vai aprender"
    modules={modules}
    profiles={profiles}
    bonusTitle="4 BÔNUS exclusivos"
    bonus={bonus}
    testimonials={[{ src: dep1 }, { src: dep2 }, { src: dep3 }]}
    guaranteeDays={15}
    offerSummary="Monte e opere bar para eventos do zero: estrutura, equipe, cardápio, precificação e logística.
Aprenda a calcular consumo, montar kits e garantir margem alta em casamentos, corporativos e festas.
Para quem quer empreender em eventos ou profissionalizar a operação que já tem.
Acesso completo + bônus exclusivos + garantia incondicional."
    faq={faq}
  />
);

export default BarParaEventos;
