import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { Appbar, Chip } from 'react-native-paper';
import Toolbar from './Toolbar';
import {
    getAppSettingValue,
    loadAppSettingsFromDb,
    setAppSettingValue,
} from '../db/settings';
import { initSpeechDb, openSpeechDb } from '../db/speechDb';

export function TaskEditor() {
    const screenSize = useWindowDimensions();
    const [hasData, setHasData] = useState(false);
    const [topics, setTopics] = useState<string[]>([]);
    const [, setSettingsVersion] = useState(0);

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

    const selectedTopics = getAppSettingValue<string[]>('selectedTopics');
    const selectedTopicsSet = new Set(selectedTopics);

    function toggleTopic(topic: string) {
        const nextSelectedTopics = selectedTopicsSet.has(topic)
            ? selectedTopics.filter(currTopic => currTopic !== topic)
            : [...selectedTopics, topic];

        setAppSettingValue('selectedTopics', nextSelectedTopics);
        setSettingsVersion(prev => prev + 1);
    }

    return (
        <View style={[styles.root, { width: screenSize.width }]}>
            {!hasData && <Text>Loading task editor...</Text>}

            {hasData && (
                <>
                    <Toolbar>
                        <Appbar.Action icon="playlist-edit" disabled />
                    </Toolbar>
                    <ScrollView contentContainerStyle={styles.content}>
                        <Text style={styles.sectionTitle}>Selected Topics</Text>
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
                    </ScrollView>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 20,
        gap: 14,
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
});
