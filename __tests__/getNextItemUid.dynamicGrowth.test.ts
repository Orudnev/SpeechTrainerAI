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


let lastDateNow:number;
let originalNow:number;

beforeAll(() => {
  originalNow = Date.now;
  lastDateNow = originalNow();

  const stepMs = 5 * 1000;

  jest.spyOn(Date, 'now').mockImplementation(() => {
    lastDateNow += stepMs;
    return lastDateNow;
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});


describe('getNextItemUid growth dynamics', () => {
  test('simulates N successful answers and prints mss growth dynamics', () => {
    const iterationCount =1000;
    const itemCount = 100;
    const testItems: SpItem[] = Array.from({ length: itemCount }, (_, idx) => ({
      uid: `Itm${idx}`,
      topic: 'Test',
      q: `Itm${idx}`,
      a: `Itm${idx}`,
      cntf: 0,
      correctf: 0,
      streakf: 0,
      df: 0,
      dwf: 0,
      tsf: 0,
      intf: 0,
    }));

    let loopCounter = 0;
    let currUid = testItems[0].uid;
    while (loopCounter < iterationCount) {
      const nextUid = getNextItemUid(testItems, false, currUid);
      const itemIndex = testItems.findIndex((item) => item.uid === nextUid);

      expect(itemIndex).toBeGreaterThanOrEqual(0);
      const currItem = testItems[itemIndex];
      const listeningStartedAt = Date.now() - 1000;

      const { patch } = buildResultUpdate(
        currItem,
        currItem.a,
        listeningStartedAt,
        false,
        false,
      );
      patch.dwf = 500;
      

      testItems[itemIndex] = {
        ...currItem,
        ...patch,
      };
      if(loopCounter % 100 == 0){
        lastDateNow += 1000 * 60 * 60 * 24 * 5;
      }
      currUid = nextUid;
      loopCounter += 1;
    }

    const printRows = testItems.map((item, index) => ({
      uid: item.uid,
      ts:item.tsf,
      streakf: item.streakf ?? 0,
      dwf:item.dwf??0,
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
