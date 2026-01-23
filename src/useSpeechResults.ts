import { useEffect } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';

const emitter = new NativeEventEmitter(NativeModules.RnJavaConnector);

export function useSpeechResults() {
  useEffect(() => {
    const sub = emitter.addListener(
      'SpeechResult',
      (text: string) => {
        console.log('🎤 result:', text);
      }
    );

    return () => sub.remove();
  }, []);
}
