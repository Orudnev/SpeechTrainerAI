import React from "react";
import { TouchableOpacity, View } from "react-native";

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



const ICONS = {
    openWord: () => (
        <Polygon points="0,0 0,20 20,10" fill="#00f0ff" />
    ),

    skipPhrase: () => (
        <>
            <Polygon points="25,10 15,0 15,20" fill="#00f0ff" />
            <Polygon points="10,10 0,0 0,20" fill="#00f0ff" />
        </>
    ),

    cantRemember: () => (
        <Path
            d="M0 0 L20 20 M20 0 L0 20"
            stroke="#ff6b6b"
            strokeWidth={4}
            strokeLinecap="round"
        />
    ),

    sayWord: () => (
        <>
            <Polygon
                points="0,5 10,5 20,-5 20,25 10,15 0,15"
                fill="#00f0ff"
            />
            <Path
                d="M25 5 Q35 10 25 15"
                stroke="#00f0ff"
                strokeWidth={2}
                fill="none"
            />
        </>
    )
};




type GradientPanelProps = {
    label: string;
    text: string;
    width?: number;
    height?: number;
    onPress: () => void;
};

export const GradientPanel: React.FC<GradientPanelProps> = ({
    label,
    text,
    width = 400,
    height = 170,
    onPress
}) => {
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
                {/* text */}
                {/* <Text
                        x="10"
                        y="30"
                        fill="#9AA3B2"
                        fontSize="15"
                    >
                        {label}
                    </Text> */}
            </Svg>
            <Text style={{ color: '#9AA3B2', fontSize: 15, position: 'absolute', top: 10, left: 10 }} >{label}</Text>
            <View style={{ position: 'absolute', top: 35, left: 12,   }}>
                <Text style={{ color: '#E6F1FF', fontSize: 18, fontWeight: '600', lineHeight: 24 }}   >
                    {text}
                    <Text style={{ color: '#8b8383', fontSize: 18, fontWeight: '600' }}   >
                        {" " + "blablabla jhkjhjkh khkhkhkj"}
                    </Text>
                </Text>
            </View>
        </View>
    );
};

