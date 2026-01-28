import { NativeModules, DeviceEventEmitter } from "react-native";
import { SupportedEngines } from "./engines";
import { AsrEngineId, AsrResultEvent, AsrSessionConfig } from "./types";
import { ensureAudioPermission } from "../permissions/audioPermission";

const { RnJavaConnector } = NativeModules;

/**
 * Центральный сервис управления ASR.
 * Единственное место, где TS общается с Native ASR.
 */
class AsrServiceImpl {
  private activeEngine: AsrEngineId | null = null;

  /**
   * Инициализация всех движков при старте приложения.
   */
  async initAllEngines() {
    console.log("🚀 Initializing ASR engines...");

    // 1) Init native layer (один раз)
    await RnJavaConnector.init();

    // 2) Prepare bundled Vosk model
    const modelPath = await RnJavaConnector.prepareModel();
    console.log("📦 Vosk model installed:", modelPath);

    // 3) Load model into Vosk engine
    await RnJavaConnector.loadModel(modelPath);

    console.log("✅ ASR engines ready:", SupportedEngines);
  }

  async shutdownAllEngines(){
    console.log("🚀 shutdown ASR engines...");
    await RnJavaConnector.shutdown();
  }

  /**
   * Запуск ASR сессии (engine выбирается из TS)
   */
  async startSession(cfg: AsrSessionConfig) {
    const ok = await ensureAudioPermission();
    if (!ok) throw new Error("Mic permission denied");

    this.activeEngine = cfg.engineId;

    console.log("🎤 Starting ASR session:", cfg.engineId);

    await RnJavaConnector.startRecognition(cfg.engineId);
  }

  /**
   * Остановка текущей ASR сессии
   */
  async stopSession() {
    if (!this.activeEngine) return;

    console.log("🛑 Stopping ASR session:", this.activeEngine);

    await RnJavaConnector.stopRecognition(this.activeEngine);
    

    this.activeEngine = null;
  }

  /**
   * Подписка на события распознавания
   */
  subscribeResults(cb: (evt: AsrResultEvent) => void) {
    const sub = DeviceEventEmitter.addListener(
      "SpeechResult",
      (msg: string) => {
        const parsed = JSON.parse(msg);

        // пока engineId не приходит из native → подставляем активный
        const evt: AsrResultEvent = {
          engine: this.activeEngine ?? "vosk-en",
          type: parsed.type,
          text: parsed.text,
        };

        cb(evt);
      }
    );

    return () => sub.remove();
  }
}

export const AsrService = new AsrServiceImpl();
