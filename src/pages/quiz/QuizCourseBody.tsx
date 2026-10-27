import QuizPurchaseButton from "./QuizPurchaseButton";
import type { CourseLandingProps } from "../landing/CourseLanding";
export type {
  BonusItem,
  CourseTheme,
  FaqItem,
  LearnItem,
  ModuleItem,
  ProfileItem,
  TestimonialItem,
} from "../landing/CourseLanding";
/** Content-only renderer: no legacy pricing, checkout buttons, pixels or offer popups. */
export default function QuizCourseBody(p: CourseLandingProps) {
  return (
    <div className="quiz-offer-body">
      {p.instructorSrc && (
        <section className="quiz-teacher-intro">
          <img src={p.instructorSrc} alt={p.instructorName || "Professor do curso"} loading="lazy" />
          <div>
            <h2>Aprenda com {p.instructorName}</h2>
            <p>{p.aboutInstructor?.paragraphs[0] || "Conheça as técnicas e coloque o conteúdo do curso em prática, no seu ritmo."}</p>
          </div>
        </section>
      )}
      <section>
        <h2>{p.whatYouLearnTitle || "O que você vai aprender"}</h2>
        <div className="quiz-content-grid">
          {p.learnItems.map((item, i) => (
            <article key={i}>
              {item.imageSrc && (
                <img src={item.imageSrc} alt="" loading="lazy" />
              )}
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
      {p.slug === "drinkeros-xperience" && <QuizPurchaseButton />}
      {!!p.modules?.length && (
        <section>
          <h2>Conteúdo do curso</h2>
          {p.modules.map((m) => (
            <details key={m.number}>
              <summary>{m.number} · {m.title}</summary>
              <ul>{m.topics.map((t) => <li key={t}>{t}</li>)}</ul>
            </details>
          ))}
        </section>
      )}
      {!!p.profiles?.length && (
        <section>
          <h2>Para quem é este curso?</h2>
          {p.profiles.map((x) => (
            <article key={x.title}>
              <h3 className="quiz-profile-title">
                <x.icon aria-hidden="true" />
                {x.title}
              </h3>
              <p>{x.description}</p>
            </article>
          ))}
        </section>
      )}
      {!!p.bonus?.length && (
        <section>
          <h2>{p.bonusTitle || "Bônus incluídos"}</h2>
          <div className="quiz-content-grid">
            {p.bonus.map((x) => (
              <article key={x.title}>
                {x.imageSrc && <img src={x.imageSrc} alt="" loading="lazy" />}
                <h3>{x.title}</h3>
                <p>{x.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      {p.slug === "drinkeros-xperience" && <QuizPurchaseButton />}
      {!!p.testimonials?.length && (
        <section>
          <h2>Depoimentos de alunos</h2>
          <div className="quiz-content-grid">
            {p.testimonials.map((x, i) => (
              <img
                key={i}
                src={x.src}
                alt={x.alt || "Depoimento de aluno"}
                loading="lazy"
              />
            ))}
          </div>
        </section>
      )}
      {p.aboutInstructor && (
        <section>
          <h2>{p.aboutInstructor.title || p.aboutInstructor.name}</h2>
          <img
            className="quiz-instructor"
            src={p.aboutInstructor.photoSrc}
            alt={p.aboutInstructor.name}
            loading="lazy"
          />
          {p.aboutInstructor.paragraphs.map((t) => <p key={t}>{t}</p>)}
        </section>
      )}
      <section>
        <h2>Garantia de {p.guaranteeDays || 15} dias</h2>
        <p>
          {p.guaranteeText ||
            "Experimente o conteúdo. Se não for para você, solicite o reembolso dentro do prazo de garantia."}
        </p>
      </section>
      {p.slug === "drinkeros-xperience" && <QuizPurchaseButton />}
      <section>
        <h2>Perguntas frequentes</h2>
        {p.faq.map((x) => (
          <details key={x.q}>
            <summary>{x.q}</summary>
            <p>
              {/pagamento.*seguro|pagamento realmente/i.test(x.q)
                ? "O pagamento é processado pelo Mercado Pago, por cartão ou Pix."
                : x.a}
            </p>
          </details>
        ))}
      </section>
    </div>
  );
}
