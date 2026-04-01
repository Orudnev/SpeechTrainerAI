import React from "react";
import { TouchableOpacity, View,useWindowDimensions } from "react-native";

import Svg, {
    Rect,
    Defs,
    LinearGradient,
    Stop,
    G,
    Polygon,
    Path
} from "react-native-svg";

import { Text } from 'react-native';
import { white } from "react-native-paper/lib/typescript/styles/themes/v2/colors";

type GradientPanelProps = {
    label: string,
    mainText: string,
    suffixText?: string,
    statusText?: string,
    width?: number,
    height?: number,
    onPress: () => void
};

export const GradientPanel: React.FC<GradientPanelProps> = ({
    label,
    mainText,
    suffixText,
    statusText,
    width = 400,
    height = 170,
    onPress
}) => {
    const screenSize = useWindowDimensions();
    const isLandscape = screenSize.width > screenSize.height; 
    let labelTop = 10;
    let labelLeft = 10;
    let textTop = 35;
    let textLeft = 12;   
    if(isLandscape){
        width = screenSize.width - 150; 
        labelLeft = 20;
        textTop = 8;
        textLeft = 155
        height = 85;
    } else {
        width = screenSize.width - 8;
        height = 210;
    }
    return (
        <View style={{ width: '100%' }} onTouchEnd={onPress}>
            <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>

                <Defs>
                    <LinearGradient id="borderGradient" y2="100%">
                        <Stop offset="0" stopColor="#00f0ff" />
                        <Stop offset="0.5" stopColor="#ffffff" />
                        <Stop offset="1" stopColor="#08e6ff" />
                    </LinearGradient>

                    <LinearGradient id="buttonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0" stopColor="#0b1725" />
                        <Stop offset="0.4" stopColor="#26435c" />
                        <Stop offset="0.6" stopColor="#3b5e7a" />
                        <Stop offset="1" stopColor="#0b1725" />
                    </LinearGradient>
                </Defs>

                {/* button background */}
                <Rect
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    rx="16"
                    fill="url(#buttonGradient)"
                    stroke="url(#borderGradient)"
                    strokeWidth="3"
                />
            </Svg>
            <Text style={{ color: '#9AA3B2', fontSize: 15, position: 'absolute', top: labelTop, left: labelLeft }} >{label}</Text>
            <View style={{ position: 'absolute', top: textTop, left: textLeft }}>
                <Text style={{ color: '#E6F1FF', fontSize: 18, fontWeight: '600', lineHeight: 24 }}   >
                    {mainText}
                    {suffixText && (
                        <Text style={{ color: '#8b8383', fontSize: 18, fontWeight: '600' }}   >
                            {" " + suffixText}
                        </Text>
                    )}
                </Text>
            </View>
            {statusText && (
                <View style={{
                    borderWidth: 1,
                    borderColor: '#FFFFFF', 
                    backgroundColor: "#087e2b", 
                    borderRadius: 15, 
                    width: 200, 
                    height: 50, 
                    position: "absolute", 
                    bottom: 10, left: 10, alignItems: "center"
                }}>
                    <Text style={{ fontSize: 18, lineHeight: 45, fontWeight: 800, color: "FFFFFF" }}>{statusText}</Text>
                </View>
            )}
        </View>
    );
};

