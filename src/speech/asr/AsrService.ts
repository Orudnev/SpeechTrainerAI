import { NativeModules, DeviceEventEmitter } from "react-native";
import { SupportedEngines } from "./engines";
import { AsrEngineId, AsrResultEvent, AsrSessionConfig } from "./types";
import { ensureAudioPermission } from "../permissions/audioPermission";

const { RnJavaConnector } = NativeModules;

/**
 * Центральный сервис управления ASR.
 */
class AsrServiceImpl {
  private activeEngine: AsrEngineId | null = null;

  /**
   * Инициализация всех движков при старте приложения.
   */
  async initAllEngines() {
    console.log("🚀 Initializing ASR engines...");

    await RnJavaConnector.init();

    const modelPath = await RnJavaConnector.prepareModel();
    console.log("📦 Vosk model installed:", modelPath);

    await RnJavaConnector.loadModel(modelPath);

    console.log("✅ ASR engines ready:", SupportedEngines);
  }

  async shutdownAllEngines() {
    console.log("🚀 shutdown ASR engines...");
    await RnJavaConnector.shutdown();
  }

  /**
   * Запуск ASR сессии
   */
  async startSession(cfg: AsrSessionConfig) {
    const ok = await ensureAudioPermission();
    if (!ok) throw new Error("Mic permission denied");

    this.activeEngine = cfg.engineId;

    console.log("🔄 Setting current ASR engine:", cfg.engineId);
    await RnJavaConnector.setCurrentEngine(cfg.engineId);

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
   * ✅ NEW: Полная перезагрузка ASR движка
   */
  async reloadCurrentEngine() {
    if (!this.activeEngine) {
      console.log("⚠️ No active engine to reload");
      return;
    }

    const engineId = this.activeEngine;

    console.log("🔁 Reloading ASR engine:", engineId);

    // 1) Stop current session
    await RnJavaConnector.stopRecognition(engineId);

    // 2) Full reset engine (AudioRecord + ASR)
    await RnJavaConnector.setCurrentEngine(engineId);

    // 3) Restart recognition
    await RnJavaConnector.startRecognition(engineId);

    console.log("✅ ASR reloaded successfully");
  }

  /**
   * Подписка на события распознавания
   */
  subscribeResults(cb: (evt: AsrResultEvent) => void) {
    const sub = DeviceEventEmitter.addListener(
      "SpeechResult",
      (msg: string) => {
        const parsed = JSON.parse(msg);

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
