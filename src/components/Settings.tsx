import React, { useEffect, useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    useWindowDimensions,
    ScrollView,
    Alert,
} from 'react-native';
import Toolbar from './Toolbar';
import { Appbar, Button, Chip, Switch, TextInput, SegmentedButtons } from 'react-native-paper';
import { AppContext } from '../../App';
import {
    getAppSettingValue,
    loadAppSettingsFromDb,
    saveAppSettingsToDb,
    setAppSettingValue,
} from '../db/settings';
import { initSpeechDb, loadAllPhrases, openSpeechDb, syncPhrasesRows } from '../db/speechDb';
import { ReceiveAllRowsFromCloud, SendDatabaseToCloud } from '../helpers/webApiWrapper';
import { synchCloudToLocal, synchLocalToCloud } from '../debug/debugCommands';

export function Settings() {
    const screenSize = useWindowDimensions();
    const ctx = useContext(AppContext);

    const [hasData, setHasData] = useState(false);
    const [topics, setTopics] = useState<string[]>([]);
    const [, setSettingsVersion] = useState(0);
    const [commandStage, setCommandStage] = useState<'idle' | 'processing'>('idle');
    const [asrModelType, setAsrModelType] = useState(getAppSettingValue<string>('asrModelType'));
    useEffect(() => {
        async function load() {
            await initSpeechDb();
            await loadAppSettingsFromDb();
            const db = await openSpeechDb();
            const res = await db.executeSql(
                `SELECT DISTINCT topic FROM phrases ORDER BY topic;`,
            );

            const dbTopics: string[] = [];
            for (let i = 0; i < res[0].rows.length; i++) {
                const row = res[0].rows.item(i);
                if (typeof row.topic === 'string' && row.topic.trim()) {
                    dbTopics.push(row.topic);
                }
            }

            setTopics(dbTopics);
            setHasData(true);
            setSettingsVersion(prev => prev + 1);
        }

        load();
    }, []);

    const reverseMode = getAppSettingValue<boolean>('reverseMode');
    const fullAccess = getAppSettingValue<boolean>('fullAccess');
    const openAiApiKey = getAppSettingValue<string>('openAiApiKey');
    const rowsCloudDataSource = getAppSettingValue<string>('rowsCloudDataSource');
    const selectedTopics = getAppSettingValue<string[]>('selectedTopics');
    const selectedTopicsSet = new Set(selectedTopics);

    function toggleTopic(topic: string) {
        const nextSelectedTopics = selectedTopicsSet.has(topic)
            ? selectedTopics.filter(currTopic => currTopic !== topic)
            : [...selectedTopics, topic];

        setAppSettingValue('selectedTopics', nextSelectedTopics);
        setSettingsVersion(prev => prev + 1);
    }

    async function persistSettingsAndExit() {
        await saveAppSettingsToDb();
        ctx?.setCurrPage('main');
    }

    return (
        <View style={[styles.settingsRoot, { width: screenSize.width }]}>
            {!hasData && <Text>Loading settings...</Text>}

            {hasData && (
                <>
                    <Toolbar>
                        <Appbar.Action
                            icon="location-exit"
                            onPress={() => {
                                persistSettingsAndExit().catch(err => {
                                    console.warn('Failed to save app settings', err);
                                });
                            }}
                        />
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

                        <Text style={styles.sectionTitle}>selectedTopics</Text>
                        <View style={styles.chipWrap}>
                            {topics.map(topic => (
                                <Chip
                                    key={topic}
                                    selected={selectedTopicsSet.has(topic)}
                                    onPress={() => toggleTopic(topic)}
                                    style={styles.topicChip}>
                                    {topic}
                                </Chip>
                            ))}
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
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    topicChip: {
        marginRight: 8,
        marginBottom: 8,
    },
    actionsRow: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
});
