import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type LayoutChangeEvent,
    useWindowDimensions,
} from 'react-native';
import { Appbar, Button, Chip, DataTable, TextInput } from 'react-native-paper';
import Toolbar from './Toolbar';
import {
    getAppSettingValue,
    loadAppSettingsFromDb,
    saveAppSettingsToDb,
    setAppSettingValue,
} from '../db/settings';
import { initSpeechDb, loadAllPhrases, openSpeechDb, SpItem } from '../db/speechDb';
import { Dropdown } from 'react-native-element-dropdown';
import {
    convertToTaskDisplayItem,
    CreateTask,
    LearnTask,
    TaskDisplayItem,
} from '../helpers/getNextItemUid';

type TaskSliderProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    onComplete?: () => void;
};

function clampSliderValue(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getPreviewText(value: string, maxLength: number) {
    return value.length > maxLength
        ? `${value.slice(0, maxLength)}...`
        : value;
}

function buildTaskPreviewData(
    items: SpItem[],
    selectedTopics: string[],
    plannedDayItemCount: number,
    maxFreshItemCount: number,
    isReverse: boolean,
): TaskDisplayItem[] {
    const now = Date.now();
    const selectedTopicItems = items.filter(
        item => selectedTopics.length === 0 || selectedTopics.includes(item.topic),
    );

    return CreateTask(
        selectedTopicItems,
        plannedDayItemCount,
        maxFreshItemCount,
        isReverse,
    ).map(item => convertToTaskDisplayItem(item, false, now));
}

function buildTaskItems(
    items: SpItem[],
    selectedTopics: string[],
    plannedDayItemCount: number,
    maxFreshItemCount: number,
    isReverse: boolean,
): SpItem[] {
    const selectedTopicItems = items.filter(
        item => selectedTopics.length === 0 || selectedTopics.includes(item.topic),
    );

    return CreateTask(
        selectedTopicItems,
        plannedDayItemCount,
        maxFreshItemCount,
        isReverse,
    );
}

function TaskSlider({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
    onComplete,
}: TaskSliderProps) {
    const [trackWidth, setTrackWidth] = useState(0);

    function updateValue(locationX: number) {
        if (trackWidth <= 0) {
            return;
        }

        const ratio = clampSliderValue(locationX / trackWidth, 0, 1);
        const rawValue = min + ratio * (max - min);
        const steppedValue = Math.round(rawValue / step) * step;
        onChange(clampSliderValue(steppedValue, min, max));
    }

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: event => {
                    updateValue(event.nativeEvent.locationX);
                },
                onPanResponderMove: event => {
                    updateValue(event.nativeEvent.locationX);
                },
                onPanResponderRelease: () => {
                    onComplete?.();
                },
                onPanResponderTerminate: () => {
                    onComplete?.();
                },
            }),
        [max, min, onComplete, step, trackWidth],
    );

    function handleTrackLayout(event: LayoutChangeEvent) {
        setTrackWidth(event.nativeEvent.layout.width);
    }

    const ratio = max === min ? 0 : (value - min) / (max - min);

    return (
        <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>{label}</Text>
                <Text style={styles.sliderValue}>{value}</Text>
            </View>
            <View
                style={styles.sliderTouchArea}
                onLayout={handleTrackLayout}
                {...panResponder.panHandlers}>
                <View style={styles.sliderTrack}>
                    <View
                        style={[
                            styles.sliderFill,
                            { width: `${clampSliderValue(ratio * 100, 0, 100)}%` },
                        ]}
                    />
                    <View
                        style={[
                            styles.sliderThumb,
                            { left: `${clampSliderValue(ratio * 100, 0, 100)}%` },
                        ]}
                    />
                </View>
            </View>
        </View>
    );
}

