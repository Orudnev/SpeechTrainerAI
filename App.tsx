import { View, Text, useColorScheme,Button,Alert,NativeModules } from 'react-native';
import { useEffect } from 'react';
import { useSpeechResults } from './src/useSpeechResults';
import {testVoskAssets,reloadVoskAssets} from './src/testVoskAssets';
import SpeechTrainerPhrase from "./src/components/SpeechTrainerPhrase";
import { speakAndListen } from "./src/speechOrchestrator";

console.log("Hermes?", (global as any).HermesInternal != null);
const { RnJavaConnector } = NativeModules;


export async function testNativeEngine() {
await RnJavaConnector.init();        // true
await RnJavaConnector.init();        // true (не ошибка)
await RnJavaConnector.loadModel('x');
await RnJavaConnector.startRecognition();
}


export default function App() {
  const isDark = useColorScheme() === 'dark';
  useEffect(() => {
    // 🔹 запускаем тест один раз
    testVoskAssets();
  }, []);
  useSpeechResults();
  return (
    <View
      style={{ 
        flex: 1,
        backgroundColor: isDark ? '#000' : '#fff',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: isDark ? '#fff' : '#000' }}>
        SpeechTrainerAI
      </Text>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <SpeechTrainerPhrase />
      </View>
      <Button title="Start1" onPress={()=>reloadVoskAssets()} />
      <Button title="Speak" onPress={()=>speakAndListen("Hello! SpeechTrainerAI is working.")} />
      <Button title="Speak" onPress={()=>speakAndListen("Превед-медвед! В очередь су\u0301кины дети! Отлезь гнида!")} />
    </View>
  );
}