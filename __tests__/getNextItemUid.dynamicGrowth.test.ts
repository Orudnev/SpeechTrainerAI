import { dataRows } from '../src/debug/testPhraseData';
import { MSS, SpItem } from '../src/db/speechDb';
import { buildResultUpdate } from '../src/helpers/buildResultUpdate';
import { getNextItemUid } from '../src/helpers/getNextItemUid';
import { ReceiveAllRowsFromCloud } from '../src/helpers/webApiWrapper';

jest.mock('../src/components/SpeechCompare', () => ({
  normalizeText: (input: string) =>
    (input || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
}));


let lastDateNow: number;
let originalNow: number;

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
  test('simulates N successful answers and prints mss growth dynamics', async () => {
    let response = await ReceiveAllRowsFromCloud();
    if (!response.ok) {
      throw new Error("HTTP error " + response.status);
    }
    const allRows = await response.json();
    const testItems = allRows.filter((r: SpItem) => r.topic === 'B2Vcbl').map((r: SpItem) => ({
      uid: r.uid,
      topic: r.topic,
      q: r.q,
      a: r.a,
      cntf: r.cntf,
      correctf: r.correctf,
      streakf: r.streakf,
      df: r.df,
      dwf: r.dwf,
      tsf: r.tsf,
      intf: r.intf,
    }));

    const iterationCount = 1000;
    const itemCount = testItems.length;
    // const testItems: SpItem[] = Array.from({ length: itemCount }, (_, idx) => ({
    //   uid: `Itm${idx}`,
    //   topic: 'Test',
    //   q: `Itm${idx}`,
    //   a: `Itm${idx}`,
    //   cntf: 0,
    //   correctf: 0,
    //   streakf: 0,
    //   df: 0,
    //   dwf: 0,
    //   tsf: 0,
    //   intf: 0,
    // }));

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

      if(currItem.uid === 'ID89PNYW') {
        let s = 1;
      }

      testItems[itemIndex] = {
        ...currItem,
        ...patch,
      };

      if (loopCounter % 100 == 0) {
        lastDateNow += 1000 * 60 * 60 * 24 * 5;
      }
      currUid = nextUid;
      loopCounter += 1;
    }


    const printRows = testItems.map((item, index) => {
      if (MSS(item, false) > 1000) {
        let mss = MSS(item, false);
      }

      return {
        uid: item.uid,
        ts: item.tsf,
        streakf: item.streakf ?? 0,
        dwf: item.dwf ?? 0,
        intf: item.intf ?? 0,
        mssf: Number(MSS(item, false).toFixed(2)),
      };
    });

    console.table(printRows);

    const totalCntf = testItems.reduce((sum, item) => sum + (item.cntf ?? 0), 0);
    const totalCorrectf = testItems.reduce((sum, item) => sum + (item.correctf ?? 0), 0);

    expect(totalCntf).toBe(iterationCount);
    expect(totalCorrectf).toBe(iterationCount);
  });
});
