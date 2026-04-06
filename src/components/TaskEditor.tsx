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
import { Dropdown } from 'react-native-element-dropdown';
import { LearnTask } from '../helpers/getNextItemUid';

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
    const taskList = getAppSettingValue<LearnTask[]>('taskList');
    const selectedTask = getAppSettingValue<string>('selectedTask') || 'Default Task';
    const taskOptions = taskList.map(task => ({
        label: task.name,
        value: task.name,
    }));

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
                        <Text style={styles.sectionTitle}>Selected Task</Text>
                        <Dropdown
                            style={styles.dropdown}
                            containerStyle={styles.dropdownContainer}
                            activeColor={styles.activeItem.backgroundColor}
                            placeholderStyle={styles.dropdownText}
                            selectedTextStyle={styles.dropdownText}
                            itemTextStyle={styles.dropdownText}
                            itemContainerStyle={styles.dropdownItemContainer}
                            data={taskOptions}
                            labelField="label"
                            valueField="value"
                            value={selectedTask}
                            onChange={item => {
                                setAppSettingValue('selectedTask', item.value);
                                setSettingsVersion(prev => prev + 1);
                            }}
                        />
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
    dropdown: {
        borderWidth: 1,
        borderColor: '#777',
        borderRadius: 8,
        paddingHorizontal: 12,
        minHeight: 48,
        backgroundColor: '#1f1f1f',
    },
    dropdownContainer: {
        borderRadius: 8,
        backgroundColor: '#1f1f1f',
        borderWidth: 1,
        borderColor: '#777',
    },
    dropdownText: {
        fontSize: 16,
        color: '#f5f5f5',
    },
    dropdownItemContainer: {
        backgroundColor: '#1f1f1f',
    },
    activeItem: {
        backgroundColor: '#2c2c2c',
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
