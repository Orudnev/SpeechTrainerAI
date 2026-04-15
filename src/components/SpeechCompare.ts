import { getAppSettingValue } from '../db/settings';
import { Tvariant } from '../db/speechDb';
import * as Snowball from 'snowball-stemmers';

export type SpeechCompareSnapshot = {
  asrResult: string;
  matchedWords: string[];
  status: string;
};

/**
 * Normalize text
 */
export function normalizeText(input: string): string {
  if (!input) return '';

  return input
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/’/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type tolerantCompareDictItem = {
  keyWord: string,
  wordForms: string[]
}

const stemmer = Snowball.newStemmer('russian');

type TsynonymSearchResult = {
  isFound: boolean,
  matchedEtalonWordCount: number,
  nextAsrWordIndex: number
}

/**
 * Speech compare logic container (no UI)
 */
export class SpeechCompareEngine {
  private etalonWords: string[] = [];
  private currIndex = 0;
  private matchedWords: string[] = [];
  private status = '';
  private asrResult = '';

  constructor(etalon: string) {
    this.reset(etalon);
  }

  reset(etalon: string) {
    this.etalonWords = normalizeText(etalon).split(' ').filter(Boolean);
    this.currIndex = 0;
    this.matchedWords = [];
    this.status = '';
    this.asrResult = '';
  }

  getCurrentWord(): string {
    return this.etalonWords[this.currIndex] ?? '';
  }

  getSnapshot(): SpeechCompareSnapshot {
    return {
      asrResult: this.asrResult,
      matchedWords: [...this.matchedWords],
      status: this.status,
    };
  }

  tolerantCompare(asrText: string, variants: Tvariant[], isTolerantCompare: boolean): boolean {
    let etalonWord = this.etalonWords[this.currIndex];
    const casrrWords = normalizeText(asrText).split(' ').filter(Boolean);
    const foundIndex = casrrWords.findIndex(w => stemmer.stem(w) === stemmer.stem(etalonWord));
    if (foundIndex === -1) {
      // try variants
      if (this.checkVariants(etalonWord, variants, asrText)) {
        return this.markWordMatched(etalonWord);
      }
    }

    if (foundIndex === -1) {
      //no words in ASR result matched to current etalon words
      return false;
    }

    let i = foundIndex;
    let phraseMatched = false;
    while (i < casrrWords.length) {
      // -N- / -O-
      // Reload expected word because currIndex may move after each mark.
      etalonWord = this.etalonWords[this.currIndex];
      if (!etalonWord) break;
      const etalonWordStm = stemmer.stem(etalonWord);
      const spoken = casrrWords[i];
      const spokenStm = stemmer.stem(spoken);
      if (spokenStm === etalonWordStm) {
        phraseMatched = this.markWordMatched(etalonWord) || phraseMatched;
        i++;
        continue;
      }

      if (this.checkVariants(etalonWord, variants, asrText)) {
        phraseMatched = this.markWordMatched(etalonWord);
      }

      break;
    }
    return phraseMatched;
  }

  private checkSynonyms(): TsynonymSearchResult {
    const synonyms = getAppSettingValue<Array<Array<string>>>('synonyms');
    const notMatchedEtlWords = this.etalonWords.filter((wrd, index) => index >= this.currIndex);
    const notMatchedEtlStr = notMatchedEtlWords.join(" ");
    const asrStr = normalizeText(this.asrResult);
    const asrWords = asrStr.split(' ').filter(Boolean);
    let result: TsynonymSearchResult = {
      isFound: false,
      matchedEtalonWordCount: 0,
      nextAsrWordIndex: -1
    };
    synonyms.some(syn => {
      const foundEtlSynItm = syn.find(itm => notMatchedEtlStr.startsWith(itm));
      const foundAsrSynItm = syn.find(itm => asrStr.includes(itm));
      if (foundEtlSynItm && foundAsrSynItm) {
        const restEtlStr = notMatchedEtlStr.substring(foundEtlSynItm.length);
        const remainedEtlWrdCnt = restEtlStr.split(' ').filter(Boolean).length;
        const firstAsrCharIndex = asrStr.indexOf(foundAsrSynItm) + foundAsrSynItm.length;
        const restAsrStr = asrStr.substring(firstAsrCharIndex);
        const restAsrWordsCount = restAsrStr.split(' ').filter(Boolean).length;

        result.isFound = true;
        result.matchedEtalonWordCount = notMatchedEtlWords.length - remainedEtlWrdCnt;
        result.nextAsrWordIndex = asrWords.length - restAsrWordsCount;
        return true;
      }
      return false;
    });
    return result;
  }


  process(asrText: string | null, variants: Tvariant[], isTolerantCompare: boolean): boolean {
    // Start processing ASR event; if text is missing, stop with no match.
    if (!asrText) return false;

    // Persist raw ASR payload for snapshots/UI.
    this.asrResult = asrText;

    // Normalize ASR text and split into spoken words.  
    const casrrWords = normalizeText(asrText).split(' ').filter(Boolean);
    if (isTolerantCompare) {
      return this.tolerantCompare(asrText, variants, isTolerantCompare);
    }


    // Load the current expected word and stop if phrase is already exhausted.
    let etalonWord = this.etalonWords[this.currIndex];

    if (!etalonWord) return false;

    let phraseMatched = false;
    // Skip noice words
    let foundIndex = casrrWords.findIndex(w => w === etalonWord);
    if (foundIndex === -1) {
      //No words except noice, try variants
      if (this.checkVariants(etalonWord, variants, asrText)) {
        //variant found
        phraseMatched = this.markWordMatched(etalonWord);
      } else {
        //variant not found, try synonyms
        const csRes = this.checkSynonyms();
        if (csRes.isFound) {
          // synonym found
          for (let mi = 0; mi < csRes.matchedEtalonWordCount; mi++) {
            phraseMatched = this.markWordMatched(etalonWord);
            if (phraseMatched) {
              return true;
            }
          }
          foundIndex = csRes.nextAsrWordIndex;
        } else {
          // synonym not matched
          return false;
        }
      }
    }

    // Initialize scan position and phrase-level match flag.
    let i = foundIndex;

    // Iterate through spoken words from the first not-noice word.
    while (i < casrrWords.length) {
      // Reload expected word because currIndex may move after each mark.
      etalonWord = this.etalonWords[this.currIndex];
      if (!etalonWord) break;
      const spoken = casrrWords[i];
      // Exact match path: mark word, potentially complete phrase, advance scan.
      if (spoken === etalonWord) {
        phraseMatched = this.markWordMatched(etalonWord);
        if (phraseMatched) {
          //all words matched
          break;
        }
        //only current word matched
        i++;
        continue;
      }

      //current word is not matched, try to compare by variants
      if (this.checkVariants(etalonWord, variants, asrText)) {
        phraseMatched = this.markWordMatched(etalonWord);
        if (phraseMatched) {
          //all words matched
          break;
        }
        //only current word matched
        i++;
        continue;
      }

      //current word is not matched, try to compare by synonyms
      const csRes = this.checkSynonyms();
      if (csRes.isFound) {
        // synonym found
        for (let mi = 0; mi < csRes.matchedEtalonWordCount; mi++) {
          phraseMatched = this.markWordMatched(etalonWord);
          if (phraseMatched) {
            break;
          }
        }
        i = i + csRes.nextAsrWordIndex;
      } 
      
      break;
    }
    // Return phrase-level result for caller decision (including optional onMatched).
    return phraseMatched;
  }

  private markWordMatched(word: string): boolean {
    this.matchedWords.push(word);
    this.currIndex++;

    if (this.currIndex >= this.etalonWords.length) {
      this.status = 'Ответ засчитан';
      return true;
    }

    return false;
  }

  private checkVariants(
    etalonWord: string,
    variants: Tvariant[],
    casrr: string,
  ): boolean {
    const entry = variants.find(
      v => normalizeText(v.word) === normalizeText(etalonWord),
    );

    if (!entry) return false;

    for (const variantWord of entry.variants) {
      if (normalizeText(casrr).includes(normalizeText(variantWord))) {
        return true;
      }
    }

    return false;
  }
}
