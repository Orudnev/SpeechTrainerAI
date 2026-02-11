import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  DeviceEventEmitter,
  Button,
  Pressable,
  ScrollView,
} from "react-native";
import { VariantStat } from "./SpeechTrainerPhrase";


type TVariantPickerProps = {
  variantsFromDatabase: string[];
  variantsFromASR: VariantStat[];
  onSave: (selected: string[]) => void;
  onCancel: () => void;
};

export function VariantPicker({
  variantsFromDatabase,
  variantsFromASR,
  onSave,
  onCancel,
}: TVariantPickerProps) {
  // --------------------------------------------
  // preselect сохранённые варианты
  // --------------------------------------------
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(variantsFromDatabase)
  );

  function toggleVariant(text: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(text) ? next.delete(text) : next.add(text);
      return next;
    });
  }

  // --------------------------------------------
  // объединённый список (ASR + DB)
  // --------------------------------------------
  const combinedVariantList: VariantStat[] = useMemo(() => {
    const map = new Map<string, VariantStat>();

    // ASR варианты
    for (const v of variantsFromASR) {
      map.set(v.text, v);
    }

    // сохранённые варианты
    for (const sv of variantsFromDatabase) {
      if (!map.has(sv)) {
        map.set(sv, { text: sv, count: 999 });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [variantsFromASR, variantsFromDatabase]);

  // --------------------------------------------
  // render
  // --------------------------------------------
  return (
    <View style={styles.variantBox}>
      <ScrollView style={styles.variantScroll}>
        {combinedVariantList.length === 0 && (
          <Text style={{ padding: 8 }}>
            Нет вариантов
          </Text>
        )}

        {combinedVariantList.map((v) => {
          const checked = selected.has(v.text);
          const isSaved = variantsFromDatabase.includes(v.text);

          return (
            <Pressable
              key={v.text}
              style={[
                styles.variantRow,
                checked && styles.variantRowSelected,
              ]}
              onPress={() => toggleVariant(v.text)}
            >
              <Text style={styles.variantText}>
                {checked ? "✅" : "⬜"} {v.text}
                {isSaved && " ⭐"}
                {!isSaved && v.count !== 999 && ` (${v.count})`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Buttons */}
      <View style={styles.variantButtons}>
        <Button title="Cancel" onPress={onCancel} />
        <Button 
          title="Save" 
          onPress={() => onSave(Array.from(selected))}
          disabled={selected.size === 0}
        />
      </View>
    </View>
  );
}




// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({

  // Variant picker styles
  variantBox: {
    // marginTop: 20,
    // padding: 12,
    // borderWidth: 1,
    // borderRadius: 12,
  },
  variantTitle: {
    fontWeight: "800",
    fontSize: 16,
  },
  variantScroll: {
    backgroundColor: "#000",
    flexGrow: 1,
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 8,},
  variantRow: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  variantRowSelected: {
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  variantText: {
    fontSize: 16,
  },
  variantButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap:12
  },
  overlay: {
    position: "absolute",
    zIndex: 1000,
  },
  menu: {
    width: 200,
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    paddingVertical: 8,
    elevation: 8, // Android
  },
  menuitem: {
    padding: 12,
    color: "white",
  },

});
