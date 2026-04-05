import {useWindowDimensions} from 'react-native';

export function useScreenScale() {
  const screenSize = useWindowDimensions();
  const isLandscape = screenSize.width > screenSize.height;

  function scw(units: number) {
    return (screenSize.width / 100) * units;
  }

  function sch(units: number) {
    return (screenSize.height / 100) * units;
  }

  return {
    scw,
    sch,
    isLandscape,
    screenSize,
  };
}