export function TaskEditor() {
    const screenSize = useWindowDimensions();
    const [hasData, setHasData] = useState(false);
    const [topics, setTopics] = useState<string[]>([]);
    const [allItems, setAllItems] = useState<SpItem[]>([]);
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [taskList, setTaskList] = useState<LearnTask[]>([]);
    const [selectedTaskName, setSelectedTaskName] = useState('Default Task');
    const [plannedDayItemCountInput, setPlannedDayItemCountInput] = useState(0);
    const [maxFreshItemCountInput, setMaxFreshItemCountInput] = useState(0);
    const [tableData, setTableData] = useState<TaskDisplayItem[]>([]);
    const [isPreviewDirty, setIsPreviewDirty] = useState(false);
    const [showSaveAs, setShowSaveAs] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [saveAsError, setSaveAsError] = useState('');
    const [isReverse, setIsReverse] = useState(false);
    const selectedTopicsRef = useRef<string[]>([]);
    const taskListRef = useRef<LearnTask[]>([]);
    const selectedTaskRef = useRef('Default Task');
    const plannedDayItemCountInputRef = useRef(0);
    const maxFreshItemCountInputRef = useRef(0);
    const isLoadedRef = useRef(false);

    function syncTaskSettings(nextTaskList: LearnTask[], nextSelectedTask: string) {
        let nextTask = nextTaskList.find(task => task.name === nextSelectedTask);
        if (nextTask) {
            nextTask.indf = 0; 
            nextTask.indr = 0;
        }
        setAppSettingValue('taskList', nextTaskList);
        setAppSettingValue('selectedTaskName', nextSelectedTask);
    }

    function persistTaskSettings(nextTaskList: LearnTask[], nextSelectedTask: string) {
        syncTaskSettings(nextTaskList, nextSelectedTask);
        void saveAppSettingsToDb().catch(err => {
            console.warn('Failed to save task editor settings', err);
        });
    }

    function formatScheduledTime(date: Date): string {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            throw new Error('Параметр должен быть валидной датой');
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const dayMonth = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}.${month} ${hours}:${minutes}`;
    }

    async function persistTaskSettingsAndWait(
        nextTaskList: LearnTask[],
        nextSelectedTask: string,
    ) {
        syncTaskSettings(nextTaskList, nextSelectedTask);
        try {
            await saveAppSettingsToDb();
        } catch (err) {
            console.warn('Failed to save task editor settings', err);
        }
    }

    useEffect(() => {
        async function load() {
            await initSpeechDb();
            await loadAppSettingsFromDb();
            const loadedTaskList = getAppSettingValue<LearnTask[]>('taskList');
            const loadedSelectedTask =
                getAppSettingValue<string>('selectedTaskName') || 'Default Task';
            const loadedReverseMode = getAppSettingValue<boolean>('reverseMode');
            const loadedCurrentTask = loadedTaskList.find(
                task => task.name === loadedSelectedTask,
            );
            const loadedSelectedTopics = loadedCurrentTask?.selectedTopics ?? [];

            setSelectedTopics(loadedSelectedTopics);
            setTaskList(loadedTaskList);
            setSelectedTaskName(loadedSelectedTask);
            setIsReverse(loadedReverseMode);
            setPlannedDayItemCountInput(loadedCurrentTask?.plannedDayItemCount ?? 0);
            setMaxFreshItemCountInput(loadedCurrentTask?.maxFreshItemCount ?? 0);
            plannedDayItemCountInputRef.current =
                loadedCurrentTask?.plannedDayItemCount ?? 0;
            maxFreshItemCountInputRef.current =
                loadedCurrentTask?.maxFreshItemCount ?? 0;
            selectedTopicsRef.current = loadedSelectedTopics;
            taskListRef.current = loadedTaskList;
            selectedTaskRef.current = loadedSelectedTask;

            const db = await openSpeechDb();
            const res = await db.executeSql(
                `SELECT DISTINCT topic FROM phrases ORDER BY topic;`,
            );
            const loadedItems = await loadAllPhrases();

            const dbTopics: string[] = [];
            for (let i = 0; i < res[0].rows.length; i++) {
                const row = res[0].rows.item(i);
                if (typeof row.topic === 'string' && row.topic.trim()) {
                    dbTopics.push(row.topic);
                }
            }
            setTopics(dbTopics);
            setAllItems(loadedItems);
            const initialTaskItems = buildTaskItems(
                loadedItems,
                loadedSelectedTopics,
                loadedCurrentTask?.plannedDayItemCount ?? 0,
                loadedCurrentTask?.maxFreshItemCount ?? 0,
                loadedReverseMode,
            );
            const nextTaskList = applyTaskFieldDrafts(
                loadedTaskList,
                loadedSelectedTask,
                loadedSelectedTopics,
                loadedCurrentTask?.plannedDayItemCount ?? 0,
                loadedCurrentTask?.maxFreshItemCount ?? 0,
                initialTaskItems.map(item => item.uid),
            );
            setTaskList(nextTaskList);
            taskListRef.current = nextTaskList;
            syncTaskSettings(nextTaskList, loadedSelectedTask);
            setTableData(
                initialTaskItems.map(item => convertToTaskDisplayItem(item, false, Date.now())),
            );
            setIsPreviewDirty(false);
            setHasData(true);
            isLoadedRef.current = true;
        }

        load();

        return () => {
            if (!isLoadedRef.current) {
                return;
            }

            const committedTaskList = applyTaskFieldDrafts(
                taskListRef.current,
                selectedTaskRef.current,
                selectedTopicsRef.current,
                plannedDayItemCountInputRef.current,
                maxFreshItemCountInputRef.current,
            );
            persistTaskSettings(committedTaskList, selectedTaskRef.current);
        };
    }, []);

    const selectedTopicsSet = new Set(selectedTopics);
    const currentTask = taskList.find(task => task.name === selectedTaskName);
    const taskOptions = useMemo(
        () =>
            taskList.map(task => ({
                label: task.name,
                value: task.name,
            })),
        [taskList],
    );

    function toggleTopic(topic: string) {
        const nextSelectedTopics = selectedTopicsSet.has(topic)
            ? selectedTopics.filter(currTopic => currTopic !== topic)
            : [...selectedTopics, topic];

        setSelectedTopics(nextSelectedTopics);
        selectedTopicsRef.current = nextSelectedTopics;
        setIsPreviewDirty(true);
    }

    function applyTaskFieldDrafts(
        sourceTaskList: LearnTask[],
        taskName: string,
        nextSelectedTopics: string[],
        nextPlannedDayItemCountInput: number,
        nextMaxFreshItemCountInput: number,
        nextItemUids?: string[],
    ): LearnTask[] {
        return sourceTaskList.map(task =>
            task.name === taskName
                ? {
                    ...task,
                    selectedTopics: [...nextSelectedTopics],
                    plannedDayItemCount: nextPlannedDayItemCountInput,
                    maxFreshItemCount: nextMaxFreshItemCountInput,
                    itemUids: nextItemUids ? [...nextItemUids] : [...task.itemUids],
                }
                : task,
        );
    }

    function commitCurrentTaskDraft(
        nextSelectedTaskName: string = selectedTaskName,
    ) {
        const nextTaskList = applyTaskFieldDrafts(
            taskListRef.current,
            selectedTaskRef.current,
            selectedTopicsRef.current,
            plannedDayItemCountInputRef.current,
            maxFreshItemCountInputRef.current,
        );

        setTaskList(nextTaskList);
        taskListRef.current = nextTaskList;
        syncTaskSettings(nextTaskList, selectedTaskRef.current);
        const nextCurrentTask = nextTaskList.find(task => task.name === nextSelectedTaskName);
        const nextSelectedTopics = [...(nextCurrentTask?.selectedTopics ?? [])];
        const nextPlanned = nextCurrentTask?.plannedDayItemCount ?? 0;
        const nextFresh = nextCurrentTask?.maxFreshItemCount ?? 0;
        setSelectedTopics(nextSelectedTopics);
        setPlannedDayItemCountInput(nextPlanned);
        setMaxFreshItemCountInput(nextFresh);
        selectedTopicsRef.current = nextSelectedTopics;
        plannedDayItemCountInputRef.current = nextPlanned;
        maxFreshItemCountInputRef.current = nextFresh;
    }

    function refreshTaskPreview(
        nextSelectedTopics: string[] = selectedTopicsRef.current,
        nextPlannedDayItemCount: number = plannedDayItemCountInputRef.current,
        nextMaxFreshItemCount: number = maxFreshItemCountInputRef.current,
        taskName: string = selectedTaskRef.current,
    ) {
        const nextTaskItems = buildTaskItems(
            allItems,
            nextSelectedTopics,
            nextPlannedDayItemCount,
            nextMaxFreshItemCount,
            isReverse,
        );
        setTableData(
            nextTaskItems.map(item => convertToTaskDisplayItem(item, false, Date.now())),
        );
        const nextTaskList = applyTaskFieldDrafts(
            taskListRef.current,
            taskName,
            nextSelectedTopics,
            nextPlannedDayItemCount,
            nextMaxFreshItemCount,
            nextTaskItems.map(item => item.uid),
        );
        setTaskList(nextTaskList);
        taskListRef.current = nextTaskList;
        persistTaskSettings(nextTaskList, taskName);
        setIsPreviewDirty(false);
    }

    function applyTaskPreview() {
        refreshTaskPreview(selectedTopics, plannedDayItemCountInputRef.current, maxFreshItemCountInputRef.current);
    }

    function applyTaskPreviewForValues(
        nextSelectedTopics: string[],
        nextPlannedDayItemCount: number,
        nextMaxFreshItemCount: number,
        taskName: string = selectedTaskRef.current,
    ) {
        const nextTaskItems = buildTaskItems(
            allItems,
            nextSelectedTopics,
            nextPlannedDayItemCount,
            nextMaxFreshItemCount,
            isReverse,
        );
        setTableData(
            nextTaskItems.map(item => convertToTaskDisplayItem(item, false, Date.now())),
        );
        const nextTaskList = applyTaskFieldDrafts(
            taskListRef.current,
            taskName,
            nextSelectedTopics,
            nextPlannedDayItemCount,
            nextMaxFreshItemCount,
            nextTaskItems.map(item => item.uid),
        );
        setTaskList(nextTaskList);
        taskListRef.current = nextTaskList;
        syncTaskSettings(nextTaskList, taskName);
        setIsPreviewDirty(false);
    }

    function saveTaskAs() {
        const trimmedTaskName = newTaskName.trim();
        if (!trimmedTaskName) {
            setSaveAsError('Task name is required.');
            return;
        }

        if (taskList.some(task => task.name === trimmedTaskName)) {
            setSaveAsError('Task with this name already exists.');
            return;
        }

        const nextTask: LearnTask = {
            name: trimmedTaskName,
            selectedTopics: [...selectedTopicsRef.current],
            plannedDayItemCount: plannedDayItemCountInputRef.current,
            maxFreshItemCount: maxFreshItemCountInputRef.current,
            indf: 0,
            indr: 0,
            itemUids: [...(currentTask?.itemUids ?? [])],
        };
        const nextTaskList = [...taskListRef.current, nextTask];

        setTaskList(nextTaskList);
        taskListRef.current = nextTaskList;
        setSelectedTaskName(trimmedTaskName);
        selectedTaskRef.current = trimmedTaskName;
        persistTaskSettings(nextTaskList, trimmedTaskName);
        setShowSaveAs(false);
        setNewTaskName('');
        setSaveAsError('');
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
                            value={selectedTaskName}
                            onChange={async item => {
                                commitCurrentTaskDraft(item.value);
                                setSelectedTaskName(item.value);
                                selectedTaskRef.current = item.value;
                                await persistTaskSettingsAndWait(
                                    taskListRef.current,
                                    item.value,
                                );
                                const nextTask = taskListRef.current.find(
                                    task => task.name === item.value,
                                );
                                applyTaskPreviewForValues(
                                    nextTask?.selectedTopics ?? [],
                                    nextTask?.plannedDayItemCount ?? 0,
                                    nextTask?.maxFreshItemCount ?? 0,
                                    item.value,
                                );
                            }}
                        />
                        {currentTask && (
                            <>
                                <Text style={styles.sectionTitle}>Task Limits</Text>
                                <TaskSlider
                                    label="Planned day item count"
                                    value={plannedDayItemCountInput}
                                    min={0}
                                    max={100}
                                    onChange={value => {
                                        setPlannedDayItemCountInput(value);
                                        plannedDayItemCountInputRef.current = value;
                                        setIsPreviewDirty(true);
                                    }}
                                    onComplete={() => commitCurrentTaskDraft()}
                                />
                                <TaskSlider
                                    label="Max fresh item count"
                                    value={maxFreshItemCountInput}
                                    min={0}
                                    max={50}
                                    onChange={value => {
                                        setMaxFreshItemCountInput(value);
                                        maxFreshItemCountInputRef.current = value;
                                        setIsPreviewDirty(true);
                                    }}
                                    onComplete={() => commitCurrentTaskDraft()}
                                />
                                <View style={styles.previewActions}>
                                    <Button
                                        mode="contained"
                                        disabled={!isPreviewDirty}
                                        onPress={applyTaskPreview}>
                                        Apply
                                    </Button>
                                    <Button
                                        mode="contained-tonal"
                                        onPress={() => {
                                            setShowSaveAs(prev => !prev);
                                            setSaveAsError('');
                                        }}>
                                        Save as
                                    </Button>
                                    <Button
                                        mode="outlined"
                                        onPress={() => refreshTaskPreview()}>
                                        Refresh
                                    </Button>
                                </View>
                                {showSaveAs && (
                                    <View style={styles.saveAsBox}>
                                        <TextInput
                                            mode="outlined"
                                            label="New task name"
                                            value={newTaskName}
                                            onChangeText={text => {
                                                setNewTaskName(text);
                                                if (saveAsError) {
                                                    setSaveAsError('');
                                                }
                                            }}
                                        />
                                        <Button mode="contained" onPress={saveTaskAs}>
                                            OK
                                        </Button>
                                        {!!saveAsError && (
                                            <Text style={styles.errorText}>{saveAsError}</Text>
                                        )}
                                    </View>
                                )}
                                <Text style={styles.sectionTitle}>Task Preview</Text>
                                <ScrollView horizontal>
                                    <DataTable style={styles.table}>
                                        <View style={[styles.gridRow, styles.gridHeader]}>
                                            <View style={[styles.indexColumn, styles.cellBox]}>
                                                <Text style={styles.headerTextRight}>#</Text>
                                            </View>
                                            <View style={[styles.uidColumn, styles.cellBox]}>
                                                <Text style={styles.headerTextLeft}>uid</Text>
                                            </View>
                                            <View style={[styles.answerColumn, styles.cellBox]}>
                                                <Text style={styles.headerTextLeft}>a</Text>
                                            </View>
                                            <View style={[styles.mssColumn, styles.cellBox]}>
                                                <Text style={styles.headerTextRight}>mss</Text>
                                            </View>
                                            <View style={[styles.typeColumn, styles.cellBox]}>
                                                <Text style={styles.headerTextLeft}>itmType</Text>
                                            </View>
                                            <View style={[styles.typeColumn, styles.cellBox]}>
                                                <Text style={styles.headerTextLeft}>schedule</Text>
                                            </View>
                                        </View>
                                        {tableData.map((item, index) => (
                                            <View key={item.uid} style={styles.gridRow}>
                                                <View style={[styles.indexColumn, styles.cellBox]}>
                                                    <Text style={styles.cellTextRight}>
                                                        {String(index + 1)}
                                                    </Text>
                                                </View>
                                                <View style={[styles.uidColumn, styles.cellBox]}>
                                                    <Text style={styles.cellTextLeft}>
                                                        {item.uid}
                                                    </Text>
                                                </View>
                                                <View style={[styles.answerColumn, styles.cellBox]}>
                                                    <Text style={styles.cellTextLeft}>
                                                        {getPreviewText(item.a, 20)}
                                                    </Text>
                                                </View>
                                                <View style={[styles.mssColumn, styles.cellBox]}>
                                                    <Text style={styles.cellTextRight}>
                                                        {item.mss.toFixed(2)}
                                                    </Text>
                                                </View>
                                                <View style={[styles.typeColumn, styles.cellBox]}>
                                                    <Text style={styles.cellTextLeft}>
                                                        {item.itmType}
                                                    </Text>
                                                </View>
                                                <View style={[styles.schdTimeColumn, styles.cellBox]}>
                                                    <Text style={styles.cellTextLeft}>
                                                        {formatScheduledTime(item.scheduledTime)}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </DataTable>
                                </ScrollView>
                            </>
                        )}
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
    sliderBlock: {
        gap: 8,
    },
    previewActions: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    saveAsBox: {
        gap: 10,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sliderLabel: {
        fontSize: 16,
        color: '#f5f5f5',
    },
    sliderValue: {
        minWidth: 40,
        textAlign: 'right',
        fontSize: 16,
        fontWeight: '600',
        color: '#f5f5f5',
    },
    sliderTouchArea: {
        paddingVertical: 10,
    },
    sliderTrack: {
        height: 6,
        borderRadius: 999,
        backgroundColor: '#3a3a3a',
        justifyContent: 'center',
    },
    sliderFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        borderRadius: 999,
        backgroundColor: '#8ab4f8',
    },
    sliderThumb: {
        position: 'absolute',
        width: 20,
        height: 20,
        marginLeft: -10,
        borderRadius: 10,
        backgroundColor: '#d7e3ff',
        borderWidth: 2,
        borderColor: '#8ab4f8',
    },
    table: {
        minWidth: 350,
        borderWidth: 1,
        borderColor: '#3a3a3a',
        borderRadius: 8,
        overflow: 'hidden',
    },
    gridHeader: {
        backgroundColor: '#232323',
    },
    gridRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#2f2f2f',
    },
    cellBox: {
        justifyContent: 'center',
        paddingVertical: 5,
    },
    indexColumn: {
        width: 40,
        paddingLeft: 8,
        paddingRight: 12,
    },
    uidColumn: {
        width: 95,
        paddingLeft: 0,
        paddingRight: 0,
    },
    answerColumn: {
        width: 150,
        paddingLeft: 0,
        paddingRight: 0,
    },
    mssColumn: {
        width: 92,
        paddingLeft: 12,
        paddingRight: 16,
    },
    typeColumn: {
        width: 60,
        paddingLeft: 0,
        paddingRight: 0,
    },
    schdTimeColumn: {
        width: 160,
        paddingLeft: 0,
        paddingRight: 0,
    },
    headerTextLeft: {
        textAlign: 'left',
        color: '#f5f5f5',
        fontWeight: '600',
    },
    headerTextRight: {
        textAlign: 'right',
        color: '#f5f5f5',
        fontWeight: '600',
    },
    cellTextLeft: {
        textAlign: 'left',
        color: '#f5f5f5',
    },
    cellTextRight: {
        textAlign: 'right',
        color: '#f5f5f5',
    },
    errorText: {
        color: '#ff8a80',
    },
    topicChip: {
        marginRight: 8,
        marginBottom: 8,
    },
});

