import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import QuizOfferMetrics from "./QuizOfferMetrics";
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: any) => ({
    data: queryKey[0] === "quiz-offer-metrics"
      ? [{
        variant: "a",
        path: "casa",
        product: "pack",
        event: "quiz_purchase",
        count: 1,
      }, {
        variant: "b",
        path: "casa",
        product: "pack",
        event: "quiz_purchase",
        count: 2,
      }]
      : [],
    isSuccess: true,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock(
  "@/integrations/supabase/client",
  () => ({ supabase: { rpc: vi.fn() } }),
);
afterEach(cleanup);
it("keeps A/B comparison and destination detail together, with a working variant filter", () => {
  render(<QuizOfferMetrics range="30d" dates={{ from: "", to: "" }} />);
  expect(screen.getByRole("region", { name: "Comparação das versões do quiz" }))
    .toBeInTheDocument();
  const select = screen.getByLabelText("Versão");
  fireEvent.change(select, { target: { value: "b" } });
  expect(select).toHaveValue("b");
  expect(screen.getByRole("link", { name: "/quiz-pack-ebooks" }))
    .toHaveAttribute("href", "/quiz-pack-ebooks");
});
