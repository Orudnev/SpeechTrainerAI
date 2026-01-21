import { View, Text, useColorScheme,Button,Alert,NativeModules } from 'react-native';

const { RnJavaConnector } = NativeModules;

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const onStart = async () => {
    try {
      console.log("************");
      const result = await RnJavaConnector.hello();      
      Alert.alert('Native response1', result);
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