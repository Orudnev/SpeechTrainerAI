import { Tvariant } from '../db/speechDb';

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
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  process(asrText: string | null, variants: Tvariant[]): boolean {
    if (!asrText) return false;

    this.asrResult = asrText;
    const casrrWords = normalizeText(asrText).split(' ').filter(Boolean);

    let etalonWord = this.etalonWords[this.currIndex];
    if (!etalonWord) return false;

    if (casrrWords.length === 0) {
      return this.tryMarkByVariant(etalonWord, variants, asrText);
    }

    const foundIndex = casrrWords.findIndex(w => w === etalonWord);

    if (foundIndex === -1) {
      return this.tryMarkByVariant(etalonWord, variants, asrText);
    }

    let i = foundIndex;
    let phraseMatched = false;

    while (i < casrrWords.length) {
      etalonWord = this.etalonWords[this.currIndex];
      if (!etalonWord) break;

      const spoken = casrrWords[i];

      if (spoken === etalonWord) {
        phraseMatched = this.markWordMatched(etalonWord) || phraseMatched;
        i++;
        continue;
      }

      phraseMatched =
        this.tryMarkByVariant(etalonWord, variants, asrText) || phraseMatched;
      break;
    }

    return phraseMatched;
  }

  private tryMarkByVariant(
    etalonWord: string,
    variants: Tvariant[],
    casrr: string,
  ): boolean {
    if (!this.checkVariants(etalonWord, variants, casrr)) {
      return false;
    }

    return this.markWordMatched(etalonWord);
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
