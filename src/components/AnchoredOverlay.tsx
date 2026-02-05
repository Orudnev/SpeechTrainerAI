import * as React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  findNodeHandle,
  UIManager,
} from "react-native";
import { Portal } from "react-native-paper";

type AnchorLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  anchor: (props: { onPress: () => void }) => React.ReactNode;
  children: React.ReactNode;
};

export function AnchoredOverlay({ anchor, children }: Props) {
  const anchorRef = React.useRef<View>(null);

  const [open, setOpen] = React.useState(false);
  const [layout, setLayout] = React.useState<AnchorLayout | null>(null);

  const measureAnchor = React.useCallback(() => {
    const node = findNodeHandle(anchorRef.current);
    if (!node) return;

    UIManager.measureInWindow(
      node,
      (x, y, width, height) => {
        if (
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(width) &&
          Number.isFinite(height)
        ) {
          setLayout({ x, y, width, height });
          setOpen(true);
        }
      }
    );
  }, []);

  const openOverlay = () => {
    console.log("OPENING OVERLAY");
    requestAnimationFrame(measureAnchor);
  };

  const closeOverlay = () => setOpen(false);

  return (
    <>
      {/* Anchor wrapper — реальный native View */}
      <View ref={anchorRef} collapsable={false}>
        {anchor({ onPress: openOverlay })}
      </View>

      {/* Overlay */}
      {open && layout && (
        <Portal>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeOverlay}
          />

          <View
            style={[
              styles.overlay,
              {
                top: layout.y + layout.height,
                left: layout.x,
              },
            ]}
          >
            {children}
          </View>
        </Portal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    zIndex: 1000,
    elevation: 8,
  },
});
