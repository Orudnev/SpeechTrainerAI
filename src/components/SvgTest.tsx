import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Ellipse
} from "react-native-svg";

export default function MySvg() {
  return (
    <Svg width={1000} height={500} viewBox="0 0 500 250" >
      <Defs>
        <LinearGradient
          id="linearGradient4"
          x1="0"
          y1="32.898"
          x2="131.06"
          y2="32.898"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#283d62" />
          <Stop offset="0.22462" stopColor="#3f9498" />
          <Stop offset="0.52615" stopColor="#a5d8db" />
          <Stop offset="0.80615" stopColor="#3c6ab6" />
          <Stop offset="1" stopColor="#283d62" />
        </LinearGradient>
      </Defs>

      <Rect
        x={1.9157}
        y={1.7818}
        width={128.23}
        height={62.233}
        rx={5.2398}
        ry={4.9645}
        fill="none"
        stroke="url(#linearGradient4)"
        strokeWidth={1.8373}
      />

      <Ellipse 
        cx={68.602}
        cy={62.862}
        rx={40.177}
        ry={1.2755}
        fill="#7ed9e0"
        opacity={0.65}
      />

    </Svg>
  );
}