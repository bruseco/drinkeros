import QuizCourseBody from "../QuizCourseBody";
import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  CheckCircle2,
  Crown,
  Loader2,
  MessageCircle,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserPlan } from "@/hooks/useUserPlan";
import { useCourseBySlug } from "@/hooks/useCourses";
import { applyVipDiscountFor, formatBRL } from "@/lib/vipDiscount";
import { useVipDiscount } from "@/hooks/useVipDiscount";
import { VipDiscountCountdownBanner } from "@/components/user/VipDiscountCountdownBanner";
import AnimatedStudentCount from "@/components/landing/AnimatedStudentCount";
import VipFloatingBanner from "@/components/landing/VipFloatingBanner";
import {
  TOTAL_STUDENTS_FALLBACK,
  useTotalStudents,
} from "@/hooks/useTotalStudents";

// Imagens
import logo from "@/assets/landing/dx/logo.png";
import drinkerosFooterLogo from "@/assets/logotipo-drinkeros.png";
import brunoHero from "@/assets/landing/dx/bruno-hero.png";
import garantia from "@/assets/landing/dx/garantia-15dias.png";
import pagamentos from "@/assets/landing/dx/pagamentos.png";

import learn1 from "@/assets/landing/dx/learn-1.jpg";
import learn2 from "@/assets/landing/dx/learn-2.jpg";
import learn3 from "@/assets/landing/dx/learn-3.jpg";
import learn4 from "@/assets/landing/dx/learn-4.jpg";
import learn5 from "@/assets/landing/dx/learn-5.jpg";
import learn6 from "@/assets/landing/dx/learn-6.jpg";
import learn7 from "@/assets/landing/dx/learn-7.jpg";
import learn8 from "@/assets/landing/dx/learn-8.jpg";
import learn9 from "@/assets/landing/dx/learn-9.jpg";

import dep1 from "@/assets/landing/dx/dep-1.jpg";
import dep2 from "@/assets/landing/dx/dep-2.jpg";
import dep3 from "@/assets/landing/dx/dep-3.jpg";
import dep4 from "@/assets/landing/dx/dep-4.jpg";

import perfilHobbie from "@/assets/landing/dx/perfil-hobbie.jpg";
import perfilBartender from "@/assets/landing/dx/perfil-bartender.jpg";
import perfilEmpresario from "@/assets/landing/dx/perfil-empresario.jpg";

import bonusNew1 from "@/assets/landing/dx/bonus-new-1.jpg";
import bonusNew2 from "@/assets/landing/dx/bonus-new-2.jpg";
import bonusNew3 from "@/assets/landing/dx/bonus-new-3.jpg";
import bonusNew4 from "@/assets/landing/dx/bonus-new-4.jpg";

const SLUG = "drinkeros-xperience";

const learnItems = [
  {
    img: learn1,
    html:
      "Aprenda <strong>AS PROPORÇÕES MÁGICAS</strong> que vão te permitir criar infinitas receitas, assim como fazemos diariamente em nossas redes sociais.",
  },
  {
    img: learn2,
    html:
      "Aprenda todos os segredinhos para fazer <strong>A CAIPIRINHA PERFEITA</strong>. Aprenda também a fazer as <strong>CAIPIFRUTAS</strong> e as <strong>CAIPIRINHAS GOURMETS</strong>.",
  },
  {
    img: learn3,
    html:
      "Vou te ensinar sobre os <strong>DRINKS CLÁSSICOS</strong> mais famosos do mundo. Você aprenderá suas proporções e como criar variações incríveis deles.",
  },
  {
    img: learn4,
    html:
      "Saiba <strong>TUDO SOBRE UTENSÍLIOS</strong> da coquetelaria. Vou apresentar cada um deles e também vou lhe ensinar como manuseá-los.",
  },
  {
    img: learn5,
    html:
      "Descubra quais são os <strong>INGREDIENTES QUE NÃO PODEM FALTAR</strong> na sua casa. Aprenda alguns <strong>XAROPES CASEIROS</strong> e entenda tudo sobre os <strong>TIPOS DE GELO</strong>.",
  },
  {
    img: learn6,
    html:
      "Você vai entender tudo sobre as <strong>TAÇAS E COPOS</strong>, para que serve cada uma delas e qual ocasião você deve fazer cada tipo de drink.",
  },
  {
    img: learn7,
    html:
      "Vou também te ensinar os métodos para você fazer as <strong>BATIDAS, FROZENS e DRINKS EM CAMADAS</strong>.",
  },
  {
    img: learn8,
    html:
      "Vou te ensinar como aumentar as proporções dos drinks para fazer <strong>DRINKS EM JARRAS E SUQUEIRAS</strong>.",
  },
  {
    img: learn9,
    html:
      "Comemore em grande estilo com seus amigos e familiares dominando a arte de fazer <strong>SHOTS</strong>.",
  },
];

