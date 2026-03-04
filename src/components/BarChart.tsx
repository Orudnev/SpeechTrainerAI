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

type BarChartItem = {
  bottomLabel: string;
  value: number;
};

type TBarChartProps = {
  title: string;
  width: number;
  height: number;
  data: BarChartItem[];
  colors: string[];
  colorStep: number;
};

export const BarChart: React.FC<TBarChartProps> = ({
  title,
  width,
  height,
  data,
  colors,
  colorStep
}) => {

  const maxValue = Math.max(...data.map(x => x.value));

  const topPadding = 20;
  const bottomPadding = 30;

  const chartHeight = height - bottomPadding - topPadding;

  const barWidth = 18;
  const gap = 8;

  const chartWidth = data.length * (barWidth + gap);

  const svgWidth = Math.max(width, chartWidth);

  return (
    <View>

      {/* TITLE (не скроллится) */}
      <RNText
        style={{
          fontSize: 16,
          textDecorationLine:"underline",          
          fontWeight: "600",
          color: "#e2e8f0",
          marginBottom: 8,
          textAlign:"center"
        }}
      >
        {title}
      </RNText>

      {/* SCROLLABLE CHART */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg
          width={svgWidth}
          height={height}
          viewBox={`0 0 ${svgWidth} ${height}`}
        >

          {/* GRID */}
          {[0.25, 0.5, 0.75, 1].map((p, i) => {

            const y = topPadding + chartHeight * (1 - p);

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

          {/* GRADIENTS */}
          <Defs>
            {data.map((item, i) => {

              const steps = Math.min(
                colors.length,
                Math.floor(item.value / colorStep) + 1
              );

              const usedColors = colors.slice(0, steps);

              return (
                <LinearGradient
                  key={i}
                  id={`grad${i}`}
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
              );
            })}
          </Defs>

          {/* BARS */}
          {data.map((item, i) => {

            const barHeight =
              (item.value / maxValue) * chartHeight;

            const x = i * (barWidth + gap);
            const y = topPadding + chartHeight - barHeight;

            const valueText =
              Math.round(item.value)
                .toString()
                .padStart(2, "0");

            const labelInside = barHeight > 22;

            return (
              <G key={i}>

                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={`url(#grad${i})`}
                />

                <Text
                  x={x + barWidth / 2}
                  y={labelInside ? y + 12 : y - 4}
                  fontSize="10"
                  fill={labelInside ? "#fff" : "#e2e8f0"}
                  textAnchor="middle"
                >
                  {valueText}
                </Text>

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
          })}

        </Svg>
      </ScrollView>
    </View>
  );
};