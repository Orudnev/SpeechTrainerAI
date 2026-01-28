import { NativeModules, DeviceEventEmitter } from "react-native";
import { speak } from "./tts";
import { AsrService } from "./asr/AsrService";
import { AsrEngineId} from "./asr/types";

const { RnJavaConnector } = NativeModules;

/**
 * SpeechTrainerAI core loop:
 * 1) Stop ASR
 * 2) Speak prompt via TTS
 * 3) Wait until TTS finished
 * 4) Restart ASR
 */
export async function speakAndListen(text: string, engineId: AsrEngineId) {
  console.log("🎤 Stopping recognition before TTS...");
  await RnJavaConnector.stopRecognition("vosk-en");

  console.log("🔊 Speaking:", text);

  const utteranceId = await speak(text);

  return new Promise<void>((resolve, reject) => {
    const sub = DeviceEventEmitter.addListener(
    "TtsFinished",
    async (evt: any) => {
        if (evt.utteranceId !== utteranceId) return;

        sub.remove();

        await RnJavaConnector.startRecognition("vosk-en");
        resolve();
    }
    );


    const errSub = DeviceEventEmitter.addListener(
      "TtsError",
      (msg: string) => {
        console.log("❌ TTS error:", msg);
        sub.remove();
        errSub.remove();
        reject(msg);
      }
    );
  });
}
