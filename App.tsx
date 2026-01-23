import { View, Text, useColorScheme,Button,Alert,NativeModules } from 'react-native';

const { RnJavaConnector } = NativeModules;


export async function testNativeEngine() {
  console.log('init:', await RnJavaConnector.init());
  console.log('state:', await RnJavaConnector.getEngineState());

  console.log(
    'loadModel:',
    await RnJavaConnector.loadModel('/fake/path/vosk-model')
  );
  console.log('state:', await RnJavaConnector.getEngineState());

  console.log(
    'startRecognition:',
    await RnJavaConnector.startRecognition()
  );
  console.log('state:', await RnJavaConnector.getEngineState());

  await RnJavaConnector.stopRecognition();
  console.log('state:', await RnJavaConnector.getEngineState());

  await RnJavaConnector.shutdown();
  console.log('state:', await RnJavaConnector.getEngineState());
}


export default function App() {
  const isDark = useColorScheme() === 'dark';
  const onStart = async () => {
    try {
      testNativeEngine();
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }
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
      <Button title="Start1" onPress={onStart} />
    </View>
  );
}