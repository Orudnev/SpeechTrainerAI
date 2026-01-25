import { View, Text, useColorScheme,Button,Alert,NativeModules } from 'react-native';
import { useEffect } from 'react';
import { useSpeechResults } from './src/useSpeechResults';
import {testVoskAssets} from './src/testVoskAssets';
import  SpeechCompare  from "./src/components/SpeechCompare";

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
      <SpeechCompare inStr="hello world this is test" />
      <Button title="Start1" onPress={()=>console.log("press")} />
    </View>
  );
}