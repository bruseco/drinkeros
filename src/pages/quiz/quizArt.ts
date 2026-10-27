import type { AnswerKey, QuestionId } from "@/lib/quizLogic";
import art0 from "@/assets/quiz-art/curtir-em-casa.jpg";
import art1 from "@/assets/quiz-art/carreira-bartender.jpg";
import art2 from "@/assets/quiz-art/negocio-drinks.jpg";
import art3 from "@/assets/quiz-art/receitas-ocasionais.jpg";
import art4 from "@/assets/quiz-art/receitas-festas.jpg";
import art5 from "@/assets/quiz-art/criar-drinks.jpg";
import art6 from "@/assets/quiz-art/iniciante-bartender.jpg";
import art7 from "@/assets/quiz-art/freelas-eventos.jpg";
import art8 from "@/assets/quiz-art/crescer-profissao.jpg";
import art9 from "@/assets/quiz-art/navio-exterior.jpg";
import art10 from "@/assets/quiz-art/bar-eventos.jpg";
import art11 from "@/assets/quiz-art/delivery-engarrafados.jpg";
import art12 from "@/assets/quiz-art/escolher-negocio.jpg";
import art13 from "@/assets/quiz-art/produzir-em-casa.jpg";
import art14 from "@/assets/quiz-art/atender-na-festa.jpg";
export const QUIZ_ART: Record<QuestionId, Partial<Record<AnswerKey, string>>> =
  {
    q1: { A: art0, B: art1, C: art2 },
    q2_casa: { A: art3, B: art4, C: art5 },
    q2_profissional: { A: art6, B: art7, C: art8, D: art9 },
    q2_empreender: { A: art10, B: art11, C: art12 },
    q3: { A: art13, B: art14 },
  };
