import { NativeModules, DeviceEventEmitter } from "react-native";

const { RnJavaConnector } = NativeModules;

export async function speak(text: string) {
  await waitForTtsReady();
  return await RnJavaConnector.speak(text);  
}

export function subscribeTts() {
  const sub1 = DeviceEventEmitter.addListener("TtsFinished", msg => {
    console.log("✅ TTS finished:", msg);
  });

  const sub2 = DeviceEventEmitter.addListener("TtsError", msg => {
    console.log("❌ TTS error:", msg);
  });

  return () => {
    sub1.remove();
    sub2.remove();
  };
}

export function waitTtsFinish(utteranceId: string) {
  return new Promise<void>((resolve) => {
    const sub = DeviceEventEmitter.addListener("TtsFinished", (evt) => {
      if (evt.utteranceId !== utteranceId) return;
      sub.remove();
      resolve();
    });
  });
}

let ready = false;
let waiting: Promise<void> | null = null;

export async function waitForTtsReady(): Promise<void> {
  if (ready) return;

  // 1) спросим у Java напрямую
  const nativeReady = await RnJavaConnector.isTtsReady();
  if (nativeReady) {
    ready = true;
    return;
  }

  // 2) если уже ждём — возвращаем тот же promise
  if (waiting) return waiting;

  // 3) ждём событие
  waiting = new Promise((resolve) => {
    const sub = DeviceEventEmitter.addListener("TtsReady", () => {
      ready = true;
      waiting = null;
      sub.remove();
      resolve();
    });
  });

  return waiting;
}