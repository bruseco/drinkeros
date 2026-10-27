import { expect, it } from "vitest";
import { QUESTIONS } from "./quizLogic";
import { QUIZ_ART } from "../pages/quiz/quizArt";
import { FUNNELS } from "./funnels";
it("provides a distinct illustration for every answer and only one quiz funnel card", () => {
  const images = Object.values(QUESTIONS).flatMap((q) =>
    q.options.map((o) => QUIZ_ART[q.id][o.key])
  );
  expect(images).toHaveLength(15);
  expect(images.every(Boolean)).toBe(true);
  expect(new Set(images).size).toBe(15);
  expect(FUNNELS.filter((f) => f.key === "quiz" || f.quizProduct)).toHaveLength(
    1,
  );
});
