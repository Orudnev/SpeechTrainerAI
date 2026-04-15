import { SpeechCompareEngine } from "../src/components/SpeechCompare";

describe("getNextItem", () => {
    const etalonText = "he is a wolf or he is a dog";
    let asrText = "blbalbalbla he's a wolf or he's hjfjfjfj";
    const cmpEngine = new SpeechCompareEngine(etalonText);
    let result1 = cmpEngine.process(asrText,[],false);
    asrText = "a dog";
    let result2 = cmpEngine.process(asrText,[],false);
    let s =1 ;
});

