import { beforeEach, expect, it, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  const storage = () => {
    const values = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      clear: () => values.clear(),
    };
  };
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
});
it("assigns both sides at the boundary and retains the choice across reloads", async () => {
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array: any) => {
    array[0] = 0x7fffffff;
    return array;
  });
  let m = await import("./quizExperiment");
  expect(m.assignQuizVariant()).toBe("a");
  vi.resetModules();
  m = await import("./quizExperiment");
  expect(m.assignQuizVariant()).toBe("a");
  localStorage.clear();
  sessionStorage.clear();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array: any) => {
    array[0] = 0x80000000;
    return array;
  });
  m = await import("./quizExperiment");
  expect(m.assignQuizVariant()).toBe("b");
  expect(m.quizExperimentMetadata()).toEqual({
    quiz_experiment: "quiz-art-v1",
    quiz_variant: "b",
  });
});
it("does not attribute visitors before they enter the experiment", async () => {
  const m = await import("./quizExperiment");
  expect(m.quizExperimentMetadata()).toEqual({});
});
it("ignores invalid storage and survives blocked storage with a stable in-memory choice", async () => {
  vi.spyOn(localStorage, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  const m = await import("./quizExperiment");
  const choice = m.assignQuizVariant();
  expect(m.assignQuizVariant()).toBe(choice);
});