const perfilItems = [
  {
    img: perfilHobbie,
    title: "Hobbie/Lazer",
    desc:
      "Para você que quer aproveitar melhor com amigos e familiares proporcionando momentos especiais, unir pessoas, trazer alegria e momentos de distração.",
  },
  {
    img: perfilBartender,
    title: "Bartender",
    desc:
      "Para você que já é bartender profissional ou quer seguir carreira e aprimorar seus conhecimentos.",
  },
  {
    img: perfilEmpresario,
    title: "Empresário(a)",
    desc:
      "Para você que é dono de um bar, restaurante, quiosque ou balada e quer capacitar melhor sua equipe e aprender esta nova habilidade lucrativa.",
  },
];

const bonusItems = [
  {
    img: bonusNew1,
    title: "BÔNUS 1 — DRINKS SEM ÁLCOOL",
    desc:
      "Aula divertida com o método para criar qualquer drink sem álcool, sem precisar ficar pesquisando receitas na internet.",
  },
  {
    img: bonusNew2,
    title: "BÔNUS 2 — DECORAÇÕES",
    desc:
      "Aula especial com tudo que você precisa saber sobre decorações: técnicas e estilos para deixar seus drinks visualmente incríveis.",
  },
  {
    img: bonusNew3,
    title: "BÔNUS 3 — FOTOGRAFIA DE DRINKS COM CELULAR",
    desc:
      "Aprenda a fotografar seus drinks usando apenas o seu celular, com técnicas que deixam suas fotos profissionais e prontas para as redes.",
  },
  {
    img: bonusNew4,
    title: "BÔNUS 4 — HORTINHA AUTOMATIZADA",
    desc:
      "Monte uma hortinha suspensa em casa com irrigação automatizada e tenha sempre ervas frescas à mão para criar drinks de outro nível.",
  },
];

const faqItems = [
  {
    q: "Não sou profissional, esse curso é pra mim?",
    a: "Se você curte drinks apenas por hobby, esse curso É PERFEITO PRA VOCÊ, inclusive 60% dos nossos alunos relataram que estão fazendo o curso por um Hobby que é quase uma terapia.",
  },
  {
    q: "Quanto tempo terei acesso ao curso?",
    a: "O acesso é de 1 ano, ou seja, você terá direito a todos os vídeos do Drinkeros Xperience durante 365 dias.",
  },
  {
    q: "Como recebo o acesso ao curso?",
    a: "Após a aprovação do pagamento, você receberá os dados de acesso automaticamente no e-mail cadastrado no ato da compra. Por isso, é importante que você cadastre um e-mail válido. Importante verificar também na caixa de spam.",
  },
  {
    q: "O pagamento realmente é seguro?",
    a: "Confiamos inteiramente na plataforma que utilizamos para receber o seu pagamento. Utilizamos o Stripe, uma das maiores plataformas de pagamento do mundo. Então sim, é muito seguro.",
  },
  {
    q: "Em quanto tempo consigo reaver meu investimento do curso?",
    a: "A partir do momento que um aluno termina o curso, ele já estará apto a botar todo o conhecimento em prática, podendo ir atrás de seus próprios clientes ou buscar uma promoção dentro do seu próprio estabelecimento.",
  },
  {
    q: "Sou menor de 18 anos, posso fazer o curso?",
    a: "O curso não é recomendado para menores de 18 anos. Caso seja menor, peça para seu responsável, pois também ensinamos drinks sem álcool.",
  },
  {
    q: "Como é essa garantia que você oferece?",
    a: "É muito simples: não queremos merecer o seu dinheiro se o treinamento não for impactante para você. Faça o programa, acesse tudo e se achar que não é bom para você ou que não era o que estava esperando, simplesmente mande um e-mail para nossa equipe e peça a devolução do seu dinheiro ainda dentro do prazo de garantia.",
  },
  {
    q: "Como assisto às aulas?",
    a: "As aulas poderão ser acessadas por qualquer dispositivo que tenha acesso à internet. Isso inclui tablet, celular, desktop, notebook, Smart TV, Xbox, Playstation e demais dispositivos.",
  },
  {
    q: "Já sou bartender profissional, esse curso é para mim?",
    a: "Se você é bartender profissional, ou trabalha em algum restaurante que serve drinks, tenho certeza que você vai atualizar suas habilidades e expandir sua criatividade.",
  },
  {
    q: "Ainda tenho dúvida, o que eu faço?",
    a: "Você pode fazer contato com a minha equipe através do e-mail: suporte@drinkeros.com.br",
  },
];

export default function QuizXperienceBody() {
  return (
    <QuizCourseBody
      slug={SLUG}
      brand="Drinkeros Xperience"
      tagline=""
      subheadline=""
      ctaHero=""
      fallbackPrice={497}
      theme={{
        primary: "#facc15",
        secondary: "#ec4899",
        accent: "#facc15",
        glow1: "",
        glow2: "",
        glow3: "",
      }}
      learnItems={learnItems.map((x, i) => ({
        title: `Aula ${i + 1}`,
        description: x.html.replace(/<[^>]*>/g, ""),
        imageSrc: x.img,
      }))}
      profiles={perfilItems.map((x) => ({
        title: x.title,
        description: x.desc,
        icon: Check,
      }))}
      bonus={bonusItems.map((x) => ({
        title: x.title,
        description: x.desc,
        imageSrc: x.img,
      }))}
      testimonials={[dep1, dep2, dep3, dep4].map((src) => ({ src }))}
      guaranteeDays={15}
      faq={faqItems}
    />
  );
}
