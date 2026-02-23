import { buildResultUpdate } from '../src/helpers/buildResultUpdate';
import { getNextItemUid } from '../src/helpers/getNextItemUid';
import { MSS, SpItem } from '../src/db/speechDb';



export const testArray: SpItem[] = [
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
    let now = 1_700_000_000_000;
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
    console.log(`iteration=${i + 1}, item=${JSON.stringify(testArray[index])}, mss=${mss}`);

    now += 60_000;
}

