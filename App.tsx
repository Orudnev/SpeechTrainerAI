import React, {useEffect, useState, createContext} from 'react';
import {View, useColorScheme} from 'react-native';
import {MD3DarkTheme, PaperProvider} from 'react-native-paper';
import SpeechTrainerPhrase from './src/components/SpeechTrainerPhrase';
import {Settings} from './src/components/Settings';
import {registerDebugApi} from './src/debug/registerDebugApi';
import {AsrService} from './src/speech/asr/AsrService';
import {useSpeechResults} from './src/speech/asr/useSpeechResults';
import {loadAppSettingsFromDb} from './src/db/settings';

export type TPages = 'main' | 'settings';
type AppContextType = {
  setCurrPage: React.Dispatch<React.SetStateAction<TPages>>;
};

export const AppContext = createContext<AppContextType | null>(null);

export default function App() {
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    AsrService.initAllEngines();
    registerDebugApi();
    loadAppSettingsFromDb().catch(err => {
      console.warn('Failed to load app settings', err);
    });
  }, []);

  useSpeechResults();
  const [currPage, setCurrPage] = useState<TPages>('main');

  return (
    <PaperProvider theme={MD3DarkTheme}>
      <AppContext.Provider value={{setCurrPage}}>
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? '#000' : '#fff',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <View style={{flex: 1}}>
            {currPage === 'main' && <SpeechTrainerPhrase />}
            {currPage === 'settings' && <Settings />}
          </View>
        </View>
      </AppContext.Provider>
    </PaperProvider>
  );
}
