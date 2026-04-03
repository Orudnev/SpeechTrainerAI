import { SpItem } from '../src/db/speechDb';
import { buildResultUpdate } from '../src/helpers/buildResultUpdate';
import { getNextDayStartTs, getNextItemUid } from '../src/helpers/getNextItemUid';

jest.mock('../src/components/SpeechCompare', () => ({
  normalizeText: (input: string) =>
    (input || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
}));

describe('getNextItemUid daily unique limit', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not introduce more unique items in one day than maxNewItemCount', () => {
    const baseNow = new Date('2026-04-03T10:00:00.000Z').getTime();
    let now = baseNow;

    jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 5_000;
      return now;
    });

    jest.spyOn(Math, 'random').mockReturnValue(0);

    const maxNewItemCount = 5;
    const items: SpItem[] = Array.from({ length: 20 }, (_, index) => ({
      uid: `item-${index + 1}`,
      topic: 'base',
      q: `Question ${index + 1}`,
      a: `Answer ${index + 1}`,
      cntf: 0,
      correctf: 0,
      streakf: 0,
      df: 0,
      dwf: 0,
      tsf: 0,
      intf: 0,
    }));

    let currentItemUid = '';

    for (let i = 0; i < 20; i += 1) {
      const nextUid = getNextItemUid(items, false, currentItemUid, maxNewItemCount);
      const itemIndex = items.findIndex((item) => item.uid === nextUid);

      expect(itemIndex).toBeGreaterThanOrEqual(0);

      const currentItem = items[itemIndex];
      const listeningStartedAt = Date.now() - 1_000;
      const { patch } = buildResultUpdate(
        currentItem,
        currentItem.a,
        listeningStartedAt,
        false,
        false,
      );

      items[itemIndex] = {
        ...currentItem,
        ...patch,
      };

      currentItemUid = nextUid;
    }

    const nextDayStart = getNextDayStartTs(now);
    const dayStart = nextDayStart - 86_400_000;
    const shownTodayCount = items.filter((item) => {
      const ts = item.tsf ?? 0;
      return (item.cntf ?? 0) > 0 && ts >= dayStart && ts < nextDayStart;
    }).length;

    expect(shownTodayCount).toBe(maxNewItemCount);
  });
});
