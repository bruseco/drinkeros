import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Check } from "lucide-react";
import QuizCourseBody from "./QuizCourseBody";
import { QuizPurchaseContext } from "./QuizPurchaseButton";
afterEach(cleanup);
it("routes all three Xperience section buttons through the existing purchase action", () => {
  const buy = vi.fn().mockResolvedValue(undefined);
  render(
    <QuizPurchaseContext.Provider value={{ buy, busy: false, available: true }}>
      <QuizCourseBody
        slug="drinkeros-xperience"
        brand="Xperience"
        tagline=""
        subheadline=""
        ctaHero=""
        fallbackPrice={497}
        theme={{
          primary: "",
          secondary: "",
          accent: "",
          glow1: "",
          glow2: "",
          glow3: "",
        }}
        learnItems={[{ title: "Módulo 1", description: "Conteúdo" }]}
        profiles={[{ title: "Hobby", description: "Perfil", icon: Check }]}
        bonus={[{ title: "Bônus", description: "Conteúdo" }]}
        guaranteeDays={15}
        faq={[]}
      />
    </QuizPurchaseContext.Provider>,
  );
  const buttons = screen.getAllByRole("button", {
    name: "Quero aproveitar esta oferta",
  });
  expect(buttons).toHaveLength(3);
  buttons.forEach((button) => fireEvent.click(button));
  expect(buy).toHaveBeenCalledTimes(3);
});
