import { SpItem } from '../src/db/speechDb';
import { getNextItemUid } from '../src/helpers/getNextItemUid';

jest.mock('../src/components/SpeechCompare', () => ({
  normalizeText: (input: string) =>
    (input || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
}));

describe('getNextItemUid repeated fresh', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns repeated fresh item even when daily unique limit is already reached', () => {
    const now = new Date('2026-04-03T12:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const items: SpItem[] = [
      {
        uid: 'fresh-repeat',
        topic: 'base',
        q: 'Q1',
        a: 'A1',
        cntf: 1,
        correctf: 1,
        streakf: 1,
        df: 0,
        dwf: 0,
        tsf: now - (2 * 60_000 + 5_000),
        intf: 60_000,
      },
      {
        uid: 'today-2',
        topic: 'base',
        q: 'Q2',
        a: 'A2',
        cntf: 1,
        correctf: 1,
        streakf: 1,
        df: 0,
        dwf: 0,
        tsf: now - 30_000,
        intf: 10 * 60_000,
      },
      {
        uid: 'today-3',
        topic: 'base',
        q: 'Q3',
        a: 'A3',
        cntf: 1,
        correctf: 1,
        streakf: 1,
        df: 0,
        dwf: 0,
        tsf: now - 40_000,
        intf: 10 * 60_000,
      },
    ];

    const nextUid = getNextItemUid(items, false, 'today-3', 1);
    expect(nextUid).toBe('fresh-repeat');
  });
});
