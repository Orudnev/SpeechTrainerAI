import React from "react";
import { TouchableOpacity, View } from "react-native";

import Svg, {
    Rect,
    Text,
    Defs,
    LinearGradient,
    Stop,
    G,
    Polygon,
    Path
} from "react-native-svg";


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




type SvgButtonProps = {
    title: string;
    iconId: keyof typeof ICONS;
    width?: number;
    height?: number;
    onPress: () => void;
};

export const SvgButton: React.FC<SvgButtonProps> = ({
    title,
    iconId,
    width = 150,
    height = 50,
    onPress
}) => {

    const Icon = ICONS[iconId];

    return (
        <View style={{ width }} >
            <TouchableOpacity onPress={onPress} >
                <Svg width="100%" height={height} viewBox="0 0 200 70">

                    <Defs>
                        <LinearGradient id="borderGradient" y2="100%">
                            <Stop offset="0" stopColor="#00f0ff" />
                            <Stop offset="0.5" stopColor="#ffffff" />
                            <Stop offset="1" stopColor="#08e6ff" />
                        </LinearGradient>

                        <LinearGradient id="buttonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0" stopColor="#4d7a9e" />
                            <Stop offset="0.4" stopColor="#0b1725" />
                            <Stop offset="0.6" stopColor="#0b1725" />
                            <Stop offset="1" stopColor="#4d7a9e" />
                        </LinearGradient>
                    </Defs>

                    {/* button background */}
                    <Rect
                        x="0"
                        y="0"
                        width="200"
                        height="70"
                        rx="16"
                        fill="url(#buttonGradient)"
                        stroke="url(#borderGradient)"
                        strokeWidth="3"
                    />

                    {/* icon */}
                    <G x="30" y="25">
                        <Icon />
                    </G>

                    {/* text */}
                    <Text
                        x="80"
                        y="35"
                        fill="#fff"
                        fontSize="15"
                        alignmentBaseline="middle"
                    >
                        {title}
                    </Text>

                </Svg>
            </TouchableOpacity>
        </View>
    );
};