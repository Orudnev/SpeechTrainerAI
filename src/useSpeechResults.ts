import { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';

type SpeechEvent = {
  type: 'partial' | 'final';
  text: string;
};

export function useSpeechResults() {
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'SpeechResult',
      (raw: string) => {
        const evt: SpeechEvent = JSON.parse(raw);

        if (evt.type === 'partial') {
          console.log('… partial:', evt.text);
        }

        if (evt.type === 'final') {
          console.log('✅ final:', evt.text);
        }
      }
    );

    return () => sub.remove();
  }, []);
}