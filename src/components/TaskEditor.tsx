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
  AppSettings,
  getAppSettingValue,
  loadAppSettingsFromDb,
  saveAppSettingsToDb,
  setAppSettingValue,
} from '../db/settings';
import {
  initSpeechDb,
  loadAllPhrases,
  openSpeechDb,
  SpItem,
} from '../db/speechDb';
import { Dropdown } from 'react-native-element-dropdown';
import {
  convertToTaskDisplayItem,
  CreateTask,
  LearnTask,
  TaskDisplayItem,
} from '../helpers/getNextItemUid';

type LoadedTaskEditorSettings = {
  taskList: LearnTask[];
  selectedTaskName: string;
  plannedDayItemCountInput: number;
  maxFreshItemCountInput: number;
};

type CalculatedTaskState = {
  tableData: TaskDisplayItem[];
  taskList: LearnTask[];
};

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
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildTaskItems(
  items: SpItem[],
  selectedTopics: string[],
  plannedDayItemCount: number,
  maxFreshItemCount: number,
  isReverse: boolean,
): SpItem[] {
  if (!selectedTopics.includes(ErrorItemsTaskTopic)) {
    var selectedTopicItems = items.filter(
      item => selectedTopics.length === 0 || selectedTopics.includes(item.topic),
    );
  } else {
    let tl = getAppSettingValue<LearnTask[]>('taskList');
    let errTask = tl.find(itm=>itm.name == ErrorItemsTask);
    selectedTopicItems = items.filter(item=>errTask?.itemUids.includes(item.uid));
  }


  return CreateTask(
    selectedTopicItems,
    plannedDayItemCount,
    maxFreshItemCount,
    isReverse,
  );
}

function updateTaskDraft(
  sourceTaskList: LearnTask[],
  taskName: string,
  patch: Partial<LearnTask>,
): LearnTask[] {
  return sourceTaskList.map(task =>
    task.name === taskName
      ? {
        ...task,
        ...patch,
        selectedTopics: patch.selectedTopics
          ? [...patch.selectedTopics]
          : [...task.selectedTopics],
        itemUids: patch.itemUids ? [...patch.itemUids] : [...task.itemUids],
      }
      : task,
  );
}

async function loadTaskEditorSettingsFromAppSettings(): Promise<LoadedTaskEditorSettings> {
  await loadAppSettingsFromDb();
  const loadedTaskList = getAppSettingValue<LearnTask[]>('taskList');
  const loadedSelectedTaskName =
    getAppSettingValue<string>('selectedTaskName') || 'Default Task';
  const loadedCurrentTask = loadedTaskList.find(
    task => task.name === loadedSelectedTaskName,
  );

  return {
    taskList: loadedTaskList,
    selectedTaskName: loadedSelectedTaskName,
    plannedDayItemCountInput: loadedCurrentTask?.plannedDayItemCount ?? 0,
    maxFreshItemCountInput: loadedCurrentTask?.maxFreshItemCount ?? 0,
  };
}

function calculateTaskEditorTableData(
  allItems: SpItem[],
  sourceTaskList: LearnTask[],
  selectedTaskName: string,
  plannedDayItemCountInput: number,
  maxFreshItemCountInput: number,
  isReverse: boolean,
): CalculatedTaskState {
  const currentTask = sourceTaskList.find(
    task => task.name === selectedTaskName,
  );
  const selectedTopics = currentTask?.selectedTopics ?? [];
  const nextTaskItems = buildTaskItems(
    allItems,
    selectedTopics,
    plannedDayItemCountInput,
    maxFreshItemCountInput,
    isReverse,
  );
  const nextTaskList = updateTaskDraft(sourceTaskList, selectedTaskName, {
    plannedDayItemCount: plannedDayItemCountInput,
    maxFreshItemCount: maxFreshItemCountInput,
    itemUids: nextTaskItems.map(item => item.uid),
  });

  return {
    tableData: nextTaskItems.map(item =>
      convertToTaskDisplayItem(item, isReverse, Date.now()),
    ),
    taskList: nextTaskList,
  };
}

