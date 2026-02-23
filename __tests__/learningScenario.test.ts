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
  test('10 итераций выбора элемента, обновления результата и расчета MSS', async () => {

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
      const selectedItem = testArray[index];
      const listeningStartedAt = Date.now();
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
      await delay(2000);
      const mss = MSS(selectedItem, false);
      console.log(`iteration=${i + 1}, item=${JSON.stringify(testArray[index])}, mss=${mss}`);
    }
  }, 60000);
});


function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
