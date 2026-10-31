/** A paid calendar month; replaying the same payment never moves its expiry. */
export function paidMonthlyPeriod(payment: { status?: string; date_approved?: string; transaction_amount?: number; currency_id?: string }) {
  if (payment.status !== 'approved' || Number(payment.transaction_amount) !== 7 || payment.currency_id !== 'BRL' || !payment.date_approved) throw Error('Invalid monthly payment');
  const start = new Date(payment.date_approved);
  if (!Number.isFinite(start.getTime())) throw Error('Invalid payment date');
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return {start, end};
}
