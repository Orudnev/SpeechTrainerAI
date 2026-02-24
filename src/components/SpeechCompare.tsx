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
    // -A- / -B- / -Z-
    // Start processing ASR event; if text is missing, stop with no match.
    if (!asrText) return false;

    // -C-
    // Persist raw ASR payload for snapshots/UI.
    this.asrResult = asrText;

    // -D-
    // Normalize ASR text and split into spoken words.
    const casrrWords = normalizeText(asrText).split(' ').filter(Boolean);

    // -E- / -F-
    // Load the current expected word and stop if phrase is already exhausted.
    if (this.currIndex >= this.etalonWords.length){
      let s = 1;
    }
    let etalonWord = this.etalonWords[this.currIndex];

    if (!etalonWord) return false;

    // -G- / -H- / -H1- / -M-
    // Empty ASR word list: try matching current expected word by variants.
    if (casrrWords.length === 0) {
      return this.tryMarkByVariant(etalonWord, variants, asrText);
    }

    // -I- / -J-
    // Find where expected word appears in ASR words; fallback to variants if absent.
    const foundIndex = casrrWords.findIndex(w => w === etalonWord);

    if (foundIndex === -1) {
      return this.tryMarkByVariant(etalonWord, variants, asrText);
    }

    // -K-
    // Initialize scan position and phrase-level match flag.
    let i = foundIndex;
    let phraseMatched = false;

    // -L-
    // Iterate through spoken words from the first found position.
    while (i < casrrWords.length) {
      // -N- / -O-
      // Reload expected word because currIndex may move after each mark.
      etalonWord = this.etalonWords[this.currIndex];
      if (!etalonWord) break;

      // -P-
      const spoken = casrrWords[i];

      // -Q- / -M- / -M1- / -M2- / -M3- / -M4- / -S- / -T- / -U-
      // Exact match path: mark word, potentially complete phrase, advance scan.
      if (spoken === etalonWord) {
        phraseMatched = this.markWordMatched(etalonWord) || phraseMatched;
        i++;
        continue;
      }

      // -V- / -W-
      // Mismatch path: attempt variant-based match once, then finish this pass.
      phraseMatched =
        this.tryMarkByVariant(etalonWord, variants, asrText) || phraseMatched;
      break;
    }

    // -R- / -END-
    // Return phrase-level result for caller decision (including optional onMatched).
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
