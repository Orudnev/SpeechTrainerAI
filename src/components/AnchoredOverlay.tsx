import * as React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
} from "react-native";
import { Portal } from "react-native-paper";

type Props = {
  anchor: (props: { onPress: () => void }) => React.ReactNode;
  children: React.ReactNode;
};

// ============================================================
// Layout constants
// ============================================================
const SCREEN_WIDTH = Dimensions.get("window").width;
const HORIZONTAL_MARGIN = 8;
const OVERLAY_WIDTH = Math.min(320, SCREEN_WIDTH - HORIZONTAL_MARGIN * 2);
const APPBAR_HEIGHT = 56; // стандарт Material AppBar

export function AnchoredOverlay({ anchor, children }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Anchor (only for triggering) */}
      {anchor({ onPress: () => setOpen(true) })}

      {open && (
        <Portal>
          {/* Backdrop */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />

          {/* Overlay — FIXED POSITION */}
          <View
            style={[
              styles.overlay,
              {
                top: APPBAR_HEIGHT,
                right: HORIZONTAL_MARGIN,
                width: OVERLAY_WIDTH,
              },
            ]}
          >
            <View style={styles.overlayContainer}>
              {children}
            </View>
          </View>
        </Portal>
      )}
    </>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    zIndex: 1000,
    elevation: 12,
  },

  overlayContainer: {
    backgroundColor: "#121212",
    borderRadius: 12,
    padding: 8,

    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
