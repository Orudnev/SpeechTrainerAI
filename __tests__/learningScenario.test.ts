import { buildResultUpdate } from '../src/helpers/buildResultUpdate';
import { getNextItemUid } from '../src/helpers/getNextItemUid';
import { MSS, SpItem } from '../src/db/speechDb';

jest.mock('../src/components/SpeechCompare', () => ({
  normalizeText: (input: string) =>
    (input || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
}));

describe('learning flow scenario', () => {
  test('10 итераций выбора элемента, обновления результата и расчета MSS', () => {
    let now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const testArray: SpItem[] = [
      {
        uid: 'item-1',
        topic: 'base',
        q: 'Hello',
        a: 'Привет',
        cntf: 0,
        correctf: 0,
        streakf: 0,
        df: 0,
        dwf: 0,
        tsf: 0,
        intf: 0,
      },
      {
        uid: 'item-2',
        topic: 'base',
        q: 'Thank you',
        a: 'Спасибо',
        cntf: 0,
        correctf: 0,
        streakf: 0,
        df: 0,
        dwf: 0,
        tsf: 0,
        intf: 0,
      },
      {
        uid: 'item-3',
        topic: 'base',
        q: 'Goodbye',
        a: 'Пока',
        cntf: 0,
        correctf: 0,
        streakf: 0,
        df: 0,
        dwf: 0,
        tsf: 0,
        intf: 0,
      },
    ];

    for (let i = 0; i < 10; i += 1) {
      const selectedUid = getNextItemUid(testArray, false);
      const index = testArray.findIndex((item) => item.uid === selectedUid);

      expect(index).toBeGreaterThanOrEqual(0);

      const selectedItem = testArray[index];
      const listeningStartedAt = now - 1_200;

      const { patch } = buildResultUpdate(
        selectedItem,
        selectedItem.a,
        listeningStartedAt,
        false,
        false,
      );

      testArray[index] = {
        ...selectedItem,
        ...patch,
      };

      const mss = MSS(testArray[index], false);
      console.log(`iteration=${i + 1}, uid=${selectedUid}, mss=${mss}`);

      now += 60_000;
    }

    const totalShown = testArray.reduce((sum, item) => sum + (item.cntf ?? 0), 0);

    expect(totalShown).toBe(10);
    expect(consoleSpy).toHaveBeenCalledTimes(10);
    consoleSpy.mock.calls.forEach(([msg]) => {
      expect(String(msg)).toContain('mss=');
    });

    jest.restoreAllMocks();
  });
});
