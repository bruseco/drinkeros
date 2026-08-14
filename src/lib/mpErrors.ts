// Mensagens amigáveis (pt-BR) para os status_detail de recusa do Mercado Pago.
const MAP: Record<string, string> = {
  cc_rejected_high_risk:
    "O banco/emissor recusou por segurança. Tente outro cartão ou pague com Pix (aprovação imediata).",
  cc_rejected_insufficient_amount: "Saldo ou limite insuficiente. Tente outro cartão ou pague com Pix.",
  cc_rejected_bad_filled_card_number: "Número do cartão inválido. Confira e tente novamente.",
  cc_rejected_bad_filled_date: "Data de validade inválida. Confira e tente novamente.",
  cc_rejected_bad_filled_security_code: "Código de segurança (CVV) inválido. Confira e tente novamente.",
  cc_rejected_bad_filled_other: "Algum dado do cartão está incorreto. Confira e tente novamente.",
  cc_rejected_call_for_authorize: "Seu banco precisa autorizar a compra. Ligue para o emissor ou use Pix.",
  cc_rejected_card_disabled: "Cartão desabilitado. Ative-o com o banco ou use outro cartão.",
  cc_rejected_duplicated_payment: "Você já fez um pagamento igual. Verifique antes de tentar de novo.",
  cc_rejected_max_attempts: "Muitas tentativas com este cartão. Use outro cartão ou pague com Pix.",
  cc_rejected_other_reason: "O emissor recusou o pagamento. Tente outro cartão ou pague com Pix.",
  cc_rejected_invalid_installments: "Esse número de parcelas não é aceito neste cartão.",
  cc_rejected_card_error: "Não foi possível processar o cartão. Tente novamente ou use Pix.",
  cc_rejected_blacklist: "Pagamento recusado pelo emissor. Tente outro cartão ou pague com Pix.",
};

export function mpRejectionMessage(statusDetail?: string | null): string {
  if (!statusDetail) return "Tente outro cartão ou pague com Pix.";
  return MAP[statusDetail] || "Tente outro cartão ou pague com Pix.";
}
