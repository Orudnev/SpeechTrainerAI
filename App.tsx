import { View, Text, useColorScheme,Button,Alert,NativeModules } from 'react-native';
import { useEffect } from 'react';
import { useSpeechResults } from './src/speech/asr/useSpeechResults';
import SpeechTrainerPhrase from "./src/components/SpeechTrainerPhrase";
import { speakAndListen } from "./src/speech/flow/speechOrchestrator";
import { registerDebugApi } from "./src/debug/registerDebugApi";
import { AsrService } from "./src/speech/asr/AsrService";
import { MD3DarkTheme, PaperProvider } from 'react-native-paper';

console.log("Hermes?", (global as any).HermesInternal != null);
const { RnJavaConnector } = NativeModules;


export default function App() {
  const isDark = useColorScheme() === 'dark';
  useEffect(() => {
    // 🔹 запускаем тест один раз
    AsrService.initAllEngines();
    registerDebugApi();
  }, []);
  useSpeechResults();
  return (
    <PaperProvider theme={MD3DarkTheme}>
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
      {/* <Button title="Speak" onPress={()=>speakAndListen("Hello! SpeechTrainerAI is working.")} /> */}
    </View>
    </PaperProvider>
  );
}

