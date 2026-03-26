import { dataRows } from '../src/debug/testPhraseData';
import { MSS, SpItem } from '../src/db/speechDb';
import { buildResultUpdate } from '../src/helpers/buildResultUpdate';
import { getNextItemUid } from '../src/helpers/getNextItemUid';

jest.mock('../src/components/SpeechCompare', () => ({
  normalizeText: (input: string) =>
    (input || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
}));

describe('getNextItemUid growth dynamics', () => {
  test('simulates 100 successful answers and prints mss growth dynamics', () => {
    const testItems: SpItem[] = dataRows.data.map((row) => ({
      uid: row.Uid,
      topic: row.SheetName,
      q: row.En,
      a: row.Ru,
      cntf: 0,
      correctf: 0,
      streakf: 0,
      df: 0,
      dwf: 0,
      tsf: 0,
      intf: 0,
    }));

    let loopCounter = 0;
    const iterationCount = 100;
    let currUid = testItems[0].uid;

    while (loopCounter < iterationCount) {
      const nextUid = getNextItemUid(testItems, false, currUid);
      const itemIndex = testItems.findIndex((item) => item.uid === nextUid);

      expect(itemIndex).toBeGreaterThanOrEqual(0);

      const currItem = testItems[itemIndex];
      const listeningStartedAt = Date.now() - 1500;

      const { patch } = buildResultUpdate(
        currItem,
        currItem.a,
        listeningStartedAt,
        false,
        false,
      );

      testItems[itemIndex] = {
        ...currItem,
        ...patch,
      };

      currUid = nextUid;
      loopCounter += 1;
    }

    const printRows = testItems.map((item, index) => ({
      n: index + 1,
      uid: item.uid,
      q: item.q,
      cntf: item.cntf ?? 0,
      correctf: item.correctf ?? 0,
      streakf: item.streakf ?? 0,
      intf: item.intf ?? 0,
      mssf: Number(MSS(item, false).toFixed(2)),
    }));

    console.table(printRows);

    const totalCntf = testItems.reduce((sum, item) => sum + (item.cntf ?? 0), 0);
    const totalCorrectf = testItems.reduce((sum, item) => sum + (item.correctf ?? 0), 0);

    expect(totalCntf).toBe(iterationCount);
    expect(totalCorrectf).toBe(iterationCount);
  });
});
