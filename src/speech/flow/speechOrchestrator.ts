import { AsrEngineId } from "../asr/types";
import { AsrService } from "../asr/AsrService";
import { TtsService } from "../tts/TtsService";

/**
 * Core loop:
 * Stop ASR → Speak prompt → Restart ASR
 */
export async function speakAndListen(
  text: string,
  engineId: AsrEngineId
) {
  console.log("🎤 Stopping ASR before speaking...");
  await AsrService.stopSession();

  console.log("🔊 Speaking:", text);
  const utteranceId = await TtsService.speak(text);

  console.log("⏳ Waiting TTS finish...");
  await TtsService.waitFinish(utteranceId);

  console.log("🎤 Restarting ASR...");
  await AsrService.startSession({ engineId });
}


