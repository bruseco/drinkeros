/** Same illustrative annuity rule used on CourseLanding. The gateway provides the binding quote. */
export function quizInstallmentEstimate(price: number) {
  const rate = .0449, count = 12, power = (1 + rate) ** count;
  return price * rate * power / (power - 1);
}
