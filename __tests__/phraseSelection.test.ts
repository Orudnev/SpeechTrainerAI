import { getWeaknessScore, pickNextPhraseIndex } from "../src/components/phraseSelection";
import { SpItem } from "../src/db/speechDb";

function item(uid: string, partial: Partial<SpItem> = {}): SpItem {
  return {
    uid,
    topic: "t",
    q: "q",
    a: "a",
    ...partial,
  };
}

describe("phrase selection", () => {
  it("treats unseen items as weak even with zero duration", () => {
    const unseen = item("u", { cntf: 0, dwf: 0 });
    const seenFast = item("s", { cntf: 5, dwf: 500 });

    expect(getWeaknessScore(unseen, false)).toBeGreaterThan(
      getWeaknessScore(seenFast, false)
    );
  });

  it("does not always pick the first element", () => {
    const items = [
      item("a", { cntf: 1, dwf: 1000 }),
      item("b", { cntf: 1, dwf: 1000 }),
      item("c", { cntf: 1, dwf: 1000 }),
    ];

    const randomValues = [0.05, 0.45, 0.85];
    const picks = randomValues.map((v) => {
      const spy = jest.spyOn(Math, "random").mockReturnValue(v);
      const picked = pickNextPhraseIndex(items, "z", false, []);
      spy.mockRestore();
      return picked;
    });

    expect(new Set(picks).size).toBeGreaterThan(1);
    expect(picks).toEqual([0, 1, 2]);
  });
});
