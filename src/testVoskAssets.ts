import { NativeModules } from 'react-native';
import { ensureAudioPermission } from './audioPermission';

const { RnJavaConnector } = NativeModules;

export async function testVoskAssets() {
  console.log("Preparing model...");

  const modelPath = await RnJavaConnector.prepareModel();
  console.log("Model installed at:", modelPath);

  console.log("Init engine...");
  await RnJavaConnector.init();

  console.log("Load model...");
  await RnJavaConnector.loadModel(modelPath);

  const ok = await ensureAudioPermission();
  if (!ok) {
    console.warn("Mic permission denied");
    return;
  }

  console.log("Start recognition...");
  await RnJavaConnector.startRecognition();
}
