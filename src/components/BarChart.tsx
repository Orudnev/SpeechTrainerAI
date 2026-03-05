import React from "react";
import { ScrollView, View, Text as RNText } from "react-native";
import Svg, {
    Rect,
    Text,
    Defs,
    LinearGradient,
    Stop,
    G,
    Line
} from "react-native-svg";

export type TBarChartItem = {
    bottomLabel: string;
    value: number;
};

export type TBarChartDataItem = TBarChartItem | string;

type TBarChartProps = {
    title: string;
    width: number;
    height: number;
    data: TBarChartDataItem[];
    valueFormat:string;
    colors: string[];
    colorStep: number;
};

type TBarChartBarProps = {
    index: number;
    item: TBarChartItem;
    valueFormat:string;
    maxValue: number;
    barWidth: number;
    gap: number;
    topPadding: number;
    bottomPadding: number;
    chartHeight: number;
    height: number;
    colors: string[];
    colorStep: number;
};

export function formatNumber(value: number, format: string): string {
    const parts = format.split(".");
    const intDigits = parts[0].length;
    const fracDigits = parts.length > 1 ? parts[1].length : 0;

    const rounded = fracDigits > 0
        ? value.toFixed(fracDigits)
        : Math.round(value).toString();

    let [intPart, fracPart = ""] = rounded.split(".");

    intPart = intPart.padStart(intDigits, "0");

    if (fracDigits > 0) {
        fracPart = fracPart.padEnd(fracDigits, "0");
        return `${intPart}.${fracPart}`;
    }

    return intPart;
}

/* ============================
   BarChartBar
============================ */

const BarChartItem: React.FC<TBarChartBarProps> = ({
    index,
    item,
    valueFormat,
    maxValue,
    barWidth,
    gap,
    topPadding,
    chartHeight,
    height,
    colors,
    colorStep
}) => {

    const barHeight =
        (item.value / maxValue) * chartHeight;

    const x = index * (barWidth + gap);

    const y =
        topPadding + chartHeight - barHeight;

    // const valueText =
    //     Math.round(item.value)
    //         .toString()
    //         .padStart(2, "0");

    const labelInside = barHeight > 22;

    const steps = Math.min(
        colors.length,
        Math.floor(item.value / colorStep) + 1
    );

    const usedColors = colors.slice(0, steps);

    return (
        <G>

            <Defs>
                <LinearGradient
                    id={`grad${index}`}
                    x1="0"
                    y1="1"
                    x2="0"
                    y2="0"
                >
                    {usedColors.map((c, idx) => {

                        const offset =
                            usedColors.length === 1
                                ? 0
                                : idx / (usedColors.length - 1);

                        return (
                            <Stop
                                key={idx}
                                offset={offset}
                                stopColor={c}
                            />
                        );
                    })}
                </LinearGradient>
            </Defs>

            {/* BAR */}
            <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill={`url(#grad${index})`}
            />

            {/* VALUE */}
            <Text
                x={x + barWidth / 2}
                y={labelInside ? y + 12 : y - 4}
                fontSize="10"
                fill={labelInside ? "#fff" : "#e2e8f0"}
                textAnchor="middle"
            >
                {formatNumber(item.value,valueFormat)}
            </Text>

            {/* BOTTOM LABEL */}
            <Text
                x={x + barWidth / 2}
                y={height - 10}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="middle"
            >
                {item.bottomLabel}
            </Text>

        </G>
    );
};

type TVerticalLabelProps = {
    index: number;
    label: string;
    barWidth: number;
    gap: number;
    height: number;
};

const VerticalLabel: React.FC<TVerticalLabelProps> = ({
    index,
    label,
    barWidth,
    gap,
    height
}) => {

    const x = index * (barWidth + gap);

    return (
        <G>

            {/* background */}
            <Rect
                x={x}
                y={0}
                width={barWidth*1.2}
                height={height - 8}
                rx="4"
                stroke="#918e8e"
                opacity="1"
            />

            {/* vertical text */}
            <Text
                x={x + barWidth / 2}
                y={height / 2}
                fontSize="14"
                fill="#ffffff"
                textAnchor="middle"
                alignmentBaseline="middle"
                rotation="-90"
                origin={`${x + barWidth*1.2 / 2}, ${height / 2}`}
            >
                {label}
            </Text>

        </G>
    );
};

/* ============================
   BarChart
============================ */

export const BarChart: React.FC<TBarChartProps> = ({
    title,
    width,
    height,
    data,
    valueFormat,
    colors,
    colorStep
}) => {

    const maxValue =
        Math.max(...data.filter(itm => typeof (itm) !== 'string').map(x => x.value));

    const topPadding = 20;
    const bottomPadding = 30;

    const chartHeight =
        height - bottomPadding - topPadding;

    const barWidth = 18*(valueFormat.length-2)*0.5;
    const gap = 8;

    const chartWidth =
        data.length * (barWidth + gap);

    const svgWidth =
        Math.max(width, chartWidth);

    return (
        <View>

            {/* TITLE */}
            {title && (
            <RNText
                style={{
                    fontSize: 16,
                    textDecorationLine: "underline",
                    fontWeight: "600",
                    color: "#e2e8f0",
                    marginBottom: 8,
                    textAlign: "center"
                }}
            >
                {title}
            </RNText>
            )}

            {/* CHART */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
            >

                <Svg
                    width={svgWidth}
                    height={height}
                    viewBox={`0 0 ${svgWidth} ${height}`}
                >

                    {/* GRID */}
                    {[0.25, 0.5, 0.75, 1].map((p, i) => {

                        const y =
                            topPadding +
                            chartHeight * (1 - p);

                        return (
                            <Line
                                key={i}
                                x1="0"
                                x2={svgWidth}
                                y1={y}
                                y2={y}
                                stroke="#334155"
                                strokeWidth="1"
                                opacity="0.3"
                            />
                        );
                    })}

                    {/* BARS */}
                    {data.map((item, i) => {
                        if (typeof (item) !== 'string') {
                            return (
                                <BarChartItem
                                    key={i}
                                    index={i}
                                    item={item}
                                    valueFormat={valueFormat}
                                    maxValue={maxValue}
                                    barWidth={barWidth}
                                    gap={gap}
                                    topPadding={topPadding}
                                    bottomPadding={bottomPadding}
                                    chartHeight={chartHeight}
                                    height={height}
                                    colors={colors}
                                    colorStep={colorStep}
                                />)
                        }
                        return (
                            <VerticalLabel
                                key={i}
                                index={i}
                                label={item}
                                barWidth={barWidth}
                                gap={gap}
                                height={height}
                            />
                        );
                    })}
                </Svg>

            </ScrollView>

        </View>
    );
};