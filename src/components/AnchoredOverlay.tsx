import * as React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  findNodeHandle,
  UIManager,
  Dimensions,
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
  children: (api: { close: () => void }) => React.ReactNode;
};

const SCREEN_PADDING = 8;
const ANCHOR_GAP = 4;
const ESTIMATED_HEIGHT = 280;

export function AnchoredOverlay({ anchor, children }: Props) {
  const anchorRef = React.useRef<View>(null);

  const [open, setOpen] = React.useState(false);
  const [anchorLayout, setAnchorLayout] =
    React.useState<AnchorLayout | null>(null);

  const [overlaySize, setOverlaySize] =
    React.useState<{ width: number; height: number } | null>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    setOverlaySize(null);
  }, []);

  const measureAnchor = React.useCallback(() => {
    const node = findNodeHandle(anchorRef.current);
    if (!node) return;

    UIManager.measureInWindow(
      node,
      (x, y, width, height) => {
        setAnchorLayout({ x, y, width, height });
        setOpen(true);
      }
    );
  }, []);

  const openOverlay = React.useCallback(() => {
    requestAnimationFrame(measureAnchor);
  }, [measureAnchor]);

  const anchorNode = (
    <View ref={anchorRef} collapsable={false}>
      {anchor({ onPress: openOverlay })}
    </View>
  );

  if (!open || !anchorLayout) {
    return anchorNode;
  }

  const { width: screenW, height: screenH } =
    Dimensions.get("window");

  // ============================================================
  // Vertical positioning (как раньше, корректно)
  // ============================================================

  const spaceBelow =
    screenH -
    (anchorLayout.y + anchorLayout.height) -
    SCREEN_PADDING;

  const spaceAbove =
    anchorLayout.y - SCREEN_PADDING;

  const overlayHeight =
    overlaySize?.height ?? ESTIMATED_HEIGHT;

  let top: number;

  if (spaceBelow >= overlayHeight) {
    top = anchorLayout.y + anchorLayout.height + ANCHOR_GAP;
  } else if (spaceAbove >= overlayHeight) {
    top = anchorLayout.y - overlayHeight - ANCHOR_GAP;
  } else if (spaceBelow >= spaceAbove) {
    top = anchorLayout.y + anchorLayout.height + ANCHOR_GAP;
  } else {
    top = anchorLayout.y - overlayHeight - ANCHOR_GAP;
  }

  if (top < SCREEN_PADDING) {
    top = SCREEN_PADDING;
  }

  // ============================================================
  // Horizontal positioning — ТЕПЕРЬ ПО РЕАЛЬНОЙ ШИРИНЕ
  // ============================================================

  let left = SCREEN_PADDING;

  if (overlaySize) {
    const anchorCenterX =
      anchorLayout.x + anchorLayout.width / 2;

    left = anchorCenterX - overlaySize.width / 2;

    // clamp right
    if (left + overlaySize.width > screenW - SCREEN_PADDING) {
      left = screenW - overlaySize.width - SCREEN_PADDING;
    }

    // clamp left
    if (left < SCREEN_PADDING) {
      left = SCREEN_PADDING;
    }
  }

  // ============================================================

  return (
    <>
      {anchorNode}

      <Portal>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
        />

        <View
          style={[
            styles.overlay,
            {
              top,
              left,
              opacity: overlaySize ? 1 : 0,
            },
          ]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (!overlaySize) {
              setOverlaySize({ width, height });
            }
          }}
        >
          {children({ close })}
        </View>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    zIndex: 1000,
    elevation: 8,
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 8,
  },
});
