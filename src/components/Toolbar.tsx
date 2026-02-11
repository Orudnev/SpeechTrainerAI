import { View, Text, useColorScheme,Button,Alert,NativeModules,Image,StyleSheet } from 'react-native';
import { Appbar } from "react-native-paper";


export default function Toolbar({children}: {children?: React.ReactNode}) {
    return (    
        <Appbar.Header dark>
          <Appbar.Content
            title={
              <View style={styles.titleContainer}>
                <Image
                  source={require("../assets/logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.titleText}>SpeechTrainerAI</Text>
              </View>
            }
          />
          {children}
        </Appbar.Header>
    );
}


const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 48,
    height: 48,
    resizeMode: "contain",
  },  
  titleText: {
    marginLeft: 5,
    color: "#15c45e",
    fontSize: 20,
    fontWeight: "700",  
  },
});