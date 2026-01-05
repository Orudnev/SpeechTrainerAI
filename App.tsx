import { View, Text, useColorScheme } from 'react-native';

export default function App() {
  const isDark = useColorScheme() === 'dark';

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
      <Text style={{ color: isDark ? '#fff' : '#000', fontSize:22 }}>
        Быррбыррррбырррр
      </Text>

    </View>
  );
}