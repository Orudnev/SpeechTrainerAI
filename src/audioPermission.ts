import { NativeModules } from 'react-native';

const { RnJavaConnector } = NativeModules;

export async function ensureAudioPermission(): Promise<boolean> {
  const has = await RnJavaConnector.hasAudioPermission();
  if (has) return true;

  const granted = await RnJavaConnector.requestAudioPermission();
  return granted === true;
}