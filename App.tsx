import { View, Text, useColorScheme, Button, Alert, NativeModules, Image, StyleSheet } from 'react-native';
import { useEffect, useState, createContext } from 'react';
import { useSpeechResults } from './src/speech/asr/useSpeechResults';
import SpeechTrainerPhrase from "./src/components/SpeechTrainerPhrase";
import { speakAndListen } from "./src/speech/flow/speechOrchestrator";
import { registerDebugApi } from "./src/debug/registerDebugApi";
import { AsrService } from "./src/speech/asr/AsrService";
import { MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { Settings } from './src/components/Settings';


console.log("Hermes?", (global as any).HermesInternal != null);
const { RnJavaConnector } = NativeModules;


export type TPages = "main" | "settings";
type AppContextType = {
  setCurrPage: React.Dispatch<React.SetStateAction<TPages>>;
};

export const AppContext = createContext<AppContextType | null>(null);


export default function App() {
  const isDark = useColorScheme() === 'dark';
  useEffect(() => {
    // 🔹 запускаем тест один раз
    AsrService.initAllEngines();
    registerDebugApi();
  }, []);
  useSpeechResults();
  const [currPage, setCurrPage] = useState<TPages>("main");

  return (
    <PaperProvider theme={MD3DarkTheme}>
      <AppContext.Provider value={{ setCurrPage }}>
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? '#000' : '#fff',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            {currPage === "main" && <SpeechTrainerPhrase />}
            {currPage === "settings" && <Settings />}
          </View>
        </View>
      </AppContext.Provider>
    </PaperProvider>
  );
}



