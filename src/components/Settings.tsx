import React, { useEffect, useMemo, useState, useContext } from "react";
import {
    View,
    Text,
    StyleSheet,
    useWindowDimensions,
    Button,
    Image
} from "react-native";
import Toolbar from "./Toolbar";
import { Appbar } from "react-native-paper";
import { AppContext } from "../../App";

export function Settings() {
    const screenSize = useWindowDimensions();
    const ctx = useContext(AppContext);
    let hasData = true;
    return (
        <View style={[styles.settingsRoot,{width:screenSize.width}]}>
            {!hasData && <Text>Loading settings...</Text>}

            {hasData && (
                <>
                    <Toolbar>
                        <Appbar.Action
                            icon="location-exit"
                            onPress={() => { ctx?.setCurrPage("main") }}
                        />
                    </Toolbar>
                    <View style={styles.content}>
                        <Text>blablabla</Text>
                    </View>
                </>
            )}
        </View>
    );
}

// ============================================================
const styles = StyleSheet.create({
    settingsRoot: {
        flex: 1,
    },
    content: {
        paddingLeft: 20,
    },
});

