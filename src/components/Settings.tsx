import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    useWindowDimensions,
    ScrollView,
    Alert,
} from 'react-native';
import Toolbar from './Toolbar';
import { Appbar, Button, Switch, TextInput, SegmentedButtons } from 'react-native-paper';
import {
    getAppSettingValue,
    loadAppSettingsFromDb,
    setAppSettingValue,
} from '../db/settings';
import { initSpeechDb } from '../db/speechDb';
import { synchCloudToLocal, synchLocalToCloud } from '../debug/debugCommands';

export function Settings() {
    const screenSize = useWindowDimensions();
    const [hasData, setHasData] = useState(false);
    const [, setSettingsVersion] = useState(0);
    const [commandStage, setCommandStage] = useState<'idle' | 'processing'>('idle');
    const [asrModelType, setAsrModelType] = useState(getAppSettingValue<string>('asrModelType'));
    useEffect(() => {
        async function load() {
            await initSpeechDb();
            await loadAppSettingsFromDb();
            setHasData(true);
            setSettingsVersion(prev => prev + 1);
        }

        load();
    }, []);

    const reverseMode = getAppSettingValue<boolean>('reverseMode');
    const fullAccess = getAppSettingValue<boolean>('fullAccess');
    const openAiApiKey = getAppSettingValue<string>('openAiApiKey');
    const rowsCloudDataSource = getAppSettingValue<string>('rowsCloudDataSource');

    return (
        <View style={[styles.settingsRoot, { width: screenSize.width }]}>
            {!hasData && <Text>Loading settings...</Text>}

            {hasData && (
                <>
                    <Toolbar>
                        <Appbar.Action icon="cog-outline" disabled />
                    </Toolbar>
                    <ScrollView contentContainerStyle={styles.content}>
                        <View style={styles.labelWithControl}>
                            <Text style={styles.label}>ASR engine</Text>
                            <SegmentedButtons
                                style={{ width: 300 }}
                                value={asrModelType}
                                onValueChange={(newValue) => {
                                    setAsrModelType(newValue);
                                    setAppSettingValue('asrModelType', newValue);
                                }}
                                buttons={[
                                    {
                                        value: 'vosk',
                                        label: 'Vosk',
                                    },
                                    {
                                        value: 'openai',
                                        label: 'OpenAI',
                                    },
                                    {
                                        value: 'android',
                                        label: 'Android',
                                    },
                                ]}
                            />
                        </View>
                        {asrModelType === 'openai' && (
                            <>
                                <Text style={styles.sectionTitle}>OpenAI API key</Text>
                                <TextInput
                                    mode="outlined"
                                    value={openAiApiKey}
                                    onChangeText={text => {
                                        setAppSettingValue('openAiApiKey', text);
                                        setSettingsVersion(prev => prev + 1);
                                    }}
                                    placeholder="sk-..."
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    secureTextEntry
                                />
                            </>
                        )}
                        <View style={styles.rowBetween}>
                            <Text style={styles.label}>reverseMode</Text>
                            <Switch
                                value={reverseMode}
                                onValueChange={value => {
                                    setAppSettingValue('reverseMode', value);
                                    setSettingsVersion(prev => prev + 1);
                                }}
                            />
                        </View>

                        {fullAccess && (
                            <>
                                <Text style={styles.sectionTitle}>rowsCloudDataSource</Text>
                                <TextInput
                                    mode="outlined"
                                    value={rowsCloudDataSource}
                                    onChangeText={text => {
                                        setAppSettingValue('rowsCloudDataSource', text);
                                        setSettingsVersion(prev => prev + 1);
                                    }}
                                    placeholder="https://example.com/source.json"
                                />

                                <View style={styles.actionsRow}>
                                    <Button mode="contained-tonal" onPress={async () => {
                                        setCommandStage('processing');
                                        try {
                                            await synchCloudToLocal();
                                            Alert.alert('Success', 'Data from the Cloud synchonized to local database');
                                        } catch (err: any) {
                                            Alert.alert('Error', `Failed to upload data to cloud: ${err.message}`);
                                            return;
                                        }
                                        finally {
                                            setCommandStage('idle');
                                        }
                                    }}>
                                        {commandStage === 'idle' ? 'Synchronize Local db from Cloud' : '.........  processing  ...........'}
                                    </Button>
                                    <Button mode="contained-tonal" onPress={async () => {
                                        setCommandStage('processing');
                                        try {
                                            await synchLocalToCloud();
                                            Alert.alert('Success', 'Data uploaded to cloud successfully');
                                        } catch (err: any) {
                                            Alert.alert('Error', `Failed to upload data to cloud: ${err.message}`);
                                            return;
                                        }
                                        finally {
                                            setCommandStage('idle');
                                        }

                                    }}>
                                        {commandStage === 'idle' ? 'Upload Local db to Cloud' : '.........  processing  ...........'}
                                    </Button>
                                </View>
                            </>
                        )}
                    </ScrollView>
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
        paddingRight: 20,
        paddingBottom: 20,
        gap: 14,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    labelWithControl: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
    },
    label: {
        fontSize: 18,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    actionsRow: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
});
