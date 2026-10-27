import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import QuizCheckout from "./QuizCheckout";
const m = vi.hoisted(() => ({
  quote: vi.fn(),
  call: vi.fn(),
  invoke: vi.fn(),
  ic: vi.fn(),
}));
vi.mock(
  "@/lib/quizOffer",
  () => ({
    fetchQuizQuote: m.quote,
    quizCall: m.call,
    quizOfferToken: () => "a".repeat(64),
    trackQuizOffer: vi.fn(),
  }),
);
vi.mock(
  "@/integrations/supabase/client",
  () => ({ supabase: { functions: { invoke: m.invoke } } }),
);
vi.mock("@/lib/metaPixel", () => ({ trackInitiateCheckout: m.ic }));
vi.mock("@mercadopago/sdk-react", () => ({
  initMercadoPago: vi.fn(),
  Payment: ({ onSubmit, initialization }: any) => (
    <button
      onClick={() =>
        onSubmit({
          formData: {
            payment_method_id: "pix",
            payer: { email: "teste@example.com" },
          },
        })}
    >
      Pagar {initialization.amount}
    </button>
  ),
}));
const quote = (price = 87) => ({
  session_id: "session",
  path: "casa",
  recommended: "clube",
  product: "clube",
  price,
  full_price: 97,
  active: price === 87,
  expires_at: new Date(Date.now() + 1200000).toISOString(),
  server_now: new Date().toISOString(),
  attribution: { utm_content: "original" },
});
const open = () =>
  render(
    <MemoryRouter initialEntries={["/checkout/club/clube-anual?quiz=1"]}>
      <Routes>
        <Route path="/checkout/:productType/:slug" element={<QuizCheckout />} />
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  m.quote.mockResolvedValue(quote());
  m.call.mockResolvedValue({ status: "none" });
  m.invoke.mockImplementation(async (name: string) =>
    name === "get-mp-public-key" ? { data: { publicKey: "TEST-key" } } : {
      data: {
        id: "mp-test",
        status: "pending",
        amount: 87,
        currency: "BRL",
        product_id: "club",
        product_name: "Clube",
      },
    }
  );
});
afterEach(cleanup);
describe("isolated quiz checkout", () => {
  it("submits the server quote and quiz token to Mercado Pago, with the existing InitiateCheckout helper", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Pagar 87" }));
    await waitFor(() =>
      expect(m.invoke).toHaveBeenCalledWith(
        "create-mp-payment",
        expect.objectContaining({
          body: expect.objectContaining({
            expected_amount: 87,
            quiz_offer_token: "a".repeat(64),
            product_type: "club",
            slug: "clube-anual",
          }),
        }),
      )
    );
    await waitFor(() => expect(m.ic).toHaveBeenCalledTimes(1));
  });
  it("stops before creating a charge if the offer expired while the form was open", async () => {
    m.quote.mockResolvedValueOnce(quote()).mockResolvedValue(quote(97));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Pagar 87" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O preço foi atualizado",
    );
    expect(m.invoke.mock.calls.filter(([name]) => name === "create-mp-payment"))
      .toHaveLength(0);
    expect(await screen.findByRole("button", { name: "Pagar 97" }))
      .toBeTruthy();
  });
  it("resumes an accepted pending payment without rendering another charge form", async () => {
    m.quote.mockResolvedValue(quote(97));
    m.call.mockResolvedValue({
      id: "mp-existing",
      status: "pending",
      amount: 87,
      pix: { qr_code: "pix-existing" },
    });
    open();
    expect(await screen.findByLabelText("Código Pix")).toHaveValue(
      "pix-existing",
    );
    expect(screen.getByText(/R\$\s*87,00/)).toBeTruthy();
    expect(screen.queryByText(/R\$\s*97,00/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Pagar/ })).toBeNull();
    expect(m.invoke.mock.calls.filter(([name]) => name === "create-mp-payment"))
      .toHaveLength(0);
  });
});
