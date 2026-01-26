import { NativeModules, DeviceEventEmitter } from "react-native";

const { RnJavaConnector } = NativeModules;

export async function speak(text: string) {
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

