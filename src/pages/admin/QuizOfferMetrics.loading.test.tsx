import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import QuizOfferMetrics from "./QuizOfferMetrics";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
function setup(range: "7d" | "30d" = "30d") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const ui = () => (
    <QueryClientProvider client={client}>
      <QuizOfferMetrics range={range} dates={{ from: "", to: "" }} />
    </QueryClientProvider>
  );
  return { ...render(ui()), ui, client };
}
it.each(["7d", "30d"] as const)(
  "settles %s queries and keeps the same cache after rerendering at a later time",
  async (range) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    rpc.mockImplementation(async (name: string) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        data: name === "quiz_admin_experiment"
          ? [{
            variant: "a",
            path: "casa",
            product: "pack",
            event: "pageview",
            count: 149,
          }]
          : [{ question: "q1", answer: "A", path: "casa", count: 35 }],
        error: null,
      } as any;
    });
    const view = setup(range);
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Comparação das versões do quiz" }),
      ).toHaveTextContent("149")
    );
    const calls = rpc.mock.calls.length;
    vi.setSystemTime(new Date("2026-10-30T12:01:00Z"));
    view.rerender(view.ui());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(calls).toBe(2);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("region", { name: "Comparação das versões do quiz" }),
    ).toHaveTextContent("149");
  },
);
it("does not display zero-filled A/B cards or answers while requests are pending", async () => {
  rpc.mockImplementation(() => new Promise(() => {}));
  setup();
  expect(
    screen.queryByRole("region", { name: "Comparação das versões do quiz" }),
  ).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Carregando respostas");
  expect(screen.queryByText("O que você quer com os drinks?")).toBeNull();
});
