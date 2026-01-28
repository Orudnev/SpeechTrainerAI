import { useEffect } from "react";
import { AsrService } from "./asr/AsrService";
import { AsrResultEvent } from "./asr/types";

/**
 * useSpeechResults
 *
 * React-хук, который подписывается на результаты ASR
 * через центральный AsrService.
 *
 * Теперь UI/Trainer слой больше НЕ слушает DeviceEventEmitter напрямую,
 * а получает результаты через единый ASR abstraction layer.
 */
export function useSpeechResults() {
  useEffect(() => {
    console.log("🔔 Subscribing to ASR results...");

    // Подписка через AsrService
    const unsubscribe = AsrService.subscribeResults(
      (evt: AsrResultEvent) => {
        if (evt.type === "partial") {
          console.log(
            `… partial [${evt.engine}]:`,
            evt.text
          );
        }

        if (evt.type === "final") {
          console.log(
            `✅ final [${evt.engine}]:`,
            evt.text
          );
        }
      }
    );

    return () => {
      console.log("🔕 Unsubscribing from ASR results...");
      unsubscribe();
    };
  }, []);
}
