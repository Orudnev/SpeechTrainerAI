import { AsrEngineId } from "./types";

/**
 * Все движки, которые поддерживает приложение.
 * Должно совпадать с Java AsrEngineManager.
 */
export const SupportedEngines: AsrEngineId[] = [
  "vosk-en",
  // позже добавим:
  // "android-ru",
];
