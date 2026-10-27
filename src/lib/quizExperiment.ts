export type QuizVariant = "a" | "b";
const KEY = "drinkeros:quiz-art:v1";
let memory: QuizVariant | null = null;
export function readQuizVariant(): QuizVariant | null {
  if (memory) return memory;
  for (const storage of [() => localStorage, () => sessionStorage]) {
    try {
      const value = storage().getItem(KEY);
      if (value === "a" || value === "b") return memory = value;
    } catch { /* storage may be blocked */ }
  }
  return null;
}
export function assignQuizVariant(): QuizVariant {
  const existing = readQuizVariant();
  if (existing) return existing;
  const value = crypto.getRandomValues(new Uint32Array(1))[0] < 0x80000000
    ? "a"
    : "b";
  memory = value;
  for (const storage of [() => localStorage, () => sessionStorage]) {
    try {
      storage().setItem(KEY, value);
    } catch { /* retain memory fallback */ }
  }
  return value;
}
export function quizExperimentMetadata() {
  const variant = readQuizVariant();
  return variant
    ? { quiz_experiment: "quiz-art-v1", quiz_variant: variant }
    : {};
}