async function saveTaskEditorSettingsToAppSettings(
  taskList: LearnTask[],
  selectedTaskName: string,
) {
  setAppSettingValue('taskList', taskList);
  setAppSettingValue('selectedTaskName', selectedTaskName);
  await saveAppSettingsToDb();
}

function resetCurrentTaskIndices(
  sourceTaskList: LearnTask[],
  selectedTaskName: string,
): LearnTask[] {
  return sourceTaskList.map(task =>
    task.name === selectedTaskName
      ? {
        ...task,
        indf: 0,
        indr: 0,
      }
      : task,
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
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const panResponder = useMemo(() => {
    function updateValue(locationX: number) {
      if (trackWidth <= 0) {
        return;
      }

      const ratio = clampSliderValue(locationX / trackWidth, 0, 1);
      const rawValue = min + ratio * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      setLocalValue(clampSliderValue(steppedValue, min, max));
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: event => {
        updateValue(event.nativeEvent.locationX);
      },
      onPanResponderMove: event => {
        updateValue(event.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        onChange(localValue);
        onComplete?.();
      },
      onPanResponderTerminate: () => {
        onChange(localValue);
        onComplete?.();
      },
    });
  }, [localValue, max, min, onChange, onComplete, step, trackWidth]);

  function handleTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  const ratio = max === min ? 0 : (localValue - min) / (max - min);

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{localValue}</Text>
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

export const ErrorItemsTask = "ErrorItems";
export const ErrorItemsTaskTopic = "Err";
export async function addItemToErrorTask(item: SpItem) {
  const tl = getAppSettingValue<LearnTask[]>('taskList');
  const errTask = tl.find(t => t.name == ErrorItemsTask);
  if (!errTask) {
    tl.push({ name: ErrorItemsTask, itemUids: [item.uid], plannedDayItemCount: 10, selectedTopics: [ErrorItemsTaskTopic], maxFreshItemCount: 0, indf: 0, indr: 0 });
  } else {
    if(errTask.itemUids.length+1>errTask.plannedDayItemCount){
      errTask.itemUids.pop();
    }
    errTask.itemUids.push(item.uid);
  }
  await saveAppSettingsToDb();
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
  const taskListRef = useRef<LearnTask[]>([]);
  const selectedTaskNameRef = useRef('Default Task');
  const plannedDayItemCountInputRef = useRef(0);
  const maxFreshItemCountInputRef = useRef(0);

  function formatScheduledTime(date: Date): string {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month} ${hours}:${minutes}`;
  }

  function applyLocalTaskState(
    nextTaskList: LearnTask[],
    nextTableData?: TaskDisplayItem[],
  ) {
    setTaskList(nextTaskList);
    taskListRef.current = nextTaskList;
    if (nextTableData) {
      setTableData(nextTableData);
    }
  }

  function syncCurrentTaskInputs(
    nextTaskList: LearnTask[],
    nextSelectedTaskName: string,
  ) {
    const nextTask = nextTaskList.find(
      task => task.name === nextSelectedTaskName,
    );
    const nextSelectedTopics = [...(nextTask?.selectedTopics ?? [])];
    const nextPlannedDayItemCountInput = nextTask?.plannedDayItemCount ?? 0;
    const nextMaxFreshItemCountInput = nextTask?.maxFreshItemCount ?? 0;

    setSelectedTopics(nextSelectedTopics);
    setPlannedDayItemCountInput(nextPlannedDayItemCountInput);
    setMaxFreshItemCountInput(nextMaxFreshItemCountInput);
    plannedDayItemCountInputRef.current = nextPlannedDayItemCountInput;
    maxFreshItemCountInputRef.current = nextMaxFreshItemCountInput;
  }

  function recalculateTaskEditorState(
    sourceTaskList: LearnTask[],
    nextSelectedTaskName: string,
    nextPlannedDayItemCountInput: number,
    nextMaxFreshItemCountInput: number,
  ): LearnTask[] {
    const calculatedState = calculateTaskEditorTableData(
      allItems,
      sourceTaskList,
      nextSelectedTaskName,
      nextPlannedDayItemCountInput,
      nextMaxFreshItemCountInput,
      isReverse,
    );

    applyLocalTaskState(calculatedState.taskList, calculatedState.tableData);
    return calculatedState.taskList;
  }

  useEffect(() => {
    async function load() {
      await initSpeechDb();
      const loadedSettings = await loadTaskEditorSettingsFromAppSettings();
      const loadedReverseMode = getAppSettingValue<boolean>('reverseMode');
      const db = await openSpeechDb();
      const res = await db.executeSql(
        'SELECT DISTINCT topic FROM phrases ORDER BY topic;',
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
      setIsReverse(loadedReverseMode);
      setSelectedTaskName(loadedSettings.selectedTaskName);
      selectedTaskNameRef.current = loadedSettings.selectedTaskName;
      syncCurrentTaskInputs(
        loadedSettings.taskList,
        loadedSettings.selectedTaskName,
      );
      const calculatedState = calculateTaskEditorTableData(
        loadedItems,
        loadedSettings.taskList,
        loadedSettings.selectedTaskName,
        loadedSettings.plannedDayItemCountInput,
        loadedSettings.maxFreshItemCountInput,
        loadedReverseMode,
      );
      applyLocalTaskState(calculatedState.taskList, calculatedState.tableData);
      setHasData(true);
      setIsPreviewDirty(false);
    }

    load().catch(err => {
      console.warn('Failed to load task editor settings', err);
    });
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
    const nextTaskList = updateTaskDraft(
      taskListRef.current,
      selectedTaskNameRef.current,
      { selectedTopics: nextSelectedTopics },
    );

    setSelectedTopics(nextSelectedTopics);
    const recalculatedTaskList = recalculateTaskEditorState(
      nextTaskList,
      selectedTaskNameRef.current,
      plannedDayItemCountInputRef.current,
      maxFreshItemCountInputRef.current,
    );
    syncCurrentTaskInputs(recalculatedTaskList, selectedTaskNameRef.current);
    setIsPreviewDirty(true);
  }

  function handleTaskSelectionChange(nextSelectedTaskName: string) {
    setSelectedTaskName(nextSelectedTaskName);
    selectedTaskNameRef.current = nextSelectedTaskName;
    const nextTask = taskListRef.current.find(
      task => task.name === nextSelectedTaskName,
    );
    const nextPlannedDayItemCountInput = nextTask?.plannedDayItemCount ?? 0;
    const nextMaxFreshItemCountInput = nextTask?.maxFreshItemCount ?? 0;

    syncCurrentTaskInputs(taskListRef.current, nextSelectedTaskName);
    const recalculatedTaskList = recalculateTaskEditorState(
      taskListRef.current,
      nextSelectedTaskName,
      nextPlannedDayItemCountInput,
      nextMaxFreshItemCountInput,
    );
    const resetTaskList = resetCurrentTaskIndices(
      recalculatedTaskList,
      nextSelectedTaskName,
    );
    applyLocalTaskState(resetTaskList);
    setIsPreviewDirty(true);
  }

  function handlePlannedDayItemCountChange(value: number) {
    setPlannedDayItemCountInput(value);
    plannedDayItemCountInputRef.current = value;
    recalculateTaskEditorState(
      taskListRef.current,
      selectedTaskNameRef.current,
      value,
      maxFreshItemCountInputRef.current,
    );
    setIsPreviewDirty(true);
  }

  function handleMaxFreshItemCountChange(value: number) {
    setMaxFreshItemCountInput(value);
    maxFreshItemCountInputRef.current = value;
    recalculateTaskEditorState(
      taskListRef.current,
      selectedTaskNameRef.current,
      plannedDayItemCountInputRef.current,
      value,
    );
    setIsPreviewDirty(true);
  }

  async function applyTaskPreview() {
    try {
      await saveTaskEditorSettingsToAppSettings(
        taskListRef.current,
        selectedTaskNameRef.current,
      );
      setIsPreviewDirty(false);
    } catch (err) {
      console.warn('Failed to save task editor settings', err);
    }
  }

  async function reloadTaskPreview() {
    try {
      setIsPreviewDirty(false);
      const loadedItems = await loadAllPhrases();
      setAllItems(loadedItems);
      const loadedSettings = await loadTaskEditorSettingsFromAppSettings();
      setSelectedTaskName(loadedSettings.selectedTaskName);
      selectedTaskNameRef.current = loadedSettings.selectedTaskName;
      syncCurrentTaskInputs(
        loadedSettings.taskList,
        loadedSettings.selectedTaskName,
      );
      const calculatedState = calculateTaskEditorTableData(
        allItems,
        loadedSettings.taskList,
        loadedSettings.selectedTaskName,
        loadedSettings.plannedDayItemCountInput,
        loadedSettings.maxFreshItemCountInput,
        isReverse,
      );
      const resetTaskList = resetCurrentTaskIndices(
        calculatedState.taskList,
        loadedSettings.selectedTaskName,
      );
      applyLocalTaskState(resetTaskList, calculatedState.tableData);
      syncCurrentTaskInputs(resetTaskList, loadedSettings.selectedTaskName);
      setIsPreviewDirty(false);
    } catch (err) {
      console.warn('Failed to refresh task editor settings', err);
    }
  }

  async function saveTaskAs() {
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
      selectedTopics: [...selectedTopics],
      plannedDayItemCount: plannedDayItemCountInputRef.current,
      maxFreshItemCount: maxFreshItemCountInputRef.current,
      indf: 0,
      indr: 0,
      itemUids: [...(currentTask?.itemUids ?? [])],
    };
    const nextTaskList = [...taskListRef.current, nextTask];
    const recalculatedTaskList = recalculateTaskEditorState(
      nextTaskList,
      trimmedTaskName,
      nextTask.plannedDayItemCount,
      nextTask.maxFreshItemCount,
    );

    setSelectedTaskName(trimmedTaskName);
    selectedTaskNameRef.current = trimmedTaskName;
    syncCurrentTaskInputs(recalculatedTaskList, trimmedTaskName);

    try {
      await saveTaskEditorSettingsToAppSettings(
        recalculatedTaskList,
        trimmedTaskName,
      );
      setIsPreviewDirty(false);
      setShowSaveAs(false);
      setNewTaskName('');
      setSaveAsError('');
    } catch (err) {
      console.warn('Failed to save task editor settings', err);
    }
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
              onChange={item => {
                handleTaskSelectionChange(item.value);
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
                  onChange={handlePlannedDayItemCountChange}
                />
                <TaskSlider
                  label="Max fresh item count"
                  value={maxFreshItemCountInput}
                  min={0}
                  max={50}
                  onChange={handleMaxFreshItemCountChange}
                />
                <View style={styles.previewActions}>
                  <Button
                    mode="contained"
                    disabled={!isPreviewDirty}
                    onPress={() => {
                      applyTaskPreview().catch(err => {
                        console.warn(
                          'Failed to save task editor settings',
                          err,
                        );
                      });
                    }}>
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
                    onPress={() => {
                      reloadTaskPreview().catch(err => {
                        console.warn(
                          'Failed to reload task editor settings',
                          err,
                        );
                      });
                    }}>
                    Reload
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
                    <Button
                      mode="contained"
                      onPress={() => {
                        saveTaskAs().catch(err => {
                          console.warn(
                            'Failed to save task editor settings',
                            err,
                          );
                        });
                      }}>
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
                          <Text style={styles.cellTextLeft}>{item.uid}</Text>
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
