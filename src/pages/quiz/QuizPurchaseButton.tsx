import GuaranteeNote from "@/components/landing/GuaranteeNote";
import { createContext, useContext } from "react";
export const QuizPurchaseContext = createContext<
  { buy: () => Promise<void>; busy: boolean; available: boolean } | null
>(null);
export default function QuizPurchaseButton() {
  const purchase = useContext(QuizPurchaseContext);
  if (!purchase) return null;
  return (
    <div>
    <button
      type="button"
      className="quiz-offer-buy"
      onClick={purchase.buy}
      disabled={purchase.busy || !purchase.available}
    >
      {purchase.busy ? "Confirmando oferta…" : "Quero aproveitar esta oferta"}
    </button>
    <GuaranteeNote />
    </div>
  );
}
