import { NativeModules, DeviceEventEmitter } from "react-native";

const { RnJavaConnector } = NativeModules;

class TtsServiceImpl {
  private ready = false;
  private waiting: Promise<void> | null = null;

  async waitReady(): Promise<void> {
    if (this.ready) return;

    const nativeReady = await RnJavaConnector.isTtsReady();
    if (nativeReady) {
      this.ready = true;
      return;
    }

    if (this.waiting) return this.waiting;

    this.waiting = new Promise((resolve) => {
      const sub = DeviceEventEmitter.addListener("TtsReady", () => {
        this.ready = true;
        this.waiting = null;
        sub.remove();
        resolve();
      });
    });

    return this.waiting;
  }

  async speak(text: string): Promise<string> {
    await this.waitReady();
    return await RnJavaConnector.speak(text);
  }

  waitFinish(utteranceId: string) {
    return new Promise<void>((resolve) => {
      const sub = DeviceEventEmitter.addListener("TtsFinished", (evt) => {
        if (evt.utteranceId !== utteranceId) return;
        sub.remove();
        resolve();
      });
    });
  }
}

export const TtsService = new TtsServiceImpl();
