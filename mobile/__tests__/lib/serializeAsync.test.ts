import { serializeAsync } from "../../lib/serializeAsync";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("serializeAsync", () => {
  it("runs overlapping calls one after another", async () => {
    const steps: string[] = [];
    const run = serializeAsync(async (name: string) => {
      steps.push(`${name}:start`);
      await tick();
      steps.push(`${name}:end`);
    });

    await Promise.all([run("first"), run("second")]);

    expect(steps).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });

  it("keeps going after a call fails", async () => {
    const run = serializeAsync(async (shouldFail: boolean) => {
      if (shouldFail) throw new Error("boom");
    });

    await expect(run(true)).rejects.toThrow("boom");
    await expect(run(false)).resolves.toBeUndefined();
  });
});
