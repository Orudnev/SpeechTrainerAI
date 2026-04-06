import { View, useColorScheme, useWindowDimensions } from 'react-native';
import { useEffect, useMemo, useState, createContext } from 'react';
import SpeechTrainerPhrase from './src/components/SpeechTrainerPhrase';
import { registerDebugApi } from './src/debug/registerDebugApi';
import { AsrService } from './src/speech/asr/AsrService';
import { BottomNavigation, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { Settings } from './src/components/Settings';
import { saveAppSettingsToDb } from './src/db/settings';
import { Score } from './src/components/Score';
import { TaskEditor } from './src/components/TaskEditor';

console.log('Hermes?', (global as any).HermesInternal != null);

export type TPages = 'main' | 'score' | 'task' | 'settings';
type AppContextType = {
  setCurrPage: (page: TPages) => void | Promise<void>;
};
type AppRoute = {
  key: TPages;
  title: string;
  focusedIcon: string;
};

const APP_ROUTES: AppRoute[] = [
  { key: 'main', title: 'Trainer', focusedIcon: 'account-voice' },
  { key: 'score', title: 'Score', focusedIcon: 'chart-bar' },
  { key: 'task', title: 'Task', focusedIcon: 'playlist-edit' },
  { key: 'settings', title: 'Settings', focusedIcon: 'cog-outline' },
];

export const AppContext = createContext<AppContextType | null>(null);

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const screenSize = useWindowDimensions();
  const isLandscape = screenSize.width > screenSize.height;
  useEffect(() => {
    AsrService.initAllEngines();
    registerDebugApi();
  }, []);
  const [currPage, setCurrPage] = useState<TPages>('main');
  const compactTrainerNav = isLandscape && currPage === 'main';
  const navigationIndex = useMemo(
    () => {
      const index = APP_ROUTES.findIndex(route => route.key === currPage);
      return index >= 0 ? index : 0;
    },
    [currPage],
  );

  async function handlePageChange(nextPage: TPages) {
    if (currPage === nextPage) {
      return;
    }

    if (currPage === 'settings' || currPage === 'task') {
      try {
        await saveAppSettingsToDb();
      } catch (err) {
        console.warn('Failed to save app settings', err);
      }
    }

    setCurrPage(nextPage);
  }

  return (
    <PaperProvider theme={MD3DarkTheme}>
      <AppContext.Provider value={{ setCurrPage: handlePageChange }}>
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? '#000' : '#fff',
          }}>
          <BottomNavigation
            navigationState={{ index: navigationIndex, routes: APP_ROUTES }}
            labeled={!compactTrainerNav}
            compact={compactTrainerNav}
            barStyle={
              compactTrainerNav
                ? {
                  height: 48,
                  justifyContent:'center',
                  overflow:'hidden',
                }
                : undefined
            }
            onIndexChange={index => {
              const nextRoute = APP_ROUTES[index];
              if (nextRoute) {
                handlePageChange(nextRoute.key);
              }
            }}
            renderScene={({ route }) => {
              switch (route.key) {
                case 'main':
                  return <SpeechTrainerPhrase />;
                case 'score':
                  return <Score />;
                case 'task':
                  return <TaskEditor />;
                case 'settings':
                  return <Settings />;
                default:
                  return null;
              }
            }}
            sceneAnimationEnabled={false}
          />
        </View>
      </AppContext.Provider>
    </PaperProvider>
  );
}
