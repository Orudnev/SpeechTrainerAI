import { getNextItem } from "../src/helpers/getNextItem";
import { generatePseudoUniqueId, SpItem } from "../src/db/speechDb";

const DAY = 86400000;

describe("getNextItem", () => {
  let now = 100 * DAY;

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function item(partial: Partial<SpItem>): SpItem {
    return {
      uid: generatePseudoUniqueId(),
      topic: "",
      q: "",
      a: "",
      ...partial,
    };
  }

  test("overdue: выбирает weakest по MSS", () => {
    const a = item({
      tsf: now - 10 * DAY,
      intf: 1 * DAY,
      cntf: 10,
      correctf: 9,
    });

    const b = item({
      tsf: now - 10 * DAY,
      intf: 1 * DAY,
      cntf: 2,
      correctf: 0,
    });

    const result = getNextItem([a, b]);

    expect(result).toBe(b.uid);
  });

  test("overdue: сортировка по интервалу при равном MSS", () => {
    const a = item({
      tsf: now - 10 * DAY,
      intf: 1 * DAY,
      cntf: 5,
      correctf: 3,
    });

    const b = item({
      tsf: now - 10 * DAY,
      intf: 5 * DAY,
      cntf: 5,
      correctf: 3,
    });

    const result = getNextItem([a, b]);

    expect(result).toBe(a.uid);
  });

  test("soon: если нет overdue", () => {
    const a = item({
      tsf: now,
      intf: 2 * DAY,
      cntf: 1,
    });

    const b = item({
      tsf: now,
      intf: 3 * DAY,
      cntf: 1,
    });

    const result = getNextItem([a, b]);

    expect([a.uid, b.uid]).toContain(result);
  });

  test("maintenance: если нет overdue и soon", () => {
    const strong = item({
      cntf: 20,
      correctf: 20,
      tsf: now,
      intf: 100 * DAY,
    });

    jest.spyOn(Math, "random").mockReturnValue(0);

    const result = getNextItem([strong]);

    expect(result).toBe(strong.uid);
  });

  test("fresh: если нет других", () => {
    const fresh = item({
      cntf: 0,
    });

    jest.spyOn(Math, "random").mockReturnValue(0);

    const result = getNextItem([fresh]);

    expect(result).toBe(fresh.uid);
  });

  test("fallback: если нет условий", () => {
    const a = item({
      cntf: 1,
      tsf: now,
      intf: 100 * DAY,
    });

    const b = item({
      cntf: 1,
      tsf: now,
      intf: 100 * DAY,
    });

    jest.spyOn(Math, "random").mockReturnValue(0.9);

    const result = getNextItem([a, b]);

    expect([a.uid, b.uid]).toContain(result);
  });

  test("reverse режим работает", () => {
    const a = item({
      tsr: now - 10 * DAY,
      intr: 1 * DAY,
      cntr: 1,
    });

    const result = getNextItem([a], true);

    expect(result).toBe(a.uid);
  });

  test("overdue: random noise используется", () => {
    const a = item({
      tsf: now - 10 * DAY,
      intf: 1 * DAY,
      cntf: 1,
      correctf: 0,
    });

    const b = item({
      tsf: now - 10 * DAY,
      intf: 1 * DAY,
      cntf: 1,
      correctf: 0,
    });

    jest.spyOn(Math, "random").mockReturnValue(0);

    const result = getNextItem([a, b]);

    expect([a.uid, b.uid]).toContain(result);
  });
});